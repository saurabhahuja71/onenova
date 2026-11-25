---
title: "Deploy Oracle True Cache on Kubernetes Next to Your Apps (RAC Primary Outside the Cluster)"
description: "New-user architecture guide: Oracle True Cache SIDB in OKE beside your app, Oracle RAC primary outside, Database Operator 2.2, blob ConfigMap, private NLB + ExternalDNS, dual JDBC pools, and verification."
pubDate: 2026-11-25
author: "Saurabh Ahuja"
tags:
  - oracle
  - true-cache
  - kubernetes
  - database-operator
  - oracle-rac
  - oke
  - platform-engineering
  - databases
  - maa
featured: true
draft: false
heroImage: "/images/blog/oracle-truecache-k8s-architecture.svg"
---

Oracle **True Cache** is a mostly diskless, read-only, in-memory SQL and JSON cache for Oracle AI Database. It keeps frequently read data close to the application, stays consistent through automatic redo apply (similar in spirit to Active Data Guard), and offloads read traffic from the primary without hand-written cache load and invalidation code.

On Kubernetes, the [Oracle Database Operator](https://github.com/oracle/oracle-database-operator) provisions True Cache as a `SingleInstanceDatabase` custom resource with `createAs: truecache`. You declare desired state in YAML; the SIDB controller creates the pod, storage, ClusterIP service, and (for remote primaries) an OCI Network Load Balancer path the primary can call back into.

This guide is written for **new users**: platform engineers, DBAs, and application owners who know basic `kubectl` but have not yet placed True Cache next to a Kubernetes application with an **Oracle RAC primary outside the cluster**. It expands the short Oracle Database Insider post and the MAA PDF into the same checklist-and-mental-model style as the [Oracle Restart](/blog/provision-oracle-restart-database-kubernetes-operator/) and [Oracle RAC](/blog/provision-oracle-rac-database-kubernetes-operator/) posts on OneNova.

> **Contributor note.** I work on Oracle Database Operator for Kubernetes and contributed to the Maximum Availability Architecture (MAA) material behind this pattern, including the operator True Cache documentation and samples. Official sources of truth:
>
> - Operator True Cache docs (SIDB): [docs/sidb § True Cache](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb#true-cache)
> - Detailed runbook: [`docs/sidb/truecache/TRUECACHE.md`](https://github.com/oracle/oracle-database-operator/blob/main/docs/sidb/truecache/TRUECACHE.md)
> - External RAC sample: [`singleinstancedatabase_truecache_external_rac.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/config/samples/sidb/singleinstancedatabase_truecache_external_rac.yaml)
> - MAA guide: [Deploying Oracle True Cache on Kubernetes with an Oracle RAC Database Primary (PDF)](https://www.oracle.com/a/otn/docs/deploy-truecache-k8s-for-oracle-rac.pdf)
> - Short overview: [Bring Oracle True Cache Closer to Your Kubernetes Applications](https://blogs.oracle.com/database/bring-oracle-true-cache-closer-to-your-kubernetes-applications)

**What you will achieve**

- Build a clear mental model of **app + True Cache in OKE**, **RAC primary outside**, and the **callback path** through private NLB + DNS  
- Know which operator path to pick: same-cluster SIDB primary vs remote/external RAC  
- Run **pre-flight checks** (network, secrets, blob, ExternalDNS, operator ≥ 2.2)  
- Apply the official external RAC sample and watch logs until **DATABASE IS READY TO USE**  
- Verify with `v$database`, `v$true_cache`, and service association  
- Point a read-only JDBC/UCP pool at the in-cluster True Cache service  

> **Operator version:** this post targets **Oracle Database Operator 2.2.0+** and the `database.oracle.com/v4` `SingleInstanceDatabase` API. True Cache needs a **True Cache capable Enterprise** image (Oracle AI Database 26ai / 23ai RU line used in the samples). Prefer `spec.services.endpoints` over the legacy `services.external` shape.

---

## Why put True Cache in the same cluster as the app?

Read-heavy services in Kubernetes often pay a fixed network round-trip to a remote primary. With a **10 ms RTT** to the database tier, every cache miss and every uncached read pays that tax. Collocating True Cache with the application keeps SQL reads on the cluster network while the primary still owns writes and redo.

| Benefit | What it means in practice |
|---------|---------------------------|
| Lower read latency | RO pool talks to ClusterIP / in-cluster DNS instead of crossing to the DB subnet for every query |
| Primary offload | Redo and block fetch still hit the primary; bulk RO query volume does not |
| One operations plane | Same deploy, secrets, monitoring, and network policies as the app |
| Placement control | `nodeSelector` / dedicated workers, CPU and memory limits for the cache pod |
| No custom cache code | Full SQL/JSON (and related Oracle types) with automatic consistency |

True Cache is included with Oracle AI Database **Enterprise Edition** licensing in the product model described by Oracle; you still need a True Cache capable image and a correctly prepared primary (ARCHIVELOG, TDE wallet material in the blob, and network reachability).

---

## Architecture: Kubernetes objects, not product internals

This section maps **operator + CR → pods, services, ConfigMaps, NLB, DNS**. It is not a diagram of every True Cache kernel process.

### Cluster view: what lands where

![Oracle True Cache on Kubernetes with external RAC primary](/images/blog/oracle-truecache-k8s-architecture.svg)

| Layer | Example objects | Role |
|-------|-----------------|------|
| Control plane | Oracle Database Operator (SIDB controller) | Watches `SingleInstanceDatabase`, reconciles True Cache |
| API | SIDB CR `createAs: truecache` | Your declarative cache instance |
| Workload NS (`tcdboper`) | Pod `tck8node1-*` | Runs Enterprise True Cache image |
| Workload NS | `svc/tck8node1` ClusterIP `:1521` | In-cluster app RO traffic |
| Workload NS | `svc/tck8node1-lb` LoadBalancer (OCI **NLB**) | Primary callback + optional external clients |
| Workload NS | Secrets + blob ConfigMap | Admin/TDE passwords, OCR pull, primary wallet/pwdfile blob |
| Outside cluster | Oracle RAC on Base Database Service (or other RAC) | Primary of record; SCAN service for RW |
| DNS | Private zone + ExternalDNS | Maps TC hostname to NLB private IP |

**Subnet layout (OCI example from the MAA guide)**

- `appsubnet` — OKE worker nodes (application + True Cache pods)  
- `svcsubnet` — Kubernetes Services / NLB frontends  
- `dbsubnet` — RAC primary  

Workers need **1521** and **6200** (ONS) toward the primary. The primary needs **1521** toward the services subnet (NLB). The services subnet needs the NodePort range toward workers when OKE programs NLB → NodePort.

### Provision flow (you vs the cluster)

![True Cache provision flow](/images/blog/oracle-truecache-k8s-reconcile-flow.svg)

### Connectivity: who opens port 1521

![True Cache connectivity paths](/images/blog/oracle-truecache-k8s-connectivity.svg)

```text
App RW pool  ──► RAC SCAN:1521 / myappsvc.example.com
App RO pool  ──► svc/tck8node1 ClusterIP:1521 / tcokenodes.example.com
RAC primary  ──► private NLB hostname:1521 / TCK8DB1_FRA…   (redo / callback)
```

**Use an OCI Network Load Balancer**, not an OCI Application (HTTP) Load Balancer, for the True Cache listener. Database sessions are long-lived Layer-4 TCP; NLB matches that traffic profile.

---

## Choose the right True Cache path

The operator supports several topologies. Pick **one**; do not mix fields from different samples.

| Primary location | Source field | Blob | Start here |
|------------------|--------------|------|------------|
| SIDB, same cluster/namespace, TCP | `primarySource.databaseRef` | Primary SIDB generates ConfigMap | [True Cache Quick Start](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb#true-cache-quick-start) |
| SIDB, same cluster, TCPS | `databaseRef` + TCPS secrets | Primary generates ConfigMap | [True Cache with TDE and TCPS](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb#true-cache-setup-with-tde-and-tcps) |
| SIDB in another cluster | `primarySource.connectString` | Copy blob ConfigMap | [Remote primary](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb#create-true-cache-for-a-remote-primary) |
| **External host SI or RAC** (this post) | `primarySource.connectString` | **DBCA on primary** → ConfigMap | [`TRUECACHE.md` § remote host](https://github.com/oracle/oracle-database-operator/blob/main/docs/sidb/truecache/TRUECACHE.md) + [`*_external_rac.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/config/samples/sidb/singleinstancedatabase_truecache_external_rac.yaml) |

This OneNova post focuses on the **external RAC + OKE** production-style pattern from the MAA PDF. For a laptop or all-in-Kubernetes lab, start with the same-cluster Quick Start first—fewer networking moving parts.

---

## Who this is for (and what you should already have)

| Audience | Why this post helps |
|----------|---------------------|
| Kubernetes platform engineers | Map True Cache to SIDB CR, NLB annotations, ExternalDNS, secrets |
| Oracle DBAs new to operators | See blob, `trueCacheServices`, and callback hostname as CR fields |
| App / middleware owners | Wire dual UCP/JDBC pools without inventing a custom cache layer |
| SREs | Get a repeatable verify checklist (`v$true_cache`, READY TO USE) |

**Prerequisites (external RAC path)**

1. OKE (or compatible Kubernetes) with Oracle Database Operator **≥ 2.2.0** and cert-manager.  
2. Oracle RAC primary on **26ai RU 23.26.4+** (or earlier 23.26.x with the one-off for bug **38769688** when EEHP/EEEP primary talks to EE True Cache in Kubernetes).  
3. Primary in **ARCHIVELOG** mode; custom PDB application service (example `myappsvc.example.com`).  
4. Namespace for True Cache (example `tcdboper`), OCR image-pull secret, admin and TDE secrets matching the primary.  
5. True Cache **blob** produced on the primary with DBCA and loaded as a ConfigMap.  
6. Private DNS zone + ExternalDNS (workload identity) so the primary can resolve the TC NLB hostname.  
7. Security lists / NSGs for the ports in the architecture table.  
8. Enterprise True Cache capable container image from OCR (authenticated pull).

Related OneNova posts for operator fundamentals: [Provision Oracle Restart…](/blog/provision-oracle-restart-database-kubernetes-operator/) and [Provision Oracle RAC…](/blog/provision-oracle-rac-database-kubernetes-operator/).

---

## Mental model for new users

### What True Cache is (and is not)

| True Cache **is** | True Cache **is not** |
|--------------------|------------------------|
| A read-only Oracle instance kept current by redo | A generic key-value Redis replacement you populate by hand |
| SQL/JSON accessible with ordinary drivers | A writeable replica for OLTP writes |
| Associated with primary services for smart routing options | A substitute for RAC high availability of the primary |
| Deployable as SIDB `createAs: truecache` | The same CR as `RacDatabase` / `OracleRestart` |

### The blob ConfigMap

Every True Cache create needs a **configuration blob** (TDE wallet + password file material from the primary). Paths differ:

- **In-cluster primary SIDB:** set `trueCache.generateBlob` / `createConfigMap` on the primary; wait for ConfigMap `<primary>-truecache-blob`.  
- **External RAC:** run DBCA on the primary, copy the `.tar.gz` into the cluster as a ConfigMap, reference it from the True Cache CR.

Without the blob in the True Cache namespace, apply will not succeed.

### Service mapping string

`trueCache.trueCacheServices` entries look like:

```text
PRIMARY_PDB_NAME:PRIMARY_SERVICE_NAME:TRUECACHE_SERVICE_NAME
```

Example:

```yaml
trueCacheServices:
  - "PDB1:myappsvc.example.com:tcokenodes.example.com"
```

- First token: primary **PDB name** (validated at runtime).  
- Middle token: exact **listener-registered primary PDB service** (may be domain-qualified on RAC).  
- Last token: True Cache service created in the mapped True Cache PDB for RO clients.

### Application connection methods

Oracle documents multiple methods. The MAA example uses **two physical connections**:

1. General pool → primary SCAN + `myappsvc.example.com` (writes / general).  
2. Read-only pool → in-cluster True Cache hostname + `tcokenodes.example.com`.

The **one logical connection** method needs primary↔True Cache **service association**. With `autoTCServiceRegistration: true`, the operator/image drive association via a helper script on the primary (`configure-primary-truecache-service.sh`) and DBMS_SCHEDULER. External RAC does **not** ship that helper inside an OCR SIDB image—you must install it on every RAC node and satisfy `externaljob.ora` prerequisites. Manual association remains the supported fallback. Details: [Advanced True Cache association](https://github.com/oracle/oracle-database-operator/blob/main/docs/sidb/truecache/TRUECACHE.md#advanced-true-cache-association) and [True Cache User’s Guide — Methods for Connecting](https://docs.oracle.com/en/database/oracle/oracle-database/23/odbtc/methods-connecting-oracle-true-cache.html).

---

## Pre-flight checks

Adjust names (`tcdboper`, `tck8node1`) to match your manifests.

```bash
export NS=tcdboper
export TRUECACHE=tck8node1
```

### 1. Cluster and operator

```bash
kubectl cluster-info
kubectl get nodes -o wide
kubectl get deploy,pods -n oracle-database-operator-system
kubectl get crd singleinstancedatabases.database.oracle.com
```

**Expect:** operator pods Ready; SIDB CRD present; operator watches `$NS` (namespace-scoped install scripts must list it).

### 2. Namespace, secrets, blob

```bash
kubectl get ns "$NS"
kubectl get secret -n "$NS" ocr-pull db-admin-secret tde-wallet-secret
kubectl get configmap -n "$NS" orcl-primary-truecache-blob -o yaml | head
```

**Expect:** ConfigMap key matches `trueCache.blobConfigMapKey` in the CR (sample often `tc_config_blob.tar.gz` or the DBCA timestamped name).

### 3. Primary reachability from a worker / debug pod

From a pod on the worker network (or after True Cache pod exists):

```bash
# Replace with your SCAN and service
nc -vz drdbrac15a-scan.dbsubnet.example.oraclevcn.com 1521
```

On the primary, confirm ARCHIVELOG, open wallet, and the PDB service:

```sql
SELECT log_mode FROM v$database;
SELECT name, open_mode FROM v$pdbs;
SELECT name FROM v$services;
```

### 4. DNS and ExternalDNS

```bash
kubectl get deploy,pods -n external-dns
# After NLB exists, primary must resolve the annotated hostname
```

Private view for the TC zone must be attached to the **database VCN resolver** so RAC nodes resolve `tck8node1.tcinternal.example.com` (or your name) to the NLB IP.

### 5. Network rules (summary)

| Source | Destination | Ports | Purpose |
|--------|-------------|-------|---------|
| Worker / app subnet | DB subnet | 1521, 6200 | App + TC → primary listener / ONS |
| DB subnet | Services subnet | 1521 | Primary → TC NLB |
| Services subnet | Worker NodePorts | 30000–32767 | NLB → pod (OKE may auto-add) |

---

## Prepare the primary RAC database

1. Confirm RU / one-off **38769688** if required for your EEHP/EEEP ↔ EE True Cache combination.  
2. Ensure ARCHIVELOG.  
3. Create and start an application service on the PDB if you do not already have one:

```bash
srvctl add service -db "$ORACLE_UNQNAME" -service myappsvc.example.com \
  -preferred PRIDB1,PRIDB2 -pdb PDB1
srvctl modify service -db "$ORACLE_UNQNAME" -service myappsvc.example.com \
  -rlbgoal SERVICE_TIME -clbgoal SHORT
srvctl start service -d "$ORACLE_UNQNAME" -s myappsvc.example.com
srvctl status service -d "$ORACLE_UNQNAME" -s myappsvc.example.com
```

4. Generate the True Cache blob on the primary:

```bash
$ORACLE_HOME/bin/dbca -configureDatabase \
  -prepareTrueCacheConfigFile \
  -sourceDB "$ORACLE_UNQNAME" \
  -trueCacheBlobLocation /tmp/primary_db_config_blob/ \
  -silent
```

5. Copy the generated `.tar.gz` to your kubectl host and create the ConfigMap:

```bash
kubectl create namespace tcdboper   # if needed

kubectl create configmap orcl-primary-truecache-blob \
  --from-file=tc_config_blob.tar.gz=./DBPRIM_TIMESTAMP.tar.gz \
  -n tcdboper
```

Align the ConfigMap **key** with `spec.trueCache.blobConfigMapKey` in the YAML you apply.

6. If you will set `autoTCServiceRegistration: true`, install [`configure-primary-truecache-service.sh`](https://github.com/oracle/docker-images/tree/main/OracleDatabase/SingleInstance/extensions/truecache) on **every** RAC node (default path `/home/oracle/…`, `oracle:oinstall`, executable) and complete the DBMS_SCHEDULER / `externaljob.ora` checks in the operator prerequisites.

---

## Secrets and operator install (short form)

```bash
kubectl create secret docker-registry ocr-pull \
  --namespace tcdboper \
  --docker-server=container-registry.oracle.com \
  --docker-username='you@example.com' \
  --docker-password='OCR_AUTH_TOKEN' \
  --docker-email='you@example.com'

kubectl create secret generic db-admin-secret \
  --from-literal=oracle_pwd='********' -n tcdboper

kubectl create secret generic tde-wallet-secret \
  --from-literal=tde_wallet_pwd='********' -n tcdboper
```

Install ExternalDNS for OCI private DNS using the samples under [`docs/sidb/external-dns`](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb/external-dns) (namespace, RBAC, workload-identity secret, deployment with `--oci-zone-scope=PRIVATE`).

Install the operator (≥ 2.2) watching your namespace, for example:

```bash
scripts/generate-namespace-install.sh oracle-database-operator-system,tcdboper
kubectl apply -f dist/install/oracle-database-operator-rbac.yaml
kubectl apply -f dist/install/oracle-database-operator-system.yaml
kubectl get all -n oracle-database-operator-system
```

Full install options: [oracle-database-operator README](https://github.com/oracle/oracle-database-operator).

---

## Understand the sample Custom Resource (external RAC)

Official sample: [`singleinstancedatabase_truecache_external_rac.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/config/samples/sidb/singleinstancedatabase_truecache_external_rac.yaml).

High-level structure (placeholders—edit before apply):

```yaml
apiVersion: database.oracle.com/v4
kind: SingleInstanceDatabase
metadata:
  name: tck8node1
  namespace: tcdboper
spec:
  sid: TCK8DB1
  edition: enterprise
  createAs: truecache

  primarySource:
    # SCAN + registered CDB/service — TCP bootstrap
    connectString: "primrac-scan.mysubnet.examplevcn.oraclevcn.com:1521/PRIM_UNQNAME.mysubnet.examplevcn.oraclevcn.com"
    # Optional short CDB DB_NAME only — never DB_UNIQUE_NAME or full SCAN service
    dbName: PRIMDB

  trueCache:
    blobConfigMapRef: orcl-primary-truecache-blob
    blobConfigMapKey: tc_config_blob.tar.gz
    blobMountPath: /stage/tc_config_blob.tar.gz
    truedbUniqueName: "TCK8DB1_FRA"
    trueCacheServices:
      - "PRIMDB_PDB1:tcokeprim.example.com:tcokenodes.example.com"
    autoTCServiceRegistration: true   # requires helper on every RAC node

  security:
    secrets:
      admin:
        secretName: db-admin-secret
        secretKey: oracle_pwd
        keepSecret: true
      tde:
        secretName: tde-wallet-secret
        secretKey: tde_wallet_pwd

  image:
    pullFrom: container-registry.oracle.com/database/enterprise_ru:latest
    pullSecrets: ocr-pull
    prebuiltDB: false
    imagePullPolicy: Always

  # Optional: pin to dedicated workers and size SGA/CPU for production
  # nodeSelector:
  #   role: TC
  # initParams / resources / shmSize — tune to your lab or prod sizing

  persistence:
    oradata:
      size: 60Gi
      storageClass: "oci-bv"
      accessMode: "ReadWriteOnce"
    setWritePermissions: true

  services:
    endpoints:
      - name: loadbalancer
        type: LoadBalancer
        isKeep: true
        externalTrafficPolicy: Local
        annotations:
          oci.oraclecloud.com/load-balancer-type: "nlb"
          oci-network-load-balancer.oraclecloud.com/internal: "true"
          oci-network-load-balancer.oraclecloud.com/is-preserve-source: "false"
          oci-network-load-balancer.oraclecloud.com/subnet: "ocid1.subnet.oc1..<SVC_SUBNET_OCID>"
          external-dns.alpha.kubernetes.io/hostname: "tck8node1.tcinternal.example.com"
        tcp:
          enabled: true
          port: 1521

  replicas: 1
```

**Field tips for newcomers**

| Field | Tip |
|-------|-----|
| `primarySource.connectString` | Must be reachable from the True Cache pod during create |
| `primarySource.dbName` | Short CDB name from `SELECT name FROM v$database` — optional; omit rather than putting `DB_UNIQUE_NAME` |
| `truedbUniqueName` | True Cache unique name used in callback / archive dest |
| `services.endpoints` annotations | Force **nlb**, internal, subnet OCID, ExternalDNS hostname |
| `isKeep: true` | Keep Service/NLB across delete/recreate when you need a stable IP |
| `replicas` | Keep **1** for True Cache |

Sizing in the MAA PDF example (256Gi / 32 CPU) is a large demo footprint. Lab samples often omit heavy `resources` / `initParams` or use smaller values—size SGA, `shmSize`, and node capacity together.

---

## Step-by-step: deploy True Cache for an external RAC primary

**Stop if pre-flight failed.** The blob ConfigMap and DNS path are the usual blockers.

### 1. Apply the CR

```bash
kubectl apply -f true-cache-node.yaml   # your edited copy of the sample
kubectl get singleinstancedatabase -n "$NS" -w
```

### 2. Watch objects

```bash
kubectl get all -n "$NS" -o wide
kubectl get pvc -n "$NS"
kubectl describe singleinstancedatabase "$TRUECACHE" -n "$NS"
```

**Expect:** pod Running; ClusterIP service; LoadBalancer with private EXTERNAL-IP; ExternalDNS record for the annotated hostname.

### 3. Follow create logs

```bash
POD=$(kubectl get pod -n "$NS" -l "app=$TRUECACHE" -o jsonpath='{.items[0].metadata.name}')
kubectl logs -f "$POD" -n "$NS"
```

Healthy progression includes mounting the blob, warming the **external callback** target (`//tck8node1…:1521/TCK8DB1_FRA…`), DBCA True Cache jobs, optional primary registration helper, PDB open **READ ONLY**, and finally:

```text
DATABASE IS READY TO USE!
```

### 4. Operator status

```bash
kubectl get singleinstancedatabase -n "$NS" -o wide
```

**Expect:** `STATUS=Healthy`, `ROLE=TRUE_CACHE` (column names may vary slightly by operator version).

---

## Verification checklist

### On the primary

```sql
SHOW PARAMETER log_archive_dest
-- Look for ROLE="TRUE_CACHE" pointing at the TC hostname/service

SET LINESIZE 32767
SELECT service_id, name, true_cache_service FROM v$active_services;
-- With association: myappsvc… maps to TCOKENODES…

SELECT * FROM v$true_cache;
-- STATUS HEALTHY; REMOTE_DG_ID pairs with the cache
```

### On the True Cache pod

```bash
kubectl exec -i "$POD" -n "$NS" -- sqlplus / as sysdba <<'SQL'
SELECT database_role, open_mode FROM v$database;
-- TRUE CACHE | READ ONLY WITH APPLY

SELECT current_scn FROM v$database;
-- Re-query; SCN should advance

ALTER SESSION SET CONTAINER = PDB1;
SELECT COUNT(*) FROM dual;

SELECT * FROM v$true_cache;
SELECT * FROM v$true_cache_stat;
SQL

kubectl exec -i "$POD" -n "$NS" -- lsnrctl status
-- Expect the True Cache application service (e.g. TCOKENODES.EXAMPLE.COM)
```

### System stats (optional)

On primary and True Cache:

```sql
SELECT name, value FROM v$sysstat WHERE name LIKE 'True Cache%';
```

Look for block requests / blocks served counters moving under load.

---

## Connect from the application

List services:

```bash
kubectl get svc -n "$NS" -o wide
```

For in-cluster clients, prefer the **ClusterIP** service DNS:

```text
tck8node1.tcdboper.svc.cluster.local:1521/tcokenodes.example.com
```

Or a private DNS name you create that resolves to that ClusterIP (as in the MAA guide’s intra hostname).

**Two-pool example (conceptual JDBC URLs)**

| Pool | Connect string idea |
|------|---------------------|
| General / RW | `jdbc:oracle:thin:@//rac-scan…:1521/myappsvc.example.com` |
| Read-only | `jdbc:oracle:thin:@//tck8node1.tcdboper.svc.cluster.local:1521/tcokenodes.example.com` |

Full descriptor form for the RO pool:

```text
(DESCRIPTION=
  (ADDRESS=(PROTOCOL=TCP)(HOST=tck8node1.tcdboper.svc.cluster.local)(PORT=1521))
  (CONNECT_DATA=(SERVER=DEDICATED)(SERVICE_NAME=tcokenodes.example.com))
)
```

Wire your framework (Helidon + UCP in the MAA example, or Spring, Micronaut, etc.) so **only read-only code paths** use the RO pool. Writes stay on the primary pool.

---

## Troubleshooting (first-time failures)

| Symptom | Likely cause | What to check |
|---------|--------------|---------------|
| Apply fails / stuck Pending | Missing blob ConfigMap or wrong key | `blobConfigMapRef` / `blobConfigMapKey` / mount path |
| ImagePullBackOff | OCR auth or wrong tag | `ocr-pull` secret; Enterprise RU image |
| Callback never connectable | DNS or NLB | Primary resolves ExternalDNS name; NLB type=nlb; security lists |
| Create hangs on DBCA | Primary TCP bootstrap | `connectString` from TC pod; wallet open on primary |
| Healthy pod but no association | `autoTCServiceRegistration` / helper | Helper on all RAC nodes; `externaljob.ora`; or run manual helper from logs |
| App RO errors | Wrong service / PDB | `lsnrctl status` on TC; service name matches pool |
| Using OCI HTTP LB | Wrong LB product | Switch annotations to Network Load Balancer |

Deep gates: [TRUECACHE.md — Fast troubleshooting](https://github.com/oracle/oracle-database-operator/blob/main/docs/sidb/truecache/TRUECACHE.md#fast-troubleshooting-gates).

---

## Delete / recreate notes

```bash
kubectl delete singleinstancedatabase tck8node1 -n tcdboper
```

With `services.endpoints[].isKeep: true`, the LoadBalancer Service can survive so the NLB IP remains reusable. Re-apply after fixing config; keep the blob ConfigMap unless you regenerated it on the primary.

---

## Security and operations notes

- Treat admin and TDE secrets as production secrets; never commit passwords in YAML.  
- OCR Enterprise images require authenticated pull and license acceptance.  
- `autoTCServiceRegistration` runs OS work on the primary via DBMS_SCHEDULER—use only when policy allows; otherwise associate manually.  
- Pin image digests for repeatable deploys when your registry allows.  
- Size memory (`resources`, `shmSize`, SGA) so the cache hit ratio stays meaningful under your RO working set.  
- Monitor with `v$true_cache`, `v$true_cache_stat`, and your usual Kubernetes metrics on the TC pod.

---

## FAQ

### Is True Cache the same as a Data Guard standby?

No. Both consume redo, but True Cache is optimized as a **read cache** close to applications (often mostly in-memory), with its own connection methods and statistics views. Physical standby is a full HA/DR database role. The operator models True Cache as `createAs: truecache`, separate from `standby`.

### Can the primary also run inside Kubernetes?

Yes. Use the same-cluster True Cache Quick Start with `primarySource.databaseRef` and operator-generated blob ConfigMap. This post emphasizes the common **RAC outside / app inside** layout.

### Do I need Multus like Oracle RAC on Kubernetes?

No for this SIDB True Cache pattern. You need ordinary cluster networking plus (for external primary) route/DNS/NLB between VCNs or subnets. Multus appears in the [RAC-on-Kubernetes](/blog/provision-oracle-rac-database-kubernetes-operator/) interconnect story, which is a different CR (`RacDatabase`).

### Which document should I treat as source of truth?

1. Operator docs you apply day to day: [docs/sidb True Cache](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb#true-cache) and samples.  
2. MAA PDF for the OCI networking and ExternalDNS walkthrough with RAC outside.  
3. Product guide for SQL-level True Cache behavior and connection methods.

---

## SEO-friendly takeaways

**Primary question:** *How do I deploy Oracle True Cache on Kubernetes next to my application with an Oracle RAC primary outside the cluster?*  

**Answer:** Install Oracle Database Operator 2.2+, prepare network/DNS/secrets, create a DBCA True Cache blob ConfigMap from the RAC primary, apply a `SingleInstanceDatabase` with `createAs: truecache` and `primarySource.connectString` (sample `singleinstancedatabase_truecache_external_rac.yaml`), expose the listener with an **internal OCI NLB** and ExternalDNS hostname the primary can resolve, wait for **DATABASE IS READY TO USE**, verify `TRUE CACHE` / `READ ONLY WITH APPLY`, then point a read-only JDBC pool at the in-cluster ClusterIP service and True Cache service name.

**Keywords covered naturally:** Oracle True Cache Kubernetes, OraOperator SIDB truecache, True Cache OKE RAC primary, ExternalDNS OCI NLB True Cache, dual UCP datasource True Cache, v$true_cache verification.

---

## Closing

Placing True Cache in the same Kubernetes cluster as your application is a straightforward MAA pattern once the **blob**, **callback DNS/NLB**, and **service mapping** are honest. The Oracle Database Operator turns that into a declarative SIDB resource—the same style of workflow as Restart and RAC on Kubernetes, with different networking emphasis.

Start from the official samples and the [SIDB True Cache documentation](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb#true-cache), change only the fields that must match your SCAN, secrets, subnet OCID, and DNS names, then verify with SQL views—not only pod status. When the RO pool is live and `v$true_cache` reports **HEALTHY**, you have moved read latency next to the app without rewriting your data access layer as a custom cache.

If you already operate databases with the operator from the [Restart](/blog/provision-oracle-restart-database-kubernetes-operator/) or [RAC](/blog/provision-oracle-rac-database-kubernetes-operator/) guides, this True Cache path is the natural next step for read-intensive services on OKE.
