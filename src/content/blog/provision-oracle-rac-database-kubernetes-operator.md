---
title: "Provision an Oracle RAC Database on Kubernetes with Oracle Database Operator"
description: "Kubernetes/OCNE architecture for Oracle RAC: operator, RacDatabase CR, two pods, VIP/SCAN services, Multus, shared ASM; kubectl pre-flight; build slim image; provision and connect."
pubDate: 2026-08-06
updatedDate: 2026-08-06
author: "Saurabh Ahuja"
tags:
  - oracle
  - kubernetes
  - database-operator
  - oracle-rac
  - asm
  - platform-engineering
  - databases
featured: true
draft: false
---

Oracle **Real Application Clusters (RAC)** is a multi-instance, shared-cache database: several nodes share ASM storage and coordinate through a private interconnect so clients see one highly available database. On Kubernetes, the [Oracle Database Operator](https://github.com/oracle/oracle-database-operator) **RAC controller** can provision that stack through a `RacDatabase` custom resource—so you declare desired state in YAML and let the controller create pods, VIP/SCAN services, shared volumes, and software mounts.

This guide is written for **new users**: platform engineers and DBAs who know basic `kubectl` but may not have provisioned Oracle RAC via the operator before. It follows the official use case [Provisioning an Oracle RAC Database](https://github.com/oracle/oracle-database-operator/blob/main/docs/rac/provisioning/provisioning_oracle_rac_db.md) and expands it into a clear checklist, mental model, and verify-and-connect path—the same pattern as the [Oracle Restart on Kubernetes](/blog/provision-oracle-restart-database-kubernetes-operator/) post.

Sample manifests and connection steps live in the official operator repository (for example [`racdb_prov.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/rac/provisioning/racdb_prov.yaml))—same approach as the Restart guide.

**What you will achieve**

- See how **two RAC pods, VIP/SCAN services, Multus private nets, Secrets, and the operator** fit on **OCNE / OKE / any supported Kubernetes cluster**  
- Run **kubectl pre-checks** so operator, CRDs, Multus NADs, node labels, secrets, and shared disks exist **before** you apply RacDatabase  
- Build (or mirror) the slim RAC image from GitHub  
- Apply a sample `RacDatabase` CR (`racdb_prov.yaml`)  
- Confirm readiness from pod logs and `crsctl` / `srvctl`  
- Connect with SQL\*Plus (SCAN NodePort or instance listener)

---

## Architecture on Kubernetes / OCNE (pods and services)

This is **not** a diagram of RAC product internals (CSS, CRS processes inside the binary stack). It shows how the **Oracle Database Operator** integrates **Kubernetes objects**: Custom Resource → RAC controller → Pods, Services, Secrets, Multus networks, and **node-local + shared** disks/paths.

### Cluster view: what lands where

![Oracle RAC on Kubernetes architecture: operator, RacDatabase CR, namespace with two pods, VIP/SCAN services, Multus, secrets, shared ASM](/images/blog/oracle-rac-k8s-architecture.svg)

| Layer | Kubernetes objects (sample names) | Role |
|-------|-----------------------------------|------|
| Control plane (any NS) | Oracle Database Operator deployment | Watches `RacDatabase`, reconciles desired state |
| API | `RacDatabase` CR (`database.oracle.com/v4`) | Your declarative install/config |
| Workload NS (`rac`) | StatefulSets / `pod/racnode1-0`, `pod/racnode2-0` | Two RAC nodes (GI + instances) |
| Workload NS | Headless services (`racnode1-0`, VIPs, SCAN) | Stable DNS for hostnames / VIP / SCAN |
| Workload NS | `racnode-scan-lsnr` (often NodePort) | Client SQL\*Net via SCAN (e.g. **1521 → 31521**) |
| Workload NS | Secrets `ssh-key-secret`, `db-user-pass` | Referenced by CR fields |
| Workload NS | Multus `NetworkAttachmentDefinition` | Private interconnect interfaces |
| **Worker nodes** | Shared ASM devices + `racHostSwLocation` | Not free-floating pods—**labeled workers** hold disks/paths |

**OCNE / OKE note:** the object model is standard Kubernetes. RAC samples are documented heavily against **Oracle Cloud Native Environment (OCNE)** with Flannel (public) + Multus (private). On OKE or other distributions you still need a supported multi-network story for the interconnect and shared block storage for ASM. The operator and CR do not invent networks for you.

### Provision flow (you vs the cluster)

![Provision flow from pre-flight and slim image through apply, RAC controller reconcile, ready, and SCAN connect](/images/blog/oracle-rac-k8s-reconcile-flow.svg)

### Connectivity: who can open port 1521

![Client connectivity via SCAN NodePort, instance listeners, or ClusterIP to RAC pods](/images/blog/oracle-rac-k8s-connectivity.svg)

```text
Outside client ──► SCAN NodePort (workerIP:31521) ──┐
Outside client ──► Instance LSNR NodePort (:31522/…) ├──► services in NS rac ──► racnodeN-0 :1521
In-cluster app ──► ClusterIP / DNS (port 1521) ─────┘
```

Use `kubectl get all -n rac -o wide` after provision to see which path your cluster created.

---

## Who this is for (and what you should already have)

| Audience | Why this post helps |
|----------|---------------------|
| Kubernetes platform engineers | Map RAC objects to pods, Multus NADs, node labels, and shared PVs |
| Oracle DBAs new to operators | See ASM disks, GI home, SCAN, and DB name as CR fields instead of silent install scripts |
| SREs / DevOps | Get a repeatable provision path and a short readiness checklist |

**Prerequisites (typical lab or staging setup)**

1. A Kubernetes cluster with enough **CPU and memory** for **two** RAC pods (each node must meet GI/RAC minimums; sample labs often use large workers).  
2. The **Oracle Database Operator** installed and reconciling `RacDatabase` resources (`database.oracle.com`).  
3. **At least `nodeCount` worker nodes** labeled for the RAC pool (`workerNodeSelector`, e.g. `raccluster=raccluster01`).  
4. **Shared ASM-ready block devices** visible on those workers (for example `/dev/disk/by-partlabel/...`).  
5. **Multus** (or equivalent) private networks matching `privateIPDetails` in the CR.  
6. Host directories for software stage and per-node Oracle homes (`hostSwStageLocation`, `racHostSwLocation`).  
7. Kubernetes **Secrets** for SSH keys and database credentials (and TDE wallet if used).  
8. A **slim Oracle RAC container image** you build or mirror (see [Build the slim container image](#build-the-slim-container-image)).  

If the operator is not installed yet, start from [oracle/oracle-database-operator](https://github.com/oracle/oracle-database-operator) and the RAC [prerequisites](https://github.com/oracle/oracle-database-operator/blob/main/docs/rac/provisioning/prerequisites_oracle_rac_db.md). **Do not apply `racdb_prov.yaml` until every pre-check below passes.**

> **Related:** single-instance GI restartability on Kubernetes is covered in [Provision an Oracle Restart Database…](/blog/provision-oracle-restart-database-kubernetes-operator/). RAC is multi-instance clustering; Restart is not a substitute for RAC.

---

## Pre-flight checks: verify prerequisites with kubectl

Run these **before** `kubectl apply -f racdb_prov.yaml`. Adjust namespace names if your install differs from the samples (`rac` for the database CR; the operator often runs in its own namespace such as `oracle-database-operator-system`).

Set a namespace variable for the sample:

```bash
export NS=rac
```

### 1. Cluster access and API server health

```bash
kubectl cluster-info
kubectl get nodes -o wide
kubectl get --raw='/readyz?verbose' 2>/dev/null || kubectl get --raw=/readyz
```

**Expect:** at least **`nodeCount` Ready workers** (sample uses **2**) with free capacity for two Oracle RAC pods.

```bash
kubectl get nodes -o custom-columns=\
NAME:.metadata.name,\
CPU:.status.allocatable.cpu,\
MEM:.status.allocatable.memory,\
READY:.status.conditions[?\(@.type==\"Ready\"\)].status
```

### 2. Oracle Database Operator is installed and running

```bash
kubectl get ns | grep -iE 'oracle|database|operator'
kubectl get deploy -A | grep -iE 'oracle|database.operator|db-operator'
kubectl get pods -A | grep -iE 'oracle-database-operator|database-operator'
```

If you know the operator namespace:

```bash
export OP_NS=oracle-database-operator-system   # change if needed
kubectl get deploy,pods,svc -n "$OP_NS"
```

**Expect:** operator pod(s) **Running** / **Ready**, not `CrashLoopBackOff` or `ImagePullBackOff`.

```bash
kubectl logs -n "$OP_NS" -l control-plane=controller-manager --tail=50
```

### 3. RacDatabase CRD and API group are registered

The sample CR uses `apiVersion: database.oracle.com/v4` and `kind: RacDatabase`. Confirm:

```bash
kubectl api-resources | grep -iE 'racdatabase|database.oracle.com'
kubectl get crd | grep -iE 'racdatabase|database.oracle.com'
kubectl explain RacDatabase
# or:
kubectl explain racdatabase --api-version=database.oracle.com/v4
```

**Expect:** `racdatabases` (or similar) under group `database.oracle.com`, and `kubectl explain` prints a schema.

```bash
kubectl get racdatabase -A 2>/dev/null || kubectl get racdatabases.database.oracle.com -A
```

### 4. Target namespace exists (or create it)

```bash
kubectl get ns "$NS" || kubectl create namespace "$NS"
kubectl auth can-i create secrets -n "$NS"
kubectl auth can-i create racdatabases.database.oracle.com -n "$NS"
```

### 5. Multus NetworkAttachmentDefinitions exist

The sample references Multus networks by name (e.g. `macvlan-conf1`, `macvlan-conf2`) in `instanceDetails.privateIPDetails`. Those NADs must already exist in the namespace (or as your platform requires):

```bash
kubectl get network-attachment-definitions.k8s.cni.cncf.io -n "$NS"
# short form often works:
kubectl get net-attach-def -n "$NS"
kubectl describe net-attach-def macvlan-conf1 -n "$NS"
kubectl describe net-attach-def macvlan-conf2 -n "$NS"
```

**Expect:** both NADs present; `master` interfaces and IPAM ranges match your worker private NICs. Official sample: [multus-rac-conf.yaml](https://github.com/oracle/oracle-database-operator/blob/main/docs/rac/provisioning/multus-rac-conf.yaml).

### 6. Worker node labels match `workerNodeSelector`

The sample uses:

```yaml
workerNodeSelector:
  raccluster: raccluster01
```

```bash
kubectl get nodes --show-labels | grep raccluster
# Label if missing (use your real node names):
# kubectl label node <worker-1> raccluster=raccluster01
# kubectl label node <worker-2> raccluster=raccluster01
```

**Expect:** at least **2** nodes with `raccluster=raccluster01` (or your chosen key/value), **Ready**, no blocking taints.

### 7. Required Secrets exist and contain the expected keys

| CR field | Secret name (sample) | Keys the sample expects |
|----------|----------------------|-------------------------|
| `sshKeySecret` | `ssh-key-secret` | `ssh-privkey`, `ssh-pubkey` |
| `dbSecret` | `db-user-pass` | `key.pem`, `pwdfile.enc` |
| `tdeWalletSecret` | `db-user-pass` (sample reuses) | same key/pwd file names |

```bash
kubectl get secrets -n "$NS"
kubectl get secret -n "$NS" ssh-key-secret -o go-template='{{range $k,$v := .data}}{{printf "%s\n" $k}}{{end}}'
kubectl get secret -n "$NS" db-user-pass -o go-template='{{range $k,$v := .data}}{{printf "%s\n" $k}}{{end}}'
```

**Expect:** secrets present with key names matching the CR. Create them per operator docs—**never** commit passwords or private keys to git.

Official helpers:

- [Create Kubernetes Secret for DB user](https://github.com/oracle/oracle-database-operator/blob/main/docs/rac/provisioning/create_kubernetes_secret_for_db_user.md)  
- [Create Kubernetes Secret for SSH](https://github.com/oracle/oracle-database-operator/blob/main/docs/rac/provisioning/create_kubernetes_secret_for_ssh_setup.md)

### 8. Storage / CSI context (optional but useful)

```bash
kubectl get sc
kubectl get pv,pvc -A | head -50
```

ASM disks in this use case are usually **shared block devices** referenced by path; the controller creates related volume objects. Confirm devices are empty of prior ASM metadata if you are reusing lab disks.

### 9. Image pull secrets (if the image is private)

```bash
kubectl get secrets -n "$NS" | grep -iE 'docker|registry|pull'
kubectl get sa default -n "$NS" -o yaml
```

### 10. One-shot pre-flight script (copy/paste)

```bash
export NS=rac
# export OP_NS=oracle-database-operator-system

set -e
echo "== nodes =="
kubectl get nodes -o wide
kubectl get nodes --show-labels | grep -E 'NAME|raccluster' || true

echo "== RacDatabase API / CRD =="
kubectl api-resources | grep -i racdatabase || { echo "FAIL: RacDatabase API missing"; exit 1; }
kubectl get crd | grep -i racdatabase || { echo "FAIL: racdatabase CRD missing"; exit 1; }
kubectl explain RacDatabase >/dev/null

echo "== namespace =="
kubectl get ns "$NS" || { echo "FAIL: namespace $NS missing"; exit 1; }

echo "== Multus NADs (sample names) =="
kubectl get net-attach-def -n "$NS" macvlan-conf1 macvlan-conf2 2>/dev/null \
  || kubectl get network-attachment-definitions.k8s.cni.cncf.io -n "$NS"

echo "== secrets (sample names) =="
kubectl get secret -n "$NS" ssh-key-secret
kubectl get secret -n "$NS" db-user-pass
echo "SSH keys:"; kubectl get secret -n "$NS" ssh-key-secret -o go-template='{{range $k,$v := .data}}{{printf "  %s\n" $k}}{{end}}'
echo "DB keys:"; kubectl get secret -n "$NS" db-user-pass -o go-template='{{range $k,$v := .data}}{{printf "  %s\n" $k}}{{end}}'

echo "== existing RacDatabase CRs =="
kubectl get racdatabase -A 2>/dev/null || kubectl get racdatabases.database.oracle.com -A 2>/dev/null || true

echo "== operator pods (best effort) =="
kubectl get pods -A | grep -iE 'oracle-database-operator|database-operator' || echo "WARN: verify OP_NS manually"

echo "PRE-FLIGHT: API + secrets + NAD check attempted. Confirm node labels, shared ASM disks, Multus masters, and staged/slim image next."
```

### 11. Host-side checks (not kubectl—but required)

On **each** labeled worker (SSH as root or a privileged user):

```bash
# Shared ASM devices (paths must match asmDiskGroupDetails on ALL RAC workers)
ls -l /dev/disk/by-partlabel/qck-ocne19-asmdisk1 \
      /dev/disk/by-partlabel/qck-ocne19-asmdisk2
# (rename to your by-partlabel paths)

# Per-node software dirs for nodeCount=2, racNodeName=racnode
for i in 1 2; do
  dir="/scratch/rac/cluster01/racnode$i"
  ls -la "$dir" 2>/dev/null || sudo mkdir -p "$dir"
done

# Private NICs used by Multus masters (sample: ens5, ens6)
ip -br link | grep -E 'ens5|ens6|eth'
```

**Slim image path (recommended in this guide):** build/mirror the RAC slim image—you do **not** need installer zips only to *build* the slim image. Confirm the **container image** is pullable or pre-loaded on workers.

**Host-stage / non-slim path:** if your operator version still installs from staged media, also verify zips under `hostSwStageLocation` with names matching `gridSwZipFile` / `dbSwZipFile`.

Only after **kubectl pre-flight** and **host-side** checks pass should you apply the provisioning YAML.

---

## What “provision with Oracle RAC Controller” actually creates

When you apply the provisioning manifest, the controller does more than start a pod. In this use case it typically provisions:

| Artifact | Purpose |
|----------|---------|
| **2 Kubernetes pods** | RAC nodes (`racnode1-0`, `racnode2-0` for `nodeCount: 2`) |
| **Headless services** | RAC node hostname, VIP service, SCAN service |
| **SCAN / listener services** | Often NodePort for external SQL\*Net |
| **Shared ASM storage** | PVs derived from disks under `asmDiskGroupDetails` |
| **Software host paths** | `racHostSwLocation` per node; optional stage path for zips |
| **Namespace** | Sample flows use namespace `rac` |

Two host path concepts appear in the sample CR:

- **`hostSwStageLocation`** — staged Grid / RDBMS zip files on workers when using host-stage installs.  
- **`racHostSwLocation`** — base directory for GI HOME and RDBMS HOME; per-node dirs look like `<racHostSwLocation>/<racNodeName><n>` (e.g. `/scratch/rac/cluster01/racnode1`).

Think of the flow as: **build/push slim image → Multus + labels + shared disks + secrets → apply CR → controller configures GI/RAC → ASM DATA → database ready**.

---

## Build the slim container image

### Image reference in the sample

Official samples use a tag like:

```text
dbocir/oracle/database-rac:19.3.0-slim
```

Treat that as **“put your built or mirrored image reference here”** unless your environment already has that image reachable.

### Where to build from (GitHub)

Official slim build docs:

- [Building Oracle RAC Database container slim image](https://github.com/oracle/docker-images/tree/main/OracleDatabase/RAC/OracleRealApplicationClusters#building-oracle-rac-database-container-slim-image)  
- Path: [`OracleDatabase/RAC/OracleRealApplicationClusters`](https://github.com/oracle/docker-images/tree/main/OracleDatabase/RAC/OracleRealApplicationClusters)

The operator provisioning doc points at the same tree ([provisioning guide](https://github.com/oracle/oracle-database-operator/blob/main/docs/rac/provisioning/provisioning_oracle_rac_db.md)).

### Slim build vs host-stage zips

| Build / install style | Need `grid_home.zip` / `db_home.zip` on the build host? |
|----------------------|---------------------------------------------------------|
| **Slim image** (GitHub slim target) | **No** for the slim *image build* itself |
| Host-stage install driven by CR zip fields | **Yes** — stage media on workers at `hostSwStageLocation` |

For this blog’s **recommended path for new users**:

1. Clone `oracle/docker-images` and follow the slim README.  
2. Build the **slim** image (Podman/Docker as documented).  
3. Tag/push to a registry workers can pull, **or** load onto each target node.  
4. Set `spec.image` in `racdb_prov.yaml` to **exactly** that reference.  
5. Prefer `imagePullPolicy: IfNotPresent` when pre-loaded; use `Always` when pulling a new digest.

```text
# After a successful local slim build (illustrative):
localhost/oracle/database-rac:19.3.0-slim

podman tag localhost/oracle/database-rac:19.3.0-slim \
  <your-registry>/oracle/database-rac:19.3.0-slim
```

A wrong image name is still the most common `ImagePullBackOff`—especially if you left the sample tag as-is without building or mirroring anything.

---

## Understand the sample Custom Resource

Official sample: [`racdb_prov.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/rac/provisioning/racdb_prov.yaml).

High-level structure:

```yaml
apiVersion: database.oracle.com/v4
kind: RacDatabase
metadata:
  name: racdbprov-sample
  namespace: rac
spec:
  instanceDetails:
    nodeCount: 2
    racHostSwLocation: /scratch/rac/cluster01
    racNodeName: racnode
    privateIPDetails:
      - name: macvlan-conf1
        interface: ens1
      - name: macvlan-conf2
        interface: ens2
    workerNodeSelector:
      raccluster: raccluster01
  asmDiskGroupDetails:
    - name: DATA
      redundancy: EXTERNAL
      type: CRSDG
      disks:
        - /dev/disk/by-partlabel/qck-ocne19-asmdisk1
        - /dev/disk/by-partlabel/qck-ocne19-asmdisk2
  sshKeySecret:
    name: ssh-key-secret
    privKeySecretName: ssh-privkey
    pubKeySecretName: ssh-pubkey
  dbSecret:
    name: db-user-pass
    keyFileName: key.pem
    pwdFileName: pwdfile.enc
  tdeWalletSecret:
    name: db-user-pass
    keyFileName: key.pem
    pwdFileName: pwdfile.enc
  image: dbocir/oracle/database-rac:19.3.0-slim
  imagePullPolicy: Always
  scanSvcName: racnode-scan
  scanSvcTargetPort: 31521
  serviceDetails:
    name: soepdb
  configParams:
    gridHome: "/u01/app/19c/grid"
    gridBase: "/u01/app/grid"
    dbHome: "/u01/app/oracle/product/19c/dbhome_1"
    dbBase: "/u01/app/oracle"
    inventory: "/u01/app/oraInventory"
    gridSwZipFile: "grid_home.zip"
    dbSwZipFile: "db_home.zip"
    dbName: "PORCLCDB"
    hostSwStageLocation: /scratch/software/stage/19c/19.28GoldImageSoftware
```

### Fields new users should edit first

| Field | What to put |
|-------|-------------|
| `metadata.namespace` | Namespace you prepared (sample: `rac`) |
| `instanceDetails.nodeCount` | Number of RAC nodes (sample: **2**) |
| `instanceDetails.workerNodeSelector` | Label key/value already on workers |
| `instanceDetails.racHostSwLocation` | Host base path for GI/DB homes |
| `instanceDetails.racNodeName` | Hostname prefix (`racnode` → `racnode1-0`, …) |
| `instanceDetails.privateIPDetails` | Multus NAD names + pod interface names |
| `asmDiskGroupDetails[].disks` | **Shared** stable device paths on workers |
| `image` | Your registry/tag |
| `sshKeySecret` / `dbSecret` | Secrets that already exist in the namespace |
| `configParams.dbName` | CDB name (sample: `PORCLCDB`) |
| `serviceDetails.name` | App service / PDB-oriented name (`soepdb`) |
| `scanSvcName` / `scanSvcTargetPort` | SCAN service naming and NodePort target |
| `configParams.hostSwStageLocation` | Host stage path if using zip-based install |

### ASM disk group example

```yaml
asmDiskGroupDetails:
  - name: DATA
    redundancy: EXTERNAL
    type: CRSDG
    disks:
      - /dev/disk/by-partlabel/qck-ocne19-asmdisk1
      - /dev/disk/by-partlabel/qck-ocne19-asmdisk2
```

Use **by-partlabel** (or another **stable** path). `/dev/sdb`-style names can change after reboot. Disks must be **shared** across the RAC workers. `EXTERNAL` redundancy is common for lab when storage already mirrors; production choices follow your storage design and Oracle guidance.

### Optional prereq-ignore environment variables

The sample comments optional env vars such as `IGNORE_CRS_PREREQS` and `IGNORE_DB_PREREQS`. Only enable these when you understand the risk. Prefer fixing real OS/kernel gaps in production-like environments.

---

## Step-by-step: deploy 2-node Oracle RAC

**Stop if pre-flight failed.** Re-run the [Pre-flight checks](#pre-flight-checks-verify-prerequisites-with-kubectl) until CRDs, Multus, labels, secrets, and capacity are green.

### 1. Prepare worker nodes

On each labeled worker:

- Confirm **shared** ASM disks exist and are not mounted as ordinary filesystems.  
- Ensure Multus masters (e.g. `ens5`/`ens6`) match your NAD config.  
- Create host software directories under `racHostSwLocation` for each node index.  
- Ensure the **slim** container image is present or pullable.  

Example directory prep (from official prerequisites):

```bash
for i in $(seq 1 2); do
  dir="/scratch/rac/cluster01/racnode$i"
  sudo mkdir -p "$dir"
  sudo chown -R 54321:54321 "$dir"
  sudo chcon -R -t container_file_t "$dir" 2>/dev/null || true
done
```

### 2. Create namespace, Multus NADs, and secrets (if not already done)

```bash
kubectl get ns rac || kubectl create namespace rac
kubectl apply -f multus-rac-conf.yaml   # adjust master NICs / subnets first
# Create SSH and DB secrets per operator documentation
kubectl get secrets -n rac
kubectl get net-attach-def -n rac
```

### 3. Label worker nodes

```bash
kubectl label node <worker-1> raccluster=raccluster01 --overwrite
kubectl label node <worker-2> raccluster=raccluster01 --overwrite
kubectl get nodes --show-labels | grep raccluster
```

### 4. Apply the RacDatabase resource

```bash
kubectl api-resources | grep -i racdatabase
kubectl apply -f racdb_prov.yaml
```

Expected-style response:

```text
racdatabase.database.oracle.com/racdbprov-sample created
```

### 5. Watch Kubernetes objects

```bash
kubectl get all -n rac -o wide
kubectl get racdatabase -n rac
kubectl describe racdatabase racdbprov-sample -n rac
```

You should eventually see StatefulSets/pods `racnode1-0` and `racnode2-0`, plus SCAN/VIP/headless services.

### 6. Follow database setup logs

Official readiness signal is inside the pod setup log:

```bash
kubectl exec -it pod/racnode1-0 -n rac -- bash -c "tail -f /tmp/orod/oracle_db_setup.log"
```

When provisioning succeeds, look for:

```text
===================================
ORACLE RAC DATABASE IS READY TO USE
===================================
```

Keep that session open during first install; multi-node GI and RAC configuration can take a long time on cold nodes.

### 7. Validate CRS and database from inside the pods

```bash
kubectl exec -it pod/racnode1-0 -n rac -- bash
# as grid:
# /u01/app/19c/grid/bin/crsctl stat res -t
# as oracle:
# srvctl status database -d PORCLCDB -v
# srvctl config service -s soepdb -d PORCLCDB
```

Prefer operator **status** + setup log + `crsctl`/`srvctl` over guessing from pod phase alone—`Running` does not always mean “database open on all instances.”

---

## Connect to the database

After readiness, connectivity depends on how services were exposed. Full detail: [Database Connectivity (RAC)](https://github.com/oracle/oracle-database-operator/blob/main/docs/rac/provisioning/database_connection.md).

### Discover service type and ports

```bash
kubectl get all -n rac -o wide
```

Example patterns from official NodePort-style deployments:

| Service | How clients connect |
|---------|---------------------|
| **SCAN NodePort** (`racnode-scan-lsnr`) | `<worker-ip>:<nodePort>` maps to SCAN listener (e.g. **31521 → 1521**) |
| **Instance LSNR NodePort** | Direct instance ports (e.g. **31522**, **31523**) |
| **ClusterIP only** | Only workloads **inside** the cluster can reach port 1521 |

Open NodePorts for ingress on worker firewalls/security lists.

### SQL\*Plus — SCAN NodePort example

Map worker public IPs to SCAN / node hostnames in the client `/etc/hosts` if required by your network design, then:

```bash
sqlplus system/<Database Password>@//<Worker Public IP>:31521/soepdb
```

### SQL\*Plus — instance listener example

```bash
sqlplus system/<Database Password>@//<Worker1 Public IP>:31522/soepdb
```

### Sanity query (must show RAC)

```sql
set lines 200
col HOST_NAME format a40
select INSTANCE_NAME, HOST_NAME, DATABASE_TYPE from gv$instance;
```

You should see **DATABASE_TYPE = RAC** with instances such as `PORCLCDB1` / `PORCLCDB2` on `racnode1-0` / `racnode2-0`—not a single-instance Restart database.

---

## Troubleshooting checklist (first-time failures)

| Symptom | Likely cause | What to check |
|---------|--------------|---------------|
| `ImagePullBackOff` | Wrong image/tag or registry auth | `kubectl describe pod`; fix `spec.image` / pull secrets |
| Pod pending / not scheduled | Missing node label, capacity, taints | `workerNodeSelector`, CPU/memory on ≥2 nodes |
| Setup stuck on network | Multus NAD wrong / no private NICs | NAD masters, IPAM ranges, `privateIPDetails` names |
| Setup log stuck on storage | Disk path wrong or not shared | Device on **all** RAC workers; by-partlabel paths |
| Setup fails on software | Missing zips or bad stage path | Files present; names match zip fields (host-stage) |
| Secret errors | Missing keys in Secret | `sshKeySecret` / `dbSecret` mapping |
| Cannot connect remotely | Service type / firewall | SCAN NodePort open; `/etc/hosts` for SCAN names |
| Only one instance | Cluster incomplete / CRS issue | `crsctl stat res -t` on both pods; setup log |
| OOM or crash loops | Memory vs SGA/HugePages | Node HugePages, pod limits, operator resource samples |

Always combine:

```bash
kubectl get events -n rac --sort-by='.lastTimestamp'
kubectl logs -n rac pod/racnode1-0 --tail=200
kubectl logs -n rac pod/racnode2-0 --tail=200
```

with `/tmp/orod/oracle_db_setup.log` for install-specific errors. See also [Debugging and troubleshooting](https://github.com/oracle/oracle-database-operator/blob/main/docs/rac/provisioning/debugging.md).

---

## Security and operations notes

- Treat `dbSecret` material and SSH private keys as **production secrets**: short-lived access, encrypted etcd, least-privilege RBAC.  
- Prefer private registries and image digest pins for repeatable builds.  
- Host paths and shared ASM couple the database to **specific labeled workers**—plan backup, drain, and maintenance accordingly; this is not a free-floating multi-AZ app pod.  
- Multus private networks are part of the security and availability design; isolate interconnect traffic.  
- Do not enable ignore-prereq flags in regulated environments without a written exception.  
- Cleanup: `kubectl delete -f racdb_prov.yaml` does not always wipe host dirs or ASM disks—clear `racHostSwLocation` and shared disks before reusing the lab.

---

## SEO-friendly takeaways (quick reference)

**Primary question:** *How do I provision Oracle RAC Database on Kubernetes?*  
**Answer:** Install the Oracle Database Operator, prepare Multus private networks, label workers, attach shared ASM disks and host software paths, create secrets, apply a `RacDatabase` custom resource (sample `racdb_prov.yaml`), wait for `ORACLE RAC DATABASE IS READY TO USE` in the setup log, then connect via SCAN NodePort (or in-cluster DNS) using the service name (for example `soepdb`).

**Keywords covered naturally:** Oracle RAC Kubernetes, Oracle Database Operator, RacDatabase CRD, Multus Oracle RAC, ASM diskgroup on Kubernetes, provision Oracle 19c RAC, SCAN NodePort SQL\*Plus, Oracle RAC OCNE.

---

## FAQ

### Is Oracle RAC the same as Oracle Restart on Kubernetes?

No. **Oracle Restart** is single-instance Oracle Database managed by Grid Infrastructure (ASM, restartability). **RAC** is multi-instance clustering with a private interconnect and shared storage. See the [Restart provisioning blog](/blog/provision-oracle-restart-database-kubernetes-operator/) for the single-instance path.

### Is the slim RAC image always pullable from a public registry?

Samples reference tags such as `dbocir/oracle/database-rac:19.3.0-slim`. Environments differ—**build from GitHub** or mirror into your registry when the sample tag is not reachable. Follow [Building Oracle RAC Database container slim image](https://github.com/oracle/docker-images/tree/main/OracleDatabase/RAC/OracleRealApplicationClusters#building-oracle-rac-database-container-slim-image).

### Do I need Multus for RAC?

Yes for the supported private interconnect model in the official OCNE-oriented docs. Public pod networking alone is not a substitute for the RAC interconnect. Configure Multus (macvlan/ipvlan) NADs before apply.

### Which API version should I use?

The current sample uses `apiVersion: database.oracle.com/v4` and `kind: RacDatabase`. Always match the CRD version shipped with your installed operator release.

### Can I run this without NodePort?

Yes. With ClusterIP only, applications **inside** the cluster can still connect. External SQL\*Plus needs NodePort/LoadBalancer exposure or a tunnel. See [provisioning with Node Port](https://github.com/oracle/oracle-database-operator/blob/main/docs/rac/provisioning/provisioning_oracle_rac_db_with_node_port.md).

### Where is the official source of truth?

- [Provisioning an Oracle RAC Database](https://github.com/oracle/oracle-database-operator/blob/main/docs/rac/provisioning/provisioning_oracle_rac_db.md)  
- [racdb_prov.yaml](https://github.com/oracle/oracle-database-operator/blob/main/docs/rac/provisioning/racdb_prov.yaml)  
- [Prerequisites](https://github.com/oracle/oracle-database-operator/blob/main/docs/rac/provisioning/prerequisites_oracle_rac_db.md)  
- [Database connection](https://github.com/oracle/oracle-database-operator/blob/main/docs/rac/provisioning/database_connection.md)  
- [RAC README / QuickStart](https://github.com/oracle/oracle-database-operator/blob/main/docs/rac/README.md)  
- [Oracle Database Operator repository](https://github.com/oracle/oracle-database-operator)

---

## Closing

Provisioning Oracle RAC through the Oracle Database Operator replaces a long multi-node GI/DB install with a **declarative Kubernetes object**—but only after Multus, labels, shared disks, secrets, and image plumbing are honest. For new users, success usually comes down to five things: **correct image**, **correct Multus private nets**, **shared ASM paths on labeled workers**, **valid secrets**, and **patient verification** via setup logs plus `crsctl`/`srvctl`—not only pod status.

Start from the official sample YAML, change only the fields that must match your environment, apply once, and follow the log until you see **ORACLE RAC DATABASE IS READY TO USE**. From there, connect with SQL\*Plus through SCAN and treat the CR as the source of desired state for future reconciles (scale-out, ASM disks, and related lifecycle operations are covered in the upstream RAC docs).

If you already shipped the [Oracle Restart](/blog/provision-oracle-restart-database-kubernetes-operator/) path, this RAC guide is the natural next step on the same operator platform—with more networking and shared storage discipline up front.
