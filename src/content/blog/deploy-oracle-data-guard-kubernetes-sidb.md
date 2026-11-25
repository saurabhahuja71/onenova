---
title: "Deploy Oracle Data Guard on Kubernetes with SIDB and DataguardBroker"
description: "New-user architecture guide: same-cluster Data Guard Quick Start with Oracle Database Operator—primary and standby SIDBs, TDE/TCPS examples, DataguardBroker runner, DGMGRL verify, switchover, protection modes, FSFO, and cross-cluster NLB paths."
pubDate: 2026-11-25
updatedDate: 2026-11-25
author: "Saurabh Ahuja"
tags:
  - oracle
  - data-guard
  - kubernetes
  - database-operator
  - sidb
  - tcps
  - tde
  - oke
  - platform-engineering
  - databases
  - maa
  - high-availability
featured: true
draft: false
heroImage: "/images/blog/oracle-dataguard-k8s-architecture.svg"
---

Oracle **Data Guard** keeps a synchronized standby ready for planned role changes and disaster recovery. On Kubernetes, the [Oracle Database Operator](https://github.com/oracle/oracle-database-operator) models that topology as:

1. A **primary** `SingleInstanceDatabase` (`createAs: primary`)  
2. A **physical standby** `SingleInstanceDatabase` (`createAs: standby`)  
3. A **`DataguardBroker`** resource that creates the Broker configuration and exposes day-2 operations (switchover, protection mode, snapshot conversion, Fast-Start Failover)

This guide is written for **new users**: platform engineers and DBAs who know basic `kubectl` but have not yet stood up Data Guard through OraOperator. It expands the official [docs/sidb § Data Guard](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb#data-guard) section into the same checklist-and-mental-model style as the [True Cache](/blog/deploy-oracle-true-cache-kubernetes-rac-primary/), [Oracle Restart](/blog/provision-oracle-restart-database-kubernetes-operator/), and [Oracle RAC](/blog/provision-oracle-rac-database-kubernetes-operator/) posts on OneNova.

> **Contributor note.** I work on Oracle Database Operator for Kubernetes and contribute to the SIDB Data Guard documentation and samples. Treat the GitHub docs as the source of truth for field names and sample paths:
>
> - Operator Data Guard docs: [docs/sidb § Data Guard](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb#data-guard)
> - Same-cluster TCP Quick Start samples: [`singleinstancedatabase_dataguard_primary.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/config/samples/sidb/singleinstancedatabase_dataguard_primary.yaml), [`singleinstancedatabase_dataguard_standby.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/config/samples/sidb/singleinstancedatabase_dataguard_standby.yaml), [`dataguardbroker_same_cluster_tcp.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/config/samples/sidb/dataguardbroker_same_cluster_tcp.yaml)
> - Same-cluster TDE/TCPS samples: [`singleinstancedatabase_dataguard_primary_tde_tcps.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/config/samples/sidb/singleinstancedatabase_dataguard_primary_tde_tcps.yaml), [`singleinstancedatabase_dataguard_standby_tde_tcps.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/config/samples/sidb/singleinstancedatabase_dataguard_standby_tde_tcps.yaml), [`dataguardbroker_same_cluster_tde_tcps.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/config/samples/sidb/dataguardbroker_same_cluster_tde_tcps.yaml)
> - TCPS certificates: [`docs/sidb/tcps-cert-manager`](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb/tcps-cert-manager)
> - Cross-cluster TCP + NLB: [`DATAGUARD_CROSS_CLUSTER_LB.md`](https://github.com/oracle/oracle-database-operator/blob/main/docs/sidb/dataguard/DATAGUARD_CROSS_CLUSTER_LB.md)
> - Cross-cluster TCPS + NLB: [`DATAGUARD_CROSS_CLUSTER_TCPS_NLB.md`](https://github.com/oracle/oracle-database-operator/blob/main/docs/sidb/dataguard/DATAGUARD_CROSS_CLUSTER_TCPS_NLB.md)
> - Product concepts: [Oracle Data Guard Concepts and Administration](https://docs.oracle.com/en/database/oracle/oracle-database/26/sbydb/)

**What you will achieve**

- See how **two SIDBs + one DataguardBroker** map to pods, Services, and a Broker runner  
- Choose the right path: same-cluster TCP, same-cluster **TDE/TCPS**, or cross-cluster NLB  
- Run **pre-flight** checks and apply the Quick Start in order (primary → standby → Broker)  
- Walk a full **TDE + TCPS** same-cluster example (certs, wallet export, Broker TCPS endpoints)  
- Verify with **DGMGRL** from the Broker runner (`SHOW CONFIGURATION`, `VALIDATE DATABASE`)  
- Perform **switchover** and other day-2 ops via `kubectl patch` or DGMGRL  
- Know when to generate Broker YAML instead of using the stock sample  

> **Operator version:** this post targets **Oracle Database Operator 2.2+** and `database.oracle.com/v4` for `SingleInstanceDatabase` and `DataguardBroker`. Confirm operation fields with `kubectl explain dataguardbroker.spec.operations` on your cluster.

---

## Why Data Guard on Kubernetes with the operator?

Traditional Data Guard setups are rich in CLI and Broker procedures. The operator keeps that power while making the **desired topology declarative**:

| Benefit | What it means |
|---------|----------------|
| Repeatable HA topology | Primary + standby + Broker as YAML in GitOps |
| Kubernetes-native day-2 | Patch Broker for switchover / FSFO / protection mode |
| Clear ownership | Standby SIDB often hosts the Broker runner (`topology.sourceRef`) |
| Same secrets model | Shared admin Secret; optional TDE/TLS Secrets for encrypted paths |
| Path library | Same-cluster lab path and multi-cluster NLB / CMAN / NodePort docs |

Data Guard is about **availability and role management**. [True Cache](/blog/deploy-oracle-true-cache-kubernetes-rac-primary/) is about **read offload** next to the app. You can use both in an estate; they are different SIDB `createAs` values (`standby` vs `truecache`).

---

## Architecture: Kubernetes objects, not product internals

This section maps **CRs → pods, Services, runner**. It is not a diagram of every MRP/LSP process inside Oracle.

### Cluster view: what lands where

![Oracle Data Guard on Kubernetes architecture](/images/blog/oracle-dataguard-k8s-architecture.svg)

| Layer | Example objects | Role |
|-------|-----------------|------|
| Control plane | Oracle Database Operator | Reconciles SIDB + DataguardBroker |
| API | SIDB `sidb-sample` | Primary database |
| API | SIDB `standbydatabase-sample` | Physical standby |
| API | `DataguardBroker` `standbydatabase-sample-dg` | Broker config + operations |
| Workload NS | Primary / standby pods + PVCs | Database homes and datafiles |
| Workload NS | ClusterIP Services `:1521` | In-cluster SQL\*Net / redo |
| Workload NS | Broker **runner** Pod | DGMGRL shell with TNS aliases |
| Secrets | `db-admin-secret`, `ocr-reg-cred` | Shared admin password + image pull |

**Order matters:** primary Healthy → standby Healthy → **one** Broker. Never apply Broker first.

### Provision flow

![Data Guard provision flow](/images/blog/oracle-dataguard-k8s-reconcile-flow.svg)

### Connectivity and operations surfaces

![Data Guard connectivity and operations](/images/blog/oracle-dataguard-k8s-connectivity.svg)

```text
Same-cluster TCP:
  primary.svc  ←── redo / FAL ──►  standby.svc
  Broker runner ──► dgmgrl /@ORCL1  (current primary alias)

Cross-cluster:
  primary NLB:1521  ←──►  standby NLB:1521
  standby SIDB primarySource.connectString → primary NLB
  Broker applied in standby cluster; members list both NLB hosts
```

After **switchover**, Kubernetes resource **names stay the same**; **roles** move. Always reconnect DGMGRL using the **current primary** alias from the runner’s `tnsnames.ora`.

---

## Choose the right Data Guard path

Pick **one** row. Do not mix sample fields across paths.

| When you need… | Open |
|----------------|------|
| Same-cluster primary + physical standby over **TCP** (best first lab) | [Data Guard Quick Start](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb#data-guard-quick-start) — this post’s main walkthrough |
| Same-cluster with **TDE + TCPS** | [Data Guard Setup with TDE and TCPS](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb#data-guard-setup-with-tde-and-tcps) |
| Cross-cluster primary/standby over **TCP + NLB** | [`DATAGUARD_CROSS_CLUSTER_LB.md`](https://github.com/oracle/oracle-database-operator/blob/main/docs/sidb/dataguard/DATAGUARD_CROSS_CLUSTER_LB.md) |
| Cross-cluster over **TCPS + NLB** (ExternalDNS) | [`DATAGUARD_CROSS_CLUSTER_TCPS_NLB.md`](https://github.com/oracle/oracle-database-operator/blob/main/docs/sidb/dataguard/DATAGUARD_CROSS_CLUSTER_TCPS_NLB.md) |
| Multi-standby / CMAN / NodePort variants | Files under [`docs/sidb/dataguard/`](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb/dataguard) |

**Rule of thumb:** start with same-cluster TCP until Broker, switchover, and `SHOW CONFIGURATION` feel boring. Then add TCPS or a second cluster.

---

## Who this is for (and what you should already have)

| Audience | Why this post helps |
|----------|---------------------|
| Kubernetes platform engineers | Map DG to SIDB + Broker CRs, Services, runner Pod |
| Oracle DBAs new to operators | See ARCHIVELOG, duplicate, Broker members as YAML |
| SREs | Get a verify checklist before any switchover |
| App owners | Understand that resource names ≠ current primary role |

**Prerequisites (same-cluster TCP Quick Start)**

1. Kubernetes cluster with Oracle Database Operator installed and watching your namespace.  
2. `cert-manager` as required by your operator install.  
3. Namespace (samples use `default`) with capacity for **two** Enterprise SIDB pods + PVCs.  
4. Image-pull Secret for OCR Enterprise (example `ocr-reg-cred`).  
5. Admin Secret `db-admin-secret` key `oracle_pwd` — **same password** for primary, standby, and Broker.  
6. StorageClass that can provision `ReadWriteOnce` volumes (sample `oci-bv`, `100Gi` each).  
7. Matching **Enterprise** image tag on primary and standby samples.

For TDE/TCPS or cross-cluster, also prepare TDE Secrets, TLS Secrets (cert-manager helpers), wallet export to the standby side, and peered networking / ExternalDNS as documented in those runbooks.

---

## Mental model for new users

### Three resources, three jobs

| Resource | Job |
|----------|-----|
| Primary SIDB | Owns the read/write database; enables `archiveLog` / `forceLog`; turns on `dataguard.prereqs` |
| Standby SIDB | Instantiates physical standby from `primarySource.databaseRef` (same cluster) or `connectString` (remote) |
| DataguardBroker | Creates Broker config, runs a **runner** Pod, accepts `spec.operations` patches |

### `databaseRef` vs `connectString`

| Standby source | Use when |
|----------------|----------|
| `primarySource.databaseRef: sidb-sample` | Primary SIDB in the **same** cluster and namespace |
| `primarySource.connectString: host:1521/SERVICE` | Primary in **another** cluster or outside Kubernetes |

Same-cluster Quick Start uses `databaseRef`. Cross-cluster samples use `connectString` to the primary NLB (or CMAN/NodePort endpoint).

### `dataguard.prereqs` and `standbySources`

On the primary, `dataguard.prereqs.enabled: true` asks the controller/image to prepare database-side Data Guard prerequisites.  
`dataguard.standbySources` lists standby unique names and hosts when the standby is reached by **connect string** (or when TCPS samples need explicit TCP/TCPS ports). For pure same-cluster `databaseRef`, the TCP Quick Start leaves `standbySources` commented.

### Broker targets are `DB_UNIQUE_NAME`

Operation patches use **`ORCL1` / `ORCLS`** (the SID / Broker `dbUniqueName`), **not** the Kubernetes resource names `sidb-sample` / `standbydatabase-sample`. Resource names are stable across role changes; unique names identify Broker members.

### One method per operation

For each day-2 change, use **either** `kubectl patch` on the Broker **or** DGMGRL on the runner—not both at once. Keep the operator running for kubectl-driven ops.

---

## Pre-flight checks

```bash
export NS=default
export PRIMARY_DB=sidb-sample
export STANDBY_DB=standbydatabase-sample
export DGB=standbydatabase-sample-dg
```

### 1. Operator and CRDs

```bash
kubectl get deploy,pods -n oracle-database-operator-system
kubectl get crd singleinstancedatabases.database.oracle.com
kubectl get crd dataguardbrokers.database.oracle.com
kubectl explain dataguardbroker.spec.operations --api-version=database.oracle.com/v4
```

### 2. Secrets and storage

```bash
kubectl get secret -n "$NS" db-admin-secret ocr-reg-cred
kubectl get storageclass
```

### 3. Capacity

```bash
kubectl get nodes -o custom-columns=\
NAME:.metadata.name,CPU:.status.allocatable.cpu,MEM:.status.allocatable.memory,READY:.status.conditions[?\(@.type==\"Ready\"\)].status
```

You need room for two Enterprise database pods (plus Broker runner). Size to your image defaults and any `resources` you add.

---

## Understand the sample Custom Resources

### Primary — [`singleinstancedatabase_dataguard_primary.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/config/samples/sidb/singleinstancedatabase_dataguard_primary.yaml)

```yaml
apiVersion: database.oracle.com/v4
kind: SingleInstanceDatabase
metadata:
  name: sidb-sample
  namespace: default
spec:
  sid: ORCL1
  edition: enterprise
  createAs: primary
  charset: AL32UTF8
  pdbName: orclpdb1
  archiveLog: true
  forceLog: true
  flashBack: true
  security:
    secrets:
      admin:
        secretName: db-admin-secret
        secretKey: oracle_pwd
        keepSecret: true
  image:
    pullFrom: container-registry.oracle.com/database/enterprise_ru:latest
    pullSecrets: ocr-reg-cred
  persistence:
    oradata:
      size: 100Gi
      storageClass: oci-bv
      accessMode: ReadWriteOnce
  dataguard:
    prereqs:
      enabled: true
  replicas: 1
```

### Standby — [`singleinstancedatabase_dataguard_standby.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/config/samples/sidb/singleinstancedatabase_dataguard_standby.yaml)

```yaml
apiVersion: database.oracle.com/v4
kind: SingleInstanceDatabase
metadata:
  name: standbydatabase-sample
  namespace: default
spec:
  sid: ORCLS
  edition: enterprise
  createAs: standby
  primarySource:
    databaseRef: sidb-sample
  security:
    secrets:
      admin:
        secretName: db-admin-secret
        secretKey: oracle_pwd
        keepSecret: true
  image:
    pullFrom: container-registry.oracle.com/database/enterprise_ru:latest
    pullSecrets: ocr-reg-cred
  persistence:
    oradata:
      size: 100Gi
      storageClass: oci-bv
      accessMode: ReadWriteOnce
  replicas: 1
```

### Broker — [`dataguardbroker_same_cluster_tcp.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/config/samples/sidb/dataguardbroker_same_cluster_tcp.yaml)

```yaml
apiVersion: database.oracle.com/v4
kind: DataguardBroker
metadata:
  name: standbydatabase-sample-dg
  namespace: default
spec:
  execution:
    image: container-registry.oracle.com/database/enterprise_ru:latest
    imagePullSecrets:
      - ocr-reg-cred
    authWallet:
      enabled: true
  topology:
    sourceKind: SingleInstanceDatabase
    sourceRef:
      apiVersion: database.oracle.com/v4
      kind: SingleInstanceDatabase
      name: standbydatabase-sample
      namespace: default
    defaults:
      adminSecretRef:
        secretName: db-admin-secret
        secretKey: oracle_pwd
    members:
      - name: sidb-sample
        dbUniqueName: ORCL1
        role: PRIMARY
        localRef:
          apiVersion: database.oracle.com/v4
          kind: SingleInstanceDatabase
          name: sidb-sample
          namespace: default
        endpoints:
          - name: tcp
            host: sidb-sample.default.svc.cluster.local
            port: 1521
            protocol: TCP
            serviceName: ORCL1
      - name: standbydatabase-sample
        dbUniqueName: ORCLS
        role: PHYSICAL_STANDBY
        localRef:
          apiVersion: database.oracle.com/v4
          kind: SingleInstanceDatabase
          name: standbydatabase-sample
          namespace: default
        endpoints:
          - name: tcp
            host: standbydatabase-sample.default.svc.cluster.local
            port: 1521
            protocol: TCP
            serviceName: ORCLS
```

**If you rename anything**, do not blindly apply the stock Broker YAML. Generate from standby status using the helpers described under [Create the Data Guard Broker Configuration](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb#create-the-data-guard-broker-configuration) (for example `render-dg-broker-from-status.sh` / `gen_dg.sh` in the samples tree).

---

## Step-by-step: same-cluster TCP Quick Start

**Stop if secrets or operator checks failed.**

### 1. Create the primary

```bash
kubectl apply -f singleinstancedatabase_dataguard_primary.yaml
kubectl wait --for=jsonpath='{.status.status}'=Healthy \
  "singleinstancedatabase/$PRIMARY_DB" -n "$NS" --timeout=60m
kubectl get singleinstancedatabase "$PRIMARY_DB" -n "$NS" -o wide
```

Watch progress in a second terminal:

```bash
kubectl get singleinstancedatabase "$PRIMARY_DB" -n "$NS" -w
```

**Expect:** `Healthy` and role `PRIMARY`.

### 2. Create the standby

```bash
kubectl apply -f singleinstancedatabase_dataguard_standby.yaml
kubectl wait --for=jsonpath='{.status.status}'=Healthy \
  "singleinstancedatabase/$STANDBY_DB" -n "$NS" --timeout=60m
kubectl get singleinstancedatabase "$STANDBY_DB" -n "$NS" -o wide
```

**Expect:** `Healthy` and role `PHYSICAL_STANDBY`.

On failure, inspect standby pod logs and events; confirm `databaseRef` matches the primary name and both share the admin Secret.

### 3. Create the Broker (once)

```bash
kubectl apply -f dataguardbroker_same_cluster_tcp.yaml
kubectl get dataguardbroker "$DGB" -n "$NS" -o wide
kubectl describe dataguardbroker "$DGB" -n "$NS"
```

**Expect:** Broker `Healthy`. Create **only one** Broker for the pair.

Optional readiness peek on the standby:

```bash
kubectl get singleinstancedatabase "$STANDBY_DB" -n "$NS" \
  -o jsonpath='{.status.dataguard.readyForBroker}{"\n"}'
```

---

## Connect to the Broker runner and verify

Find the runner Pod (name starts with `${DGB}-runner-`):

```bash
RUNNER=$(kubectl get pods -n "$NS" \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | \
  grep "^${DGB}-runner-" | head -n 1)
kubectl get pod "$RUNNER" -n "$NS"
```

List TNS aliases:

```bash
kubectl exec "$RUNNER" -n "$NS" -- bash -c \
  'grep -E "^[[:space:]]*[A-Za-z][A-Za-z0-9_.-]*[[:space:]]*=" "$TNS_ADMIN/tnsnames.ora"'
```

Connect with DGMGRL to the **current primary** alias (TCP Quick Start often uses a name derived from `ORCL1`; TDE/TCPS samples document aliases such as `ORCL1TCPS`):

```bash
kubectl exec -it "$RUNNER" -n "$NS" -- dgmgrl /@ORCL1
```

Inside DGMGRL:

```text
SHOW CONFIGURATION;
SHOW DATABASE 'ORCL1';
SHOW DATABASE 'ORCLS';
VALIDATE DATABASE 'ORCLS';
```

**Expect:** configuration status **SUCCESS**, intended roles, healthy transport/apply, sensible lag. Investigate gaps before any planned switchover.

Also confirm SIDB roles from Kubernetes:

```bash
kubectl get singleinstancedatabase "$PRIMARY_DB" "$STANDBY_DB" -n "$NS" -o wide
kubectl get dataguardbroker "$DGB" -n "$NS" -o wide
```

---

## Day-2 operations

Confirm your CRD supports the patches:

```bash
kubectl explain dataguardbroker.spec.operations --api-version=database.oracle.com/v4
```

Each mutating op needs a **new** `requestId`. Targets are `DB_UNIQUE_NAME` values.

### Switchover (planned role reversal)

Both databases and Broker must be healthy; target synchronized; no other op in progress.

**A. kubectl (recommended when supported)**

```bash
DG=standbydatabase-sample-dg
REQUEST_ID="switchover-$(date +%s)"
kubectl patch dataguardbroker "$DG" -n "$NS" --type=merge \
  -p "{\"spec\":{\"operations\":{\"switchover\":{\"target\":\"ORCLS\",\"requestId\":\"$REQUEST_ID\"}}}}"
```

To switch back later, target `ORCL1` with a new `requestId` after it is a healthy physical standby.

**B. DGMGRL**

```text
SHOW CONFIGURATION;
VALIDATE DATABASE 'ORCLS';
SWITCHOVER TO 'ORCLS';
```

**Verify:** reconnect using the **new** primary alias; `SHOW CONFIGURATION;` should show roles reversed, status `SUCCESS`, standby `APPLY-ON`.

> Transient SIDB/Broker unhealthy states right after switchover are covered in the upstream troubleshooting notes under Data Guard in the SIDB README.

### Protection mode

Disable FSFO first if it is enabled. Prepare standby redo / transport before raising protection. Broker does not allow a direct jump from `MaxPerformance` to `MaxProtection`—go through `MaxAvailability`.

```bash
REQUEST_ID="availability-$(date +%s)"
kubectl patch dataguardbroker "$DG" -n "$NS" --type=merge \
  -p "{\"spec\":{\"operations\":{\"protectionMode\":{\"mode\":\"MaxAvailability\",\"requestId\":\"$REQUEST_ID\"}}}}"
```

Modes you will see in docs: `MaxPerformance`, `MaxAvailability`, `MaxProtection`. Maximum protection can shut down the primary if no synchronized standby can accept redo—read the [Oracle protection-mode documentation](https://docs.oracle.com/en/database/oracle/oracle-database/26/dgbkr/managing-data-protection-modes.html) before enabling it.

### Snapshot standby (temporary writable standby)

Disable FSFO and wait for disabled state. Ensure FRA space for the guaranteed restore point. Snapshot changes are **discarded** when converting back to physical standby.

```bash
REQUEST_ID="snapshot-$(date +%s)"
kubectl patch dataguardbroker "$DG" -n "$NS" --type=merge \
  -p "{\"spec\":{\"operations\":{\"convertToSnapshot\":{\"target\":\"ORCLS\",\"requestId\":\"$REQUEST_ID\"}}}}"
```

Convert back with `convertToPhysical` (see upstream docs for the exact patch shape on your release). Confirm `APPLY-ON` and catch-up before switchover or re-enabling FSFO.

### Fast-Start Failover (FSFO)

Validate primary, physical standby, static connect identifiers, observer connectivity, transport mode, and lag policy **before** enabling. A successful planned switchover alone does **not** validate FSFO. A snapshot standby cannot be the FSFO target.

Follow [Enable and Disable Fast-Start Failover](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb#enable-and-disable-fast-start-failover) in the SIDB README for the kubectl desired-state fields and DGMGRL equivalents on your operator version.

### Application services that follow the primary

For a PDB service that should track the primary role after switchover/failover, see the operator’s [custom service example](https://github.com/oracle/oracle-database-operator/blob/main/docs/sidb/custom-service/CUSTOM_SERVICE.md). Adapt and validate for your app before production use.

---

## Cross-cluster sketch (TCP + NLB)

When primary and standby live in **different** Kubernetes clusters:

1. Install the **same** operator version in both clusters.  
2. Create matching admin Secrets (same password) and image-pull Secrets.  
3. Expose each SIDB with an **internal OCI NLB** on TCP `1521` (prefer ExternalDNS hostnames).  
4. Create the primary; export the **current** TDE wallet into the standby cluster Secret when using TDE.  
5. Create the standby with `primarySource.connectString` pointing at the primary NLB.  
6. Prove bidirectional NLB reachability before Broker.  
7. Generate/apply `DataguardBroker` in the **standby** cluster with both NLB hosts as member endpoints.  
8. Run DGMGRL / switchover from that Broker runner.

Full procedure: [`DATAGUARD_CROSS_CLUSTER_LB.md`](https://github.com/oracle/oracle-database-operator/blob/main/docs/sidb/dataguard/DATAGUARD_CROSS_CLUSTER_LB.md). For overlay CNIs (for example Flannel), pay attention to `externalTrafficPolicy` (`Local` vs `Cluster`) and `is-preserve-source` annotations—the cross-cluster doc calls out the combinations OCI accepts.

---

## Same-cluster Data Guard with TDE and TCPS

Official procedure: [Data Guard Setup with TDE and TCPS](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb#data-guard-setup-with-tde-and-tcps). Use this after the TCP Quick Start feels familiar.

```bash
export NS=default
export PRIMARY_DB=sidb-sample
export STANDBY_DB=standbydatabase-sample
export DGB=standbydatabase-sample-dg
```

### Extra prerequisites vs TCP Quick Start

| Requirement | Example | Notes |
|-------------|---------|-------|
| Primary TDE password Secret | `tde-wallet-secret` / `tde_wallet_pwd` | Create before primary apply |
| TCPS leaf Secrets | `sidb-primary-tcps-tls`, `sidb-standby-tcps-tls` | From [tcps-cert-manager](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb/tcps-cert-manager); SANs cover each Service DNS |
| Standby TDE wallet Secret | `sidb-standby-tde-wallet` with `wallet.zip` (+ password key on 23ai+) | Built from **current** primary wallet **after** primary is Healthy, **before** standby apply |
| Primary `standbySources` | host + `tcpPort: 1521` + `tcpsPort: 2484` | Required in the TDE/TCPS sample |
| Broker | `dataguardbroker_same_cluster_tde_tcps.yaml` | TCP **and** TCPS member endpoints; client wallet Secrets |

PKI design (same as True Cache): one shared intermediate CA; each member leaf has Server + Client Auth EKU. Independent CA trees break mutual authentication.

### 1. Create certificates

With cert-manager installed, run the helper for the **same** context for both members. Override `NS` and DNS SAN lists to match Service names (`sidb-sample.default.svc.cluster.local`, `standbydatabase-sample.default.svc.cluster.local`, and short names).

```bash
kubectl wait -n "$NS" --for=condition=Ready \
  certificate/sidb-primary-tcps certificate/sidb-standby-tcps --timeout=5m
kubectl get secret sidb-primary-tcps-tls sidb-standby-tcps-tls -n "$NS" \
  -o custom-columns=NAME:.metadata.name,TYPE:.type
```

**Expect:** both Secrets type `kubernetes.io/tls`.

### 2. Primary SIDB (TDE + TCPS)

Sample: [`singleinstancedatabase_dataguard_primary_tde_tcps.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/config/samples/sidb/singleinstancedatabase_dataguard_primary_tde_tcps.yaml)

```yaml
apiVersion: database.oracle.com/v4
kind: SingleInstanceDatabase
metadata:
  name: sidb-sample
  namespace: default
spec:
  sid: ORCL1
  edition: enterprise
  createAs: primary
  pdbName: orclpdb1
  archiveLog: true
  forceLog: true
  flashBack: true
  security:
    secrets:
      admin:
        secretName: db-admin-secret
        secretKey: oracle_pwd
        keepSecret: true
      tde:
        secretName: tde-wallet-secret
        secretKey: tde_wallet_pwd
    tcps:
      enabled: true
      tlsSecret: sidb-primary-tcps-tls
  image:
    pullFrom: container-registry.oracle.com/database/enterprise_ru:latest
    pullSecrets: ocr-reg-cred
  persistence:
    oradata:
      size: 100Gi
      storageClass: oci-bv
      accessMode: ReadWriteOnce
  dataguard:
    prereqs:
      enabled: true
    standbySources:
      - dbUniqueName: ORCLS
        host: standbydatabase-sample.default.svc.cluster.local
        tcpPort: 1521
        tcpsEnabled: true
        tcpsPort: 2484
  replicas: 1
```

```bash
kubectl apply -f singleinstancedatabase_dataguard_primary_tde_tcps.yaml
kubectl wait --for=jsonpath='{.status.status}'=Healthy \
  "singleinstancedatabase/$PRIMARY_DB" -n "$NS" --timeout=60m
kubectl get svc "$PRIMARY_DB" -n "$NS"
```

### 3. Export primary TDE wallet → standby Secret

The standby must receive the wallet from the **current** Healthy primary (not an old zip).

```bash
PRIMARY_POD=$(kubectl get pod -n "$NS" -l "app=$PRIMARY_DB" \
  -o jsonpath='{.items[0].metadata.name}')

WALLET_ROOT=$(kubectl exec -i "$PRIMARY_POD" -n "$NS" -c "$PRIMARY_DB" -- \
  sqlplus -L -s / as sysdba <<'SQL'
whenever sqlerror exit failure
set heading off feedback off pages 0 verify off echo off linesize 400
select value from v$parameter where name = 'wallet_root';
exit
SQL
)
WALLET_ROOT=$(printf '%s\n' "$WALLET_ROOT" | sed '/^[[:space:]]*$/d; s/^[[:space:]]*//; s/[[:space:]]*$//')
test -n "$WALLET_ROOT" && kubectl exec "$PRIMARY_POD" -n "$NS" -c "$PRIMARY_DB" -- test -d "$WALLET_ROOT/tde"

WALLET_DIR=$(mktemp -d)
chmod 700 "$WALLET_DIR"
kubectl cp -n "$NS" -c "$PRIMARY_DB" \
  "$PRIMARY_POD:$WALLET_ROOT" "$WALLET_DIR/wallet-root"
(cd "$WALLET_DIR/wallet-root" && zip -qr "$WALLET_DIR/standby-wallet.zip" tde)
unzip -t "$WALLET_DIR/standby-wallet.zip"
```

Create/update the standby TDE Secret. For **23ai+**, include the password key (copy bytes from the primary TDE Secret—do not retype). For **19c** standby images, follow the upstream note: wallet zip only; do not set `secretKey` on the standby CR when the webhook rejects it.

```bash
# 23ai+ example shape — adjust names/keys to match your manifests
kubectl create secret generic sidb-standby-tde-wallet -n "$NS" \
  --from-file=wallet.zip="$WALLET_DIR/standby-wallet.zip" \
  --from-literal=tde_wallet_pwd="$(kubectl get secret tde-wallet-secret -n "$NS" \
    -o jsonpath='{.data.tde_wallet_pwd}' | base64 -d)" \
  --dry-run=client -o yaml | kubectl apply -f -
```

Full copy/jq variants: [TDE Secret prerequisites](https://github.com/oracle/oracle-database-operator/blob/main/docs/sidb/prerequisites/PREREQUISITES.md#tde-secret) in the SIDB docs.

### 4. Standby SIDB (TDE + TCPS)

Sample: [`singleinstancedatabase_dataguard_standby_tde_tcps.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/config/samples/sidb/singleinstancedatabase_dataguard_standby_tde_tcps.yaml)

```yaml
apiVersion: database.oracle.com/v4
kind: SingleInstanceDatabase
metadata:
  name: standbydatabase-sample
  namespace: default
spec:
  sid: ORCLS
  edition: enterprise
  createAs: standby
  primarySource:
    databaseRef: sidb-sample
  security:
    secrets:
      admin:
        secretName: db-admin-secret
        secretKey: oracle_pwd
        keepSecret: true
      tde:
        secretName: sidb-standby-tde-wallet
        secretKey: tde_wallet_pwd
        walletZipFileKey: wallet.zip
        walletRoot: /opt/oracle/oradata/ORCLS/tdewallet
    tcps:
      enabled: true
      tlsSecret: sidb-standby-tcps-tls
  image:
    pullFrom: container-registry.oracle.com/database/enterprise_ru:latest
    pullSecrets: ocr-reg-cred
  persistence:
    oradata:
      size: 100Gi
      storageClass: oci-bv
      accessMode: ReadWriteOnce
  replicas: 1
```

```bash
kubectl apply -f singleinstancedatabase_dataguard_standby_tde_tcps.yaml
kubectl wait --for=jsonpath='{.status.status}'=Healthy \
  "singleinstancedatabase/$STANDBY_DB" -n "$NS" --timeout=60m
```

### 5. Broker with TCP + TCPS endpoints

Sample: [`dataguardbroker_same_cluster_tde_tcps.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/config/samples/sidb/dataguardbroker_same_cluster_tde_tcps.yaml)

Each member lists **both** protocols, for example:

```yaml
endpoints:
  - name: tcp
    host: sidb-sample.default.svc.cluster.local
    port: 1521
    protocol: TCP
    serviceName: ORCL1
  - name: tcps
    host: sidb-sample.default.svc.cluster.local
    port: 2484
    protocol: TCPS
    serviceName: ORCL1
tcps:
  enabled: true
  clientWalletSecret: sidb-sample-dg-client-wallet
```

Standby member uses `standbydatabase-sample…` hosts and `ORCLS`. Topology defaults may set a Broker runner client wallet Secret—follow the sample and [TCPS client wallet placement](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb#tcps-client-wallet-placement-for-the-broker-runner) so DGMGRL can authenticate over TCPS.

```bash
kubectl apply -f dataguardbroker_same_cluster_tde_tcps.yaml
kubectl get dataguardbroker "$DGB" -n "$NS" -o wide
```

### 6. Verify over TCPS aliases

```bash
RUNNER=$(kubectl get pods -n "$NS" \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | \
  grep "^${DGB}-runner-" | head -n 1)
kubectl exec "$RUNNER" -n "$NS" -- bash -c \
  'grep -E "^[[:space:]]*[A-Za-z]" "$TNS_ADMIN/tnsnames.ora"'
# Connect with the TCPS primary alias from that list (sample docs often use ORCL1TCPS)
kubectl exec -it "$RUNNER" -n "$NS" -- dgmgrl /@ORCL1TCPS
```

```text
SHOW CONFIGURATION;
SHOW DATABASE 'ORCL1';
SHOW DATABASE 'ORCLS';
VALIDATE DATABASE 'ORCLS';
```

After switchover, reconnect with the **new** primary’s TCPS alias (for example `ORCLSTCPS` when `ORCLS` becomes primary).

### Cross-cluster TCPS + NLB

Same wallet-export and shared-CA ideas, plus ExternalDNS hostnames on internal NLBs and Broker applied in the standby cluster. Full runbook: [`DATAGUARD_CROSS_CLUSTER_TCPS_NLB.md`](https://github.com/oracle/oracle-database-operator/blob/main/docs/sidb/dataguard/DATAGUARD_CROSS_CLUSTER_TCPS_NLB.md). Separate admin access to each cluster: [`SEPARATE_CLUSTER_ACCESS.md`](https://github.com/oracle/oracle-database-operator/blob/main/docs/sidb/tcps-cert-manager/SEPARATE_CLUSTER_ACCESS.md).

---

## Delete safely

1. Check **current roles** (`kubectl get singleinstancedatabase -o wide`)—the object created as standby may now be primary.  
2. Disable FSFO and confirm observer state.  
3. **Delete Broker first**, then the SIDB(s) you intend to remove.  
4. Do not delete shared admin/TDE/TLS Secrets still used by remaining databases.

```bash
kubectl delete dataguardbroker "$DGB" -n "$NS"
# then delete SIDBs as appropriate
```

---

## Troubleshooting checklist

| Symptom | Likely cause | What to check |
|---------|--------------|---------------|
| Standby never Healthy | Wrong `databaseRef` / password / image | Primary name, shared `oracle_pwd`, same image tag, pod logs |
| Broker stuck unhealthy | Applied too early or wrong members | Both SIDBs Healthy; endpoints match Service DNS; regenerate YAML if renamed |
| `readyForBroker` false | Standby not finished DG bootstrap | Standby status/events; wait; describe SIDB |
| DGMGRL connect fails | Wrong alias after switchover | Re-list `tnsnames.ora`; use **current** primary alias (TCPS: `…TCPS`) |
| Switchover rejected | Lag / FSFO target / concurrent op | `VALIDATE DATABASE`; wait for SUCCESS; one op at a time |
| Cross-cluster timeout | NLB / security lists / traffic policy | `nc` to peer NLB:1521; ExternalDNS; Local vs Cluster policy |
| Patch no effect | CRD lacks `spec.operations` | `kubectl explain`; use DGMGRL path for that release |
| Standby fails TDE open | Stale or wrong wallet zip | Re-export from **current** primary; 23ai+ password key must match primary |
| TCPS handshake / Broker TCPS fail | SAN or CA mismatch; missing client wallet | Shared intermediate CA; leaf SANs; Broker `clientWalletSecret` placement |
| Webhook rejects standby `tde.secretKey` | 19c standby image rule | Follow 19c note: wallet zip only without `secretKey` when required |

---

## FAQ

### Is Data Guard the same as True Cache on Kubernetes?

No. **Data Guard** provides a synchronized standby for HA/DR and role management (`createAs: standby` + `DataguardBroker`). **True Cache** is a read-only cache (`createAs: truecache`) often placed next to applications. See the [True Cache on Kubernetes](/blog/deploy-oracle-true-cache-kubernetes-rac-primary/) post.

### Do resource names flip after switchover?

No. `sidb-sample` and `standbydatabase-sample` keep their names. **Roles** in status and Broker flip. Always drive apps with role-aware services or reconnect using the current primary.

### Can I run Broker before the standby exists?

No. Both SIDBs must be Healthy with the expected roles first. One Broker per pair.

### Is Active Data Guard open read-only covered here?

Physical standby open for real-time query depends on product licensing and open mode. This operator Quick Start focuses on provisioning Broker-managed physical standby and role operations. Confirm open-mode requirements with Oracle documentation for your edition.

### Where is RAC Data Guard?

This post is the **SIDB** Data Guard path. Multi-instance RAC topologies use different CRs and runbooks. For RAC-on-Kubernetes provisioning see [Provision Oracle RAC…](/blog/provision-oracle-rac-database-kubernetes-operator/).

### Should I start with TCPS?

Start with the **TCP Quick Start**, then add [TDE and TCPS](#same-cluster-data-guard-with-tde-and-tcps). Certificates, wallet export, and Broker client wallets are the usual first-time blockers—easier to debug after Broker already works over TCP.

---

## SEO-friendly takeaways

**Primary question:** *How do I deploy Oracle Data Guard on Kubernetes with Oracle Database Operator?*  

**Answer:** Install OraOperator 2.2+, create shared admin and image-pull Secrets, apply a primary SIDB with `archiveLog`/`forceLog` and `dataguard.prereqs.enabled`, wait until Healthy PRIMARY, apply a standby SIDB with `createAs: standby` and `primarySource.databaseRef`, wait until Healthy PHYSICAL_STANDBY, apply one `DataguardBroker` whose members match both Service DNS names, verify with DGMGRL `SHOW CONFIGURATION` / `VALIDATE DATABASE` from the Broker runner, then use `kubectl patch` (or DGMGRL) for switchover and other day-2 operations. For encrypted listeners, add cert-manager TLS Secrets, TDE wallet export to the standby, and the TDE/TCPS samples with ports **1521** and **2484**.

**Keywords covered naturally:** Oracle Data Guard Kubernetes, OraOperator DataguardBroker, SIDB physical standby, Data Guard switchover kubectl, FSFO Kubernetes Oracle, cross-cluster Data Guard NLB OKE.

---

## Closing

Data Guard on Kubernetes with OraOperator is a **three-object story**: primary SIDB, standby SIDB, DataguardBroker. New users succeed when they respect the Healthy gates, keep passwords and image tags aligned, verify with DGMGRL before the first switchover, and remember that **names stay put while roles move**.

Start from the official [Data Guard Quick Start](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb#data-guard-quick-start) samples, change only namespace/StorageClass/Secrets that must match your cluster, and treat the SIDB README plus the `docs/sidb/dataguard/` runbooks as the living source of truth. When Broker reports **SUCCESS** and lag is clean, you have a Kubernetes-native HA pair you can operate with the same tools you already use for deploys—and a clear path to TCPS or cross-region NLB topologies when you need them.

If you already shipped [True Cache](/blog/deploy-oracle-true-cache-kubernetes-rac-primary/) or [Restart](/blog/provision-oracle-restart-database-kubernetes-operator/) on the operator, this Data Guard guide is the HA counterpart on the same SIDB platform.
