---
title: "Provision an Oracle Restart Database on Kubernetes with Oracle Database Operator"
description: "Step-by-step guide for new users: deploy Oracle Restart (Grid Infrastructure + single-instance Oracle Database) on Kubernetes using the Oracle Database Operator OracleRestart CR, ASM disks, secrets, and SQL*Plus connectivity."
pubDate: 2026-07-30
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

**What you will achieve**

- Understand what the Oracle Restart Controller creates on the cluster  
- Build or tag a slim Oracle Restart container image  
- Apply a sample `OracleRestart` CR (`oraclerestart_prov.yaml`)  
- Confirm readiness from pod logs and CR status  
- Connect with SQL\*Plus (NodePort or LoadBalancer)

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
7. Container image access: either a registry-hosted slim image or a locally built RAC/ORestart slim image.

If the operator is not installed yet, start from the project root documentation in [oracle/oracle-database-operator](https://github.com/oracle/oracle-database-operator) before applying the Restart CR.

---

## What “provision with Oracle Restart Controller” actually creates

When you apply the provisioning manifest, the controller does more than start a pod. In this use case it typically provisions:

| Artifact | Purpose |
|----------|---------|
| **Oracle Restart pod** | Runs Grid Infrastructure + database processes inside the container/pod model |
| **Headless services** | Stable DNS for the Oracle Restart node hostname inside the cluster |
| **ASM-backed storage** | Persistent volumes derived from the disks you list under `asmDiskGroupDetails` |
| **Software host paths** | Staged GI/RDBMS zips and installed homes mounted from the worker node |
| **Namespace** | Sample flows use namespace `orestart` |

Two host paths matter for first-time setup:

- **`hostSwStageLocation`** — where Grid Infrastructure and RDBMS binaries (zip files) are staged on the **worker node**.  
- **`hostSwLocation`** — where GI HOME and RDBMS HOME live on the worker; the Oracle Restart pod mounts these paths.

Think of it as: **stage software on the node → controller installs/configures via the CR → ASM disks form the DATA diskgroup → database becomes ready**.

---

## Build or choose the container image

The sample provisioning flow uses a slim Oracle Restart image, for example:

```text
dbocir/oracle/database-orestart:19.3.0-slim
```

Oracle documents building related slim RAC/ORestart images from the [Oracle Docker images RAC tree](https://github.com/oracle/docker-images/tree/main/OracleDatabase/RAC/OracleRealApplicationClusters#building-oracle-rac-database-container-slim-image). A default local build is often tagged like:

```text
localhost/oracle/database-rac:19.3.0-slim
```

**Practical tips for new users**

1. Build once, then **retarget** the image name you put in the CR (`image:` field).  
2. Push to your private registry if workers cannot pull from your laptop.  
3. Prefer `imagePullPolicy: IfNotPresent` for large local images; use `Always` when you intentionally roll a new registry digest.  
4. Update `oraclerestart_prov.yaml` (or your own CR) so `spec.image` matches the image you actually built.

A wrong image name is the most common “pod stuck in ImagePullBackOff” failure—fix image reference before chasing ASM or SSH secrets.

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

### 1. Prepare the worker node

On the chosen worker:

- Confirm ASM disks exist and are not mounted as ordinary filesystems.  
- Create stage and software directories with permissions expected by your operator/docs.  
- Place `grid_home.zip` and `db_home.zip` under `hostSwStageLocation`.  
- Ensure the node can pull (or already has) the container image.

### 2. Create namespace and secrets

```bash
kubectl create namespace orestart
# Create SSH and DB credential secrets per operator documentation
# kubectl apply -f your-secrets.yaml
```

Secret shape must match `sshKeySecret` and `dbSecret` field names in the CR.

### 3. Apply the OracleRestart resource

Use the official sample or your customized copy:

```bash
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

### Is Oracle Restart the same as Oracle RAC on Kubernetes?

No. **Oracle Restart** is single-instance Oracle Database managed by Grid Infrastructure (ASM, restartability). **RAC** is multi-instance clustering. This post covers the Restart provisioning use case only.

### Which API version should I use?

The current sample uses `apiVersion: database.oracle.com/v4` and `kind: OracleRestart`. Always match the CRD version shipped with your installed operator release.

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
