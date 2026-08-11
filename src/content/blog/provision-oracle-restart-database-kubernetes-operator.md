---
title: "Provision an Oracle Restart Database on Kubernetes with Oracle Database Operator"
description: "Kubernetes/OKE architecture for Oracle Restart: operator, CR, pod, Services, Secrets, node ASM; kubectl pre-flight; build slim image from GitHub; provision and connect."
pubDate: 2026-07-30
updatedDate: 2026-08-11
author: "Saurabh Ahuja"
tags:
  - oracle
  - kubernetes
  - database-operator
  - oracle-restart
  - asm
  - platform-engineering
  - databases
featured: true
draft: false
---

Oracle Restart combines **Oracle Grid Infrastructure** with a **single-instance Oracle Database** so storage (ASM), listeners, and the instance restart cleanly after failures. On Kubernetes, the [Oracle Database Operator](https://github.com/oracle/oracle-database-operator) can provision that stack for you through an `OracleRestart` custom resource—so you declare desired state in YAML and let the controller build pods, volumes, and software mounts.

This guide is written for **new users**: platform engineers and DBAs who know basic `kubectl` but may not have provisioned Oracle Restart via the operator before. It follows the official use case [Provisioning an Oracle Restart Database](https://github.com/oracle/oracle-database-operator/blob/main/docs/oraclerestart/provisioning/provisioning_oracle_restart_db.md) and expands it into a clear checklist, mental model, and verify-and-connect path.

> **Operator version applicability (2.1):** this guide targets the **Oracle Database Operator 2.1** release line and the `database.oracle.com/v4` `OracleRestart` API shown in the sample. The 2.2 release adds only optional fields, so the sample YAML in this post remains valid. Notable 2.1→2.2 deltas:
>
> - `dbSecret` gained optional `key` and `encryptionType: base64` (for base64-encoded pwdfile secrets).
> - A separate `tdeWalletSecret` (same shape as `dbSecret`) can be specified.
> - `envVars` live under `spec.instDetails` (e.g. `LOG_DIR`, `ORA_LOG_MAX_BYTES`, or the existing `IGNORE_CRS_PREREQS` / `IGNORE_DB_PREREQS`).

**What you will achieve**

- See how the **pod, Services, Secrets, and operator** fit on **OKE or any Kubernetes cluster**  
- Run **kubectl pre-checks** so operator, CRDs, secrets, and capacity exist **before** you apply Oracle Restart  
- Build the slim image from GitHub (not OCR)  
- Apply a sample `OracleRestart` CR (`oraclerestart_prov.yaml`)  
- Confirm readiness from pod logs and CR status  
- Connect with SQL\*Plus (NodePort or LoadBalancer)

---

## Architecture on Kubernetes / OKE (pods and services)

This is **not** a diagram of Oracle Restart product internals (CRS, ASM processes inside the binary stack). It shows how the **Oracle Database Operator** integrates **Kubernetes objects** on **OKE or any CNCF cluster**: Custom Resource → controller → Pod, Services, Secrets, and **node-local** disks/paths.

### Cluster view: what lands where

![Oracle Restart on Kubernetes architecture: operator, OracleRestart CR, namespace with pod, services, secrets, and worker node ASM disks](/images/blog/oracle-restart-k8s-architecture.svg)

| Layer | Kubernetes objects (sample names) | Role |
|-------|-----------------------------------|------|
| Control plane (any NS) | Oracle Database Operator deployment | Watches `OracleRestart`, reconciles desired state |
| API | `OracleRestart` CR (`database.oracle.com/v4`) | Your declarative install/config |
| Workload NS (`orestart`) | `StatefulSet` / `pod/dbmc1-0` | Runs slim image (GI + single-instance DB) |
| Workload NS | `svc/dbmc1` (NodePort or LoadBalancer) | Client SQL\*Net on **1521** |
| Workload NS | `svc/dbmc1-0` headless | Stable in-cluster DNS / node hostname |
| Workload NS | Secrets `ssh-key-secret`, `db-user-pass-pkutl` | Referenced by CR fields |
| **Worker node** | ASM devices + `hostSwLocation` | Not free-floating pods—**this node** must hold disks/paths |

**OKE note:** same object model as any Kubernetes. On OKE, a `LoadBalancer` Service typically provisions an **OCI load balancer** automatically; on bare metal you may use MetalLB or stick to NodePort. The operator and CR do not change—only how `EXTERNAL-IP` appears.

### Provision flow (you vs the cluster)

![Provision flow from pre-flight and slim image build through apply, operator reconcile, ready, and connect](/images/blog/oracle-restart-k8s-reconcile-flow.svg)

### Connectivity: who can open port 1521

![Client connectivity via NodePort, LoadBalancer, or ClusterIP to the Oracle Restart pod](/images/blog/oracle-restart-k8s-connectivity.svg)

```text
Outside client ──► NodePort (workerIP:nodePort) ──┐
Outside client ──► LoadBalancer (EXTERNAL-IP:1521) ├──► svc/dbmc1 ──► pod/dbmc1-0 :1521
In-cluster app ──► ClusterIP / DNS (dbmc1.orestart) ─┘
```

Use `kubectl get all -n orestart -o wide` after provision to see which path your cluster created.

---

## Who this is for (and what you should already have)

| Audience | Why this post helps |
|----------|---------------------|
| Kubernetes platform engineers | Map Oracle Restart objects to familiar Kubernetes primitives |
| Oracle DBAs new to operators | See ASM disks, GI home, and DB name as CR fields instead of silent install scripts |
| SREs / DevOps | Get a repeatable provision path and a short readiness checklist |

**Prerequisites (typical lab or staging setup)**

1. A Kubernetes cluster with enough **CPU and memory** for Oracle (the sample CR requests **4 CPU / 16Gi**).  
2. The **Oracle Database Operator** installed and reconciling `OracleRestart` resources (`database.oracle.com`).  
3. A **worker node** reserved (or clearly identified) for the instance—Oracle Restart in this pattern is **node-affine** via `workerNode` and host paths.  
4. **ASM-ready block devices** on that worker (for example `/dev/disk/by-partlabel/asm-disk1`).  
5. Host directories for software stage and Oracle homes (for example `/scratch/software/stage` and `/scratch/orestart/`).  
6. Kubernetes **Secrets** for SSH keys and database credentials as required by your operator install docs.  
7. A **slim Oracle Restart / RAC container image you build yourself** (see [Build the slim container image](#build-the-slim-container-image-not-on-oracle-container-registry-yet)). The slim tag used in samples is **not** published today on Oracle Container Registry’s RAC repository—you cannot pull a ready-made slim image from OCR for this flow yet.

If the operator is not installed yet, start from the project root documentation in [oracle/oracle-database-operator](https://github.com/oracle/oracle-database-operator) before applying the Restart CR. **Do not apply `oraclerestart_prov.yaml` until every pre-check below passes.**

---

## Pre-flight checks: verify prerequisites with kubectl

Run these **before** `kubectl apply -f oraclerestart_prov.yaml`. Adjust namespace names if your install differs from the samples (`orestart` for the database CR; the operator often runs in its own namespace such as `oracle-database-operator-system`—confirm on your cluster).

Set a namespace variable for the sample:

```bash
export NS=orestart
```

### 1. Cluster access and API server health

```bash
kubectl cluster-info
kubectl get nodes -o wide
kubectl get --raw='/readyz?verbose' 2>/dev/null || kubectl get --raw=/readyz
```

**Expect:** at least one **Ready** worker node with free capacity (sample wants **4 CPU / 16Gi** allocatable for the Oracle Restart pod alone).

```bash
kubectl describe nodes | grep -A 8 -E '^Name:|Allocatable:|Allocated resources:'
# Or a compact view of capacity vs allocatable:
kubectl get nodes -o custom-columns=\
NAME:.metadata.name,\
CPU:.status.allocatable.cpu,\
MEM:.status.allocatable.memory,\
READY:.status.conditions[?\(@.type==\"Ready\"\)].status
```

### 2. Oracle Database Operator is installed and running

List deployments/pods that belong to the operator (name varies by install method—Helm chart, OLM, or raw manifests):

```bash
# Common patterns — run what matches your install
kubectl get ns | grep -iE 'oracle|database|operator'
kubectl get deploy -A | grep -iE 'oracle|database.operator|db-operator'
kubectl get pods -A | grep -iE 'oracle-database-operator|database-operator'
```

If you know the operator namespace (example name shown; replace if yours differs):

```bash
export OP_NS=oracle-database-operator-system   # change if needed
kubectl get deploy,pods,svc -n "$OP_NS"
kubectl get pods -n "$OP_NS" -o wide
```

**Expect:** operator pod(s) in **Running** / **Ready** state, not `CrashLoopBackOff` or `ImagePullBackOff`.

Controller logs (optional, if a pod is unhealthy):

```bash
kubectl logs -n "$OP_NS" -l control-plane=controller-manager --tail=50
# Fallback if labels differ:
kubectl get pods -n "$OP_NS" -o name | head -1 | xargs -I{} kubectl logs -n "$OP_NS" {} --tail=50
```

### 3. OracleRestart CRD and API group are registered

The sample CR uses `apiVersion: database.oracle.com/v4` and `kind: OracleRestart`. Confirm the API server knows that type:

```bash
kubectl api-resources | grep -iE 'oraclerestart|database.oracle.com'
kubectl get crd | grep -iE 'oraclerestart|database.oracle.com'
```

More detail on the CRD:

```bash
kubectl get crd oraclerestarts.database.oracle.com -o yaml | head -40
# If the exact CRD name differs on your version:
kubectl get crd -o name | grep -i restart
```

Short names / versions:

```bash
kubectl explain oraclerestart --api-version=database.oracle.com/v4
# or without pinning version:
kubectl explain OracleRestart
```

**Expect:** `oraclerestarts` (or similar) listed under group `database.oracle.com`, and `kubectl explain` prints a schema—not `the server doesn't have a resource type`.

List existing Restart instances (should be empty on a fresh lab, or show prior installs):

```bash
kubectl get oraclerestart -A
# Some clusters only accept the plural form:
kubectl get oraclerestarts.database.oracle.com -A
```

### 4. Target namespace exists (or create it)

```bash
kubectl get ns "$NS"
# If missing:
kubectl create namespace "$NS"
kubectl get ns "$NS"
```

Optional: confirm you can create namespaced objects there:

```bash
kubectl auth can-i create secrets -n "$NS"
kubectl auth can-i create oraclerestarts.database.oracle.com -n "$NS"
kubectl auth can-i get pods -n "$NS"
```

**Expect:** `yes` for create secrets and create OracleRestart (and get pods) with your user/service account.

### 5. Required Secrets exist and contain the expected keys

The sample CR references:

| CR field | Secret name (sample) | Keys the sample expects |
|----------|----------------------|-------------------------|
| `sshKeySecret` | `ssh-key-secret` | keys named like `ssh-privkey`, `ssh-pubkey` (see `privKeySecretName` / `pubKeySecretName`) |
| `dbSecret` | `db-user-pass-pkutl` | `key.pem`, `pwdfile.enc` (see `keyFileName` / `pwdFileName`) |

List secrets in the namespace:

```bash
kubectl get secrets -n "$NS"
kubectl get secret -n "$NS" ssh-key-secret -o yaml
kubectl get secret -n "$NS" db-user-pass-pkutl -o yaml
```

Show **key names only** (not values)—confirm the keys match the CR:

```bash
kubectl get secret -n "$NS" ssh-key-secret -o jsonpath='{.data}' | tr ',' '\n'
# Or list keys cleanly:
kubectl get secret -n "$NS" ssh-key-secret -o go-template='{{range $k,$v := .data}}{{printf "%s\n" $k}}{{end}}'
kubectl get secret -n "$NS" db-user-pass-pkutl -o go-template='{{range $k,$v := .data}}{{printf "%s\n" $k}}{{end}}'
```

**Expect:** both secrets present in `$NS`, with key names matching your YAML (`ssh-privkey`, `ssh-pubkey`, `key.pem`, `pwdfile.enc` in the sample).

If a secret is missing, create it per the operator’s secret docs **before** applying the CR—do not put plaintext passwords in the blog post or in git.

### 6. Worker node identity matches `instDetails.workerNode`

The sample sets `workerNode` to a node **IP**. Resolve what the cluster actually reports:

```bash
kubectl get nodes -o wide
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.addresses}{"\n"}{end}'
```

Compare the IP you will put in `instDetails.workerNode` with **InternalIP** (or the address family your operator docs require). Wrong node IP → pod never lands on the machine that has ASM disks and software paths.

```bash
# Example: describe a specific node once you know its name
kubectl describe node <worker-node-name> | grep -E 'Name:|Taints:|Unschedulable:|Allocatable:|InternalIP|Hostname'
```

**Expect:** target node **Ready**, no blocking taints (or you tolerate them), and allocatable CPU/memory ≥ sample requests.

### 7. Storage / CSI context (optional but useful)

ASM disks in this use case are usually **node-local devices** referenced by path; the controller still creates related volume objects. Check what storage classes and PVs already exist so you do not collide:

```bash
kubectl get sc
kubectl get pv,pvc -A | head -50
```

### 8. Image pull secrets (if the image is private)

```bash
kubectl get secrets -n "$NS" | grep -iE 'docker|registry|pull'
# If your ServiceAccount needs imagePullSecrets:
kubectl get sa default -n "$NS" -o yaml
```

### 9. One-shot pre-flight script (copy/paste)

Run this after setting `NS` (and `OP_NS` if known). It fails fast if a check is missing:

```bash
export NS=orestart
# export OP_NS=oracle-database-operator-system

set -e
echo "== nodes =="
kubectl get nodes -o wide

echo "== OracleRestart API / CRD =="
kubectl api-resources | grep -i oraclerestart || { echo "FAIL: OracleRestart API missing — install operator/CRDs first"; exit 1; }
kubectl get crd | grep -i oraclerestart || { echo "FAIL: oraclerestart CRD missing"; exit 1; }
kubectl explain OracleRestart >/dev/null

echo "== namespace =="
kubectl get ns "$NS" || { echo "FAIL: namespace $NS missing — kubectl create namespace $NS"; exit 1; }

echo "== secrets (sample names) =="
kubectl get secret -n "$NS" ssh-key-secret
kubectl get secret -n "$NS" db-user-pass-pkutl
echo "SSH secret keys:"; kubectl get secret -n "$NS" ssh-key-secret -o go-template='{{range $k,$v := .data}}{{printf "  %s\n" $k}}{{end}}'
echo "DB secret keys:"; kubectl get secret -n "$NS" db-user-pass-pkutl -o go-template='{{range $k,$v := .data}}{{printf "  %s\n" $k}}{{end}}'

echo "== existing OracleRestart CRs =="
kubectl get oraclerestart -A 2>/dev/null || kubectl get oraclerestarts.database.oracle.com -A 2>/dev/null || true

echo "== operator pods (best effort) =="
kubectl get pods -A | grep -iE 'oracle-database-operator|database-operator' || echo "WARN: no operator pods matched by name — verify OP_NS manually"

echo "PRE-FLIGHT: core API + sample secrets OK. Confirm worker IP, ASM disks, and staged software on the node next."
```

### 10. Host-side checks (not kubectl—but required)

On the **worker node** you listed in `workerNode` (SSH as root or a privileged user):

```bash
# ASM devices (paths must match asmDiskGroupDetails)
ls -l /dev/disk/by-partlabel/asm-disk1 /dev/disk/by-partlabel/asm-disk2

# Oracle home host path (matches instDetails.hostSwLocation in the sample)
ls -la /scratch/orestart/ 2>/dev/null || mkdir -p /scratch/orestart/
```

**Slim image path (recommended in this guide):** you already built the image from GitHub—you do **not** need `grid_home.zip` / `db_home.zip` on the node for that image build. Confirm the **container image** is available on the node or pullable from your registry instead of hunting for installer zips.

**Host-stage / non-slim path only:** if your operator version and CR still install from staged media, then also verify:

```bash
ls -la /scratch/software/stage/
ls -la /scratch/software/stage/grid_home.zip /scratch/software/stage/db_home.zip
```

Only after **kubectl pre-flight** and **host-side** checks pass should you apply the provisioning YAML.

---

## What “provision with Oracle Restart Controller” actually creates

The [architecture diagrams above](#architecture-on-kubernetes--oke-pods-and-services) map to the objects below. When you apply the provisioning manifest, the controller does more than start a pod. In this use case it typically provisions:

| Artifact | Purpose |
|----------|---------|
| **Oracle Restart pod** | Runs Grid Infrastructure + database processes inside the container/pod model |
| **Headless services** | Stable DNS for the Oracle Restart node hostname inside the cluster |
| **ASM-backed storage** | Persistent volumes derived from the disks you list under `asmDiskGroupDetails` |
| **Software host paths** | Worker directories for Oracle homes (and optional staged zips for non-slim flows) |
| **Namespace** | Sample flows use namespace `orestart` |

Two host paths appear in the sample CR:

- **`hostSwStageLocation`** — used when the controller expects **staged** Grid / RDBMS zip files on the worker.  
- **`hostSwLocation`** — where GI HOME and RDBMS HOME live on the worker; the Oracle Restart pod mounts these paths.

For the **slim image** path documented below, you build software into the image from GitHub—you do **not** need to download and stage `grid_home.zip` / `db_home.zip` just to build that image. Keep the CR fields consistent with the image and operator version you use; do not invent zip files you never staged.

Think of the flow as: **build/push slim image → prepare node disks + secrets → apply CR → controller configures Restart → ASM DATA diskgroup → database ready**.

---

## Build the slim container image (not on Oracle Container Registry yet)

### Important: slim image is not available on OCR today

New users often look for a pull-ready image under **Oracle Real Application Clusters** on [Oracle Container Registry](https://container-registry.oracle.com/ords/f?p=113:4:6124130782295:::4:P4_REPOSITORY,AI_REPOSITORY,AI_REPOSITORY_NAME,P4_REPOSITORY_NAME,P4_EULA_ID,P4_BUSINESS_AREA_ID:392,392,Oracle%20Real%20Application%20Clusters,Oracle%20Real%20Application%20Clusters,1,0&cs=3csbaN7EXhgOkanl3dndm8GcIDtGUEeeKdRaLE12Ej7owZwM_mB5n5Ii1x_rpOG4SeP7kVvF6yG-mb5L9DLjcLg).

**For this Oracle Restart slim sample, that is not enough today:**

| Expectation | Reality (as of this guide) |
|-------------|----------------------------|
| “Pull slim ORestart from container-registry.oracle.com” | **Slim image is not published there** for this use case |
| “Use sample tag as-is from OCR” | Sample names like `dbocir/oracle/database-orestart:19.3.0-slim` are **placeholders** for an image **you** build or host |
| “I need `grid_home.zip` / `db_home.zip` to build slim” | **No** — the GitHub **slim** build path does **not** require those zip files |

**What you must do for now:** build the slim container image from Oracle’s public Docker/Podman build scripts on GitHub, tag it for your registry (or `localhost`), load it onto your cluster nodes or private registry, then set `spec.image` in the CR to **your** tag.

### Where to build from (GitHub)

Official slim build docs live in the Oracle Docker images repository:

- [Building Oracle RAC Database container slim image](https://github.com/oracle/docker-images/tree/main/OracleDatabase/RAC/OracleRealApplicationClusters#building-oracle-rac-database-container-slim-image)  
- Path context: [`OracleDatabase/RAC/OracleRealApplicationClusters`](https://github.com/oracle/docker-images/tree/main/OracleDatabase/RAC/OracleRealApplicationClusters)

The Oracle Database Operator provisioning doc points at that same tree for the slim image used with Oracle Restart Controller samples ([provisioning guide](https://github.com/oracle/oracle-database-operator/blob/main/docs/oraclerestart/provisioning/provisioning_oracle_restart_db.md)).

### Slim build does not need installer zip files

This is the part that confuses people who have done classic Oracle container builds:

| Build style | Need `LINUX.X64_*.zip` / `grid_home.zip` / `db_home.zip` on the build host? |
|-------------|-----------------------------------------------------------------------------|
| **Slim image** (GitHub slim target for RAC/ORestart samples) | **No** — follow the slim build section; you do **not** stage those zips for the image build |
| Older / full software-stage installs | Often **yes** — installer media and host stage paths matter |

So for this blog’s **recommended path for new users**:

1. Clone `oracle/docker-images` (or the documented slim instructions linked above).  
2. Build the **slim** image per that README (Podman/Docker as documented).  
3. Do **not** block yourself waiting for zips “because the CR YAML mentions `gridSwZipFile` / `dbSwZipFile`.” Those fields describe **host-stage** style installs; with slim, software is already in the image. Align CR values with the operator doc for slim, or leave stage paths only if your operator version still requires empty/placeholder directories—**do not invent missing zip files**.  
4. Tag the result for your environment.

Example tags you will create yourself (names are illustrative):

```text
# After a successful local slim build, a common default looks like:
localhost/oracle/database-rac:19.3.0-slim

# Retag for your registry or for the sample-style name used in operator docs:
podman tag localhost/oracle/database-rac:19.3.0-slim \
  dbocir/oracle/database-orestart:19.3.0-slim
# or:
docker tag localhost/oracle/database-rac:19.3.0-slim \
  <your-registry>/oracle/database-orestart:19.3.0-slim
```

The operator sample may show:

```text
dbocir/oracle/database-orestart:19.3.0-slim
```

Treat that as **“put your built image reference here”**, not as “pull this from OCR.”

### After the image exists

1. **Push** to a registry your worker nodes can pull, **or** load the image onto each target node (`podman load` / `ctr images import` / mirror—whatever your cluster uses).  
2. Set `spec.image` in `oraclerestart_prov.yaml` to **exactly** that reference.  
3. Prefer `imagePullPolicy: IfNotPresent` when images are pre-loaded on nodes; use `Always` only when you intentionally pull a new digest from a registry.  
4. Confirm nodes can resolve the image **before** apply:

```bash
# On the worker (example with podman/crictl — use what your CRI supports)
# podman images | grep -iE 'database-rac|database-orestart|orestart'
# crictl images | grep -iE 'database-rac|database-orestart|orestart'
```

A wrong image name is still the most common `ImagePullBackOff`—especially if you left the sample tag as-is without building or mirroring anything.

### Quick FAQ for this section

**Can I skip building and use only what is on container-registry.oracle.com RAC?**  
Not for the **slim** sample path described here. OCR’s RAC repository does not replace the GitHub slim build for this guide. Build from GitHub for now.

**Do I need to download Oracle Database zip media to build slim?**  
**No** for the slim image build itself. Zip staging is a different (non-slim / host-stage) model.

**Where do I put the image name in the CR?**  
`spec.image` (and optionally registry pull secrets if the image is private).

---

## Understand the sample Custom Resource

Official sample: [`oraclerestart_prov.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/oraclerestart/provisioning/oraclerestart_prov.yaml).

High-level structure:

```yaml
apiVersion: database.oracle.com/v4
kind: OracleRestart
metadata:
  name: oraclerestart-sample
  namespace: orestart
spec:
  instDetails:
    name: dbmc1
    hostSwLocation: /scratch/orestart/
    workerNode:
      - 10.0.10.58          # replace with your worker node IP
  asmDiskGroupDetails:
    - name: DATA
      redundancy: EXTERNAL
      type: CRSDG
      disks:
        - /dev/disk/by-partlabel/asm-disk1
        - /dev/disk/by-partlabel/asm-disk2
  sshKeySecret:
    name: ssh-key-secret
    privKeySecretName: ssh-privkey
    pubKeySecretName: ssh-pubkey
  dbSecret:
    name: db-user-pass-pkutl
    keyFileName: key.pem
    pwdFileName: pwdfile.enc
  image: dbocir/oracle/database-orestart:19.3.0-slim
  imagePullPolicy: IfNotPresent
  serviceDetails:
    name: soepdb
  resources:
    requests:
      memory: "16Gi"
      cpu: "4"
    limits:
      memory: "16Gi"
      cpu: "4"
  configParams:
    gridHome: "/u01/app/19c/grid"
    gridBase: "/u01/app/grid"
    dbHome: "/u01/app/oracle/product/19c/dbhome_1"
    dbBase: "/u01/app/oracle"
    inventory: "/u01/app/oraInventory"
    gridSwZipFile: "grid_home.zip"
    dbSwZipFile: "db_home.zip"
    sgaSize: "8G"
    pgaSize: "4G"
    processes: 2000
    cpuCount: 4
    dbName: "PORCLCDB"
    hostSwStageLocation: /scratch/software/stage
```

### Fields new users should edit first

| Field | What to put |
|-------|-------------|
| `metadata.namespace` | Namespace you prepared (sample: `orestart`) |
| `instDetails.workerNode` | Real worker node IP(s) where disks and host paths exist |
| `instDetails.hostSwLocation` | Host path for GI/DB homes |
| `configParams.hostSwStageLocation` | Host path containing `grid_home.zip` / `db_home.zip` |
| `configParams.gridSwZipFile` / `dbSwZipFile` | Exact zip file names on the stage path |
| `asmDiskGroupDetails[].disks` | Stable device paths **on that worker** |
| `image` | Your registry/tag |
| `sshKeySecret` / `dbSecret` | Secrets that already exist in the namespace |
| `configParams.dbName` | CDB name (sample: `PORCLCDB`) |
| `serviceDetails.name` | Service / PDB-oriented name used by the sample (`soepdb`) |
| `resources` | Match node capacity; do not under-size SGA/PGA relative to memory limits |

### ASM disk group example

```yaml
asmDiskGroupDetails:
  - name: DATA
    redundancy: EXTERNAL
    type: CRSDG
    disks:
      - /dev/disk/by-partlabel/asm-disk1
      - /dev/disk/by-partlabel/asm-disk2
```

Use **by-partlabel** or another **stable** path. Device names like `/dev/sdb` can change after reboot and break ASM. `EXTERNAL` redundancy is common for lab disks when the underlying storage already mirrors; production redundancy choices should follow your storage design and Oracle guidance.

### Optional prereq-ignore environment variables

The sample CR comments optional env vars such as `IGNORE_CRS_PREREQS` and `IGNORE_DB_PREREQS`. Only enable these when you understand the risk—they skip installation prerequisite checks. Prefer fixing real OS/kernel package gaps in production-like environments.

---

## Step-by-step: deploy Oracle Restart

**Stop if pre-flight failed.** Re-run the [Pre-flight checks](#pre-flight-checks-verify-prerequisites-with-kubectl) until operator CRDs, secrets, and node capacity are green.

### 1. Prepare the worker node

On the chosen worker:

- Confirm ASM disks exist and are not mounted as ordinary filesystems.  
- Ensure the **slim** container image is present or pullable (built from GitHub—not pulled as slim from OCR; see [image section](#build-the-slim-container-image-not-on-oracle-container-registry-yet)).  
- Create host software directories required by `hostSwLocation` / your operator docs.  
- **Do not** block on downloading `grid_home.zip` / `db_home.zip` for the slim image build—those zips are not required for the GitHub slim build path.

### 2. Create namespace and secrets (if not already done)

```bash
kubectl get ns orestart || kubectl create namespace orestart
# Create SSH and DB credential secrets per operator documentation
# kubectl apply -f your-secrets.yaml
kubectl get secrets -n orestart
kubectl get secret -n orestart ssh-key-secret -o go-template='{{range $k,$v := .data}}{{printf "%s\n" $k}}{{end}}'
kubectl get secret -n orestart db-user-pass-pkutl -o go-template='{{range $k,$v := .data}}{{printf "%s\n" $k}}{{end}}'
```

Secret shape must match `sshKeySecret` and `dbSecret` field names in the CR. Do not apply the Restart CR until both secrets exist with the correct key names.

### 3. Apply the OracleRestart resource

Use the official sample or your customized copy:

```bash
# Final sanity: CRD still present
kubectl api-resources | grep -i oraclerestart
kubectl apply -f oraclerestart_prov.yaml
```

Expected-style response:

```text
oraclerestart.database.oracle.com/oraclerestart-sample created
```

### 4. Watch Kubernetes objects

```bash
kubectl get all -n orestart
kubectl get oraclerestart -n orestart
kubectl describe oraclerestart oraclerestart-sample -n orestart
```

You should eventually see a StatefulSet/pod (sample naming often looks like `dbmc1-0`), plus services for client access and headless identity.

### 5. Follow database setup logs

The official readiness signal is in the setup log inside the pod. Example pattern from the docs:

```bash
kubectl exec -it pod/dbmc1-0 -n orestart -- bash -c "tail -f /tmp/orod/oracle_db_setup.log"
```

When provisioning succeeds, look for:

```text
===============================
ORACLE DATABASE IS READY TO USE
===============================
```

Keep that session open during first install; GI and DB software configuration can take a long time on cold nodes.

### 6. Inspect the custom resource status

Dump or describe the CR object after the log shows ready. Oracle publishes an example object dump alongside the guide (`orestart_object.txt` in the same docs folder). Prefer operator **status conditions** and events over guessing from pod phase alone—`Running` does not always mean “database open.”

---

## Connect to the database

After readiness, connectivity depends on how the service was exposed. Full detail: [Database Connection (Oracle Restart)](https://github.com/oracle/oracle-database-operator/blob/main/docs/oraclerestart/provisioning/database_connection.md).

### Discover service type and ports

```bash
kubectl get all -n orestart -o wide
```

Example patterns:

| Service type | How clients connect |
|--------------|---------------------|
| **NodePort** | `<worker-node-ip>:<nodePort>` maps to pod `1521` |
| **LoadBalancer** | `<EXTERNAL-IP>:1521` |
| **ClusterIP only** | Only workloads **inside** the cluster can reach port 1521 |

### SQL\*Plus — NodePort example

If pod port `1521` is mapped to node port `30007`:

```bash
sqlplus system/<Database Password>@//<Worker Node Public IP>:30007/PORCLCDB
```

Open the NodePort for ingress on the worker firewall/security list.

### SQL\*Plus — LoadBalancer example

```bash
sqlplus system/<Database Password>@//<Load Balancer Public IP>:1521/PORCLCDB
```

### Sanity query

```sql
set lines 200
col HOST_NAME format a40
select INSTANCE_NAME, HOST_NAME, DATABASE_TYPE from v$instance;
```

You should see a **SINGLE** database type with the instance name matching your `dbName` (for example `PORCLCDB`) and host name like `dbmc1-0`.

---

## Troubleshooting checklist (first-time failures)

| Symptom | Likely cause | What to check |
|---------|--------------|---------------|
| `ImagePullBackOff` | Wrong image/tag or registry auth | `kubectl describe pod`; fix `spec.image` / pull secrets |
| Pod pending / not scheduled | Node selector, capacity, or affinity | `workerNode`, CPU/memory, taints |
| Setup log stuck on storage | Disk path wrong or not visible in pod | Device exists on **that** worker; by-partlabel paths |
| Setup fails on software | Missing zips or bad `hostSwStageLocation` | Files present; names match `gridSwZipFile` / `dbSwZipFile` |
| Secret errors | Missing keys in Secret | `sshKeySecret` / `dbSecret` field mapping |
| Cannot connect remotely | Service type / firewall | NodePort open, LB EXTERNAL-IP, or use in-cluster client |
| OOM or crash loops | SGA/PGA vs pod memory limits | Align `sgaSize`/`pgaSize` with `resources.limits.memory` |

Always combine:

```bash
kubectl get events -n orestart --sort-by='.lastTimestamp'
kubectl logs -n orestart pod/dbmc1-0 --tail=200
```

with the `/tmp/orod/oracle_db_setup.log` stream for install-specific errors.

---

## Security and operations notes

- Treat `dbSecret` material and SSH private keys as **production secrets**: short-lived access, encrypted etcd, least-privilege RBAC.  
- Prefer private registries and image digest pins for repeatable builds.  
- Host paths (`hostSwLocation`, stage directories) couple the database to a **specific node**—plan backup, drain, and maintenance accordingly; this is not a free-floating multi-AZ app pod.  
- Resource requests in the sample (16Gi / 4 CPU) are a starting point; size SGA/PGA and node capacity together.  
- Do not enable ignore-prereq flags in regulated environments without a written exception.

---

## SEO-friendly takeaways (quick reference)

**Primary question:** *How do I provision Oracle Restart Database on Kubernetes?*  
**Answer:** Install the Oracle Database Operator, prepare a worker node with ASM disks and staged GI/DB software, apply an `OracleRestart` custom resource (sample `oraclerestart_prov.yaml`), wait for `ORACLE DATABASE IS READY TO USE` in the setup log, then connect via NodePort or LoadBalancer to service port 1521 using the configured CDB name (for example `PORCLCDB`).

**Keywords covered naturally:** Oracle Restart Kubernetes, Oracle Database Operator, OracleRestart CRD, ASM diskgroup on Kubernetes, provision Oracle 19c Restart, Grid Infrastructure operator, SQL\*Plus NodePort.

---

## FAQ

### Is the slim Oracle Restart image on Oracle Container Registry?

**Not for this sample path today.** The [Oracle Container Registry RAC repository](https://container-registry.oracle.com/ords/f?p=113:4:6124130782295:::4:P4_REPOSITORY,AI_REPOSITORY,AI_REPOSITORY_NAME,P4_REPOSITORY_NAME,P4_EULA_ID,P4_BUSINESS_AREA_ID:392,392,Oracle%20Real%20Application%20Clusters,Oracle%20Real%20Application%20Clusters,1,0&cs=3csbaN7EXhgOkanl3dndm8GcIDtGUEeeKdRaLE12Ej7owZwM_mB5n5Ii1x_rpOG4SeP7kVvF6yG-mb5L9DLjcLg) does not replace building the **slim** image. Build it from the [GitHub slim instructions](https://github.com/oracle/docker-images/tree/main/OracleDatabase/RAC/OracleRealApplicationClusters#building-oracle-rac-database-container-slim-image). That slim build does **not** require installer zip files.

### Is Oracle Restart the same as Oracle RAC on Kubernetes?

No. **Oracle Restart** is single-instance Oracle Database managed by Grid Infrastructure (ASM, restartability). **RAC** is multi-instance clustering. This post covers the Restart provisioning use case only. The slim image build docs live under the RAC Docker images tree even when you use the image for Oracle Restart samples.

### Which API version should I use?

This guide targets operator **2.1** with `apiVersion: database.oracle.com/v4` and `kind: OracleRestart`. In 2.2 the `v4` API only adds optional fields (`key`, `encryptionType: base64`, `tdeWalletSecret`); the sample above is unchanged—see the version note at the top. Always match the CRD version shipped with your installed operator release.

### Can I run this without NodePort or LoadBalancer?

Yes. With ClusterIP only, applications **inside** the cluster can still connect to port 1521. External SQL\*Plus will not work until you expose the service or use a tunnel.

### Where is the official source of truth?

Oracle maintains the procedure here:

- [Provisioning an Oracle Restart Database](https://github.com/oracle/oracle-database-operator/blob/main/docs/oraclerestart/provisioning/provisioning_oracle_restart_db.md)  
- [oraclerestart_prov.yaml](https://github.com/oracle/oracle-database-operator/blob/main/docs/oraclerestart/provisioning/oraclerestart_prov.yaml)  
- [Database connection](https://github.com/oracle/oracle-database-operator/blob/main/docs/oraclerestart/provisioning/database_connection.md)  
- [Oracle Database Operator repository](https://github.com/oracle/oracle-database-operator)

---

## Closing

Provisioning Oracle Restart through the Oracle Database Operator replaces a long manual GI/DB install with a **declarative Kubernetes object**. For new users, success usually comes down to four things: **correct image**, **correct node-local disks and software paths**, **valid secrets**, and **patient verification** via setup logs—not only pod status.

Start from the official sample YAML, change only the fields that must match your lab, apply once, and follow the log until you see **ORACLE DATABASE IS READY TO USE**. From there, connect with SQL\*Plus and treat the CR as the source of desired state for future reconciles.

If you operate database platforms on Kubernetes day to day, this pattern—CRD, node-local state, ASM, and explicit readiness—is a solid template for other stateful operators as well.
