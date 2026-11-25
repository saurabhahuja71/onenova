---
title: "Deploy Oracle Connection Manager (CMAN) with SIDB on Kubernetes"
description: "New-user architecture guide: OraOperator ConnectionManager for SIDB—global next_hop Quick Start, generated rules + remote_listener, multi-backend service aliases, cmctl verify, and Data Guard-safe routing."
pubDate: 2026-11-25
author: "Saurabh Ahuja"
tags:
  - oracle
  - cman
  - connection-manager
  - kubernetes
  - database-operator
  - sidb
  - sqlnet
  - oke
  - platform-engineering
  - databases
featured: true
draft: false
heroImage: "/images/blog/oracle-cman-sidb-k8s-architecture.svg"
---

Oracle **Connection Manager (CMAN)** is a SQL\*Net proxy that sits in front of Oracle Database listeners. Clients connect to CMAN; CMAN forwards sessions to one or more backend databases according to rules or a `cman.ora` file. On Kubernetes, the [Oracle Database Operator](https://github.com/oracle/oracle-database-operator) exposes that as a `ConnectionManager` custom resource (`network.oracle.com/v4`, short name `cman`).

This guide is written for **new users** who already know basic `kubectl` and have (or will deploy) a **SIDB** backend. It expands the official [docs/cman](https://github.com/oracle/oracle-database-operator/tree/main/docs/cman) material into the same checklist-and-mental-model style as the [Data Guard](/blog/deploy-oracle-data-guard-kubernetes-sidb/), [True Cache](/blog/deploy-oracle-true-cache-kubernetes-rac-primary/), and [Restart](/blog/provision-oracle-restart-database-kubernetes-operator/) posts on OneNova.

> **Contributor note.** I work on Oracle Database Operator for Kubernetes and contribute to the CMAN documentation and samples. Treat GitHub as the source of truth for fields and YAML:
>
> - CMAN guide: [docs/cman/README.md](https://github.com/oracle/oracle-database-operator/tree/main/docs/cman)
> - Sample index: [docs/cman/samples/README.md](https://github.com/oracle/oracle-database-operator/blob/main/docs/cman/samples/README.md)
> - Preferred SIDB Quick Start (global `next_hop`): [`cman-sidb-nexthop.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/cman/samples/cman-sidb-nexthop.yaml)
> - Generated rules sample: [`cman-sidb.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/cman/samples/cman-sidb.yaml)
> - Multi-backend aliases: [`cman-sidb-peer-nexthop.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/cman/samples/cman-sidb-peer-nexthop.yaml)
> - Data Guard through CMAN: [`DATAGUARD_CROSS_CLUSTER_CMAN.md`](https://github.com/oracle/oracle-database-operator/blob/main/docs/sidb/dataguard/DATAGUARD_CROSS_CLUSTER_CMAN.md)

**What you will achieve**

- See how **ConnectionManager → Deployment + Services + ConfigMap** fronts a Healthy SIDB  
- Choose among **global `next_hop`**, **generated rules + `remote_listener`**, and **service-alias** multi-backend patterns  
- Run the **next_hop Quick Start** (no database registration step)  
- Optionally run the **generated rules** path with `ALTER SYSTEM REGISTER`  
- Verify with `cmctl show services` and Easy Connect through CMAN  
- Know why Data Guard / Broker switchover prefers **next_hop**, not generated `remote_listener`  

> **Operator version:** CMAN support is **preview** in Oracle AI Database Operator **2.3.0**. You need the `ConnectionManager` CRD (`network.oracle.com/v4`) and a CMAN container image that matches your pattern (`next_hop` and embedded `tnsnames` require image support called out in the samples).

---

## Why put CMAN in front of SIDB?

| Benefit | What it means |
|---------|----------------|
| Stable client endpoint | Apps aim at CMAN Service / NLB while backends move or multiply |
| Central accept/reject rules | Filter by source, destination, and service name |
| Multi-backend front door | One CMAN name can route `apppdb1` and `apppdb2` to different SIDBs |
| Topology flexibility | Same CR pattern works for SIDB, RAC SCAN, Restart, or external listeners |
| DG-friendly routing | Global `next_hop` keeps static Broker connect identifiers reachable during switchover |

CMAN **does not create** databases. Deploy and verify every backend SIDB **before** applying CMAN that references those Services.

---

## Architecture: Kubernetes objects

### Cluster view

![Oracle CMAN with SIDB on Kubernetes](/images/blog/oracle-cman-sidb-k8s-architecture.svg)

| Layer | Example objects | Role |
|-------|-----------------|------|
| API | `ConnectionManager` `cman-sidb` | Desired CMAN state |
| Control plane | OraOperator CMAN controller | Creates Deployment, Services, mounts config |
| Workload | `deploy/cman-sidb` | CMAN pod(s); `cmctl` inside |
| Config | ConfigMap (file mode) | User-managed `cman.ora` |
| Network | Internal Service `:1521` | In-cluster clients + `remote_listener` target |
| Network | External LB/NLB `:1521` | Optional outside clients |
| Backend | SIDB `sidb-sample` (+ peers) | Must already be Healthy |

### Provision flow

![CMAN provision flow](/images/blog/oracle-cman-sidb-k8s-reconcile-flow.svg)

### Routing patterns

![CMAN routing patterns](/images/blog/oracle-cman-sidb-k8s-connectivity.svg)

```text
Client ──► cman-sidb Service :1521 ──► sidb-sample :1521 / apppdb1
                 │
                 └── (peer pattern) ──► sidb-cman-peer :1521 / apppdb2
```

---

## Choose a CMAN configuration pattern

| Pattern | Mode | Backends | `remote_listener`? | Use when | Sample |
|---------|------|----------|--------------------|----------|--------|
| **Single SIDB — global `next_hop`** | File | 1 | **No** | Fastest path; **preferred for Data Guard / Broker** | [`cman-sidb-nexthop.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/cman/samples/cman-sidb-nexthop.yaml) |
| Single SIDB — generated rules | Generated | 1 | **Yes, after CMAN Healthy** | DB registers services on CMAN | [`cman-sidb.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/cman/samples/cman-sidb.yaml) |
| Single SIDB — plain file | File | 1 | Usually no | Full control of `cman.ora` without `next_hop` | [`cman-sidb-filemode.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/cman/samples/cman-sidb-filemode.yaml) |
| Two+ SIDBs — generated | Generated | 2+ | **Yes on each DB** | Registration-based multi-backend | [`cman-sidb-peer.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/cman/samples/cman-sidb-peer.yaml) |
| Two+ SIDBs — service-alias | File | 2+ | **No** | Per-service next hop; good with `replicas: 2` | [`cman-sidb-peer-nexthop.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/cman/samples/cman-sidb-peer-nexthop.yaml) |
| RAC SCAN — `next_hop` / generated | File / Gen | 1 RAC | Gen: yes | Front RAC | [`cman-rac-nexthop.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/cman/samples/cman-rac-nexthop.yaml) / [`cman-rac.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/cman/samples/cman-rac.yaml) |

**Admission rule:** when `spec.configSource` is set (file mode), do **not** also set `spec.rules`, `logLevel`, `traceLevel`, or `registrationInvitedNodes`. The webhook rejects that mix—the mounted file is the source of truth.

**Data Guard warning:** do **not** use generated rules + `remote_listener` for cross-cluster SIDB Data Guard switchover through CMAN. Dynamic registration can disappear mid-switchover and yield `ORA-12514` on `*_DGMGRL`. Use **global `next_hop`** instead — see [`DATAGUARD_CROSS_CLUSTER_CMAN.md`](https://github.com/oracle/oracle-database-operator/blob/main/docs/sidb/dataguard/DATAGUARD_CROSS_CLUSTER_CMAN.md).

---

## Who this is for (and what you should already have)

| Audience | Why this post helps |
|----------|---------------------|
| Platform engineers | Map CMAN to Deployment, Services, ConfigMaps, NLB annotations |
| DBAs new to operators | See `next_hop` vs `remote_listener` without guessing |
| App owners | Get a stable Easy Connect string through CMAN |
| HA architects | Pick DG-safe routing before Broker switchover |

**Prerequisites**

1. OraOperator installed with `ConnectionManager` CRD (preview **2.3.0+**).  
2. At least one **Healthy** SIDB (SIDB Quick Start) with a PDB/service name that matches the CMAN rule (samples use `apppdb1`).  
3. CMAN container image (and pull Secret if private/OCR).  
4. For external exposure on OCI: cloud controller + subnet OCID for NLB annotations.  
5. For multi-backend samples: **every** peer SIDB deployed and its Service present.

Confirm backends before CMAN:

```bash
kubectl get singleinstancedatabase -n default
kubectl get svc -n default sidb-sample
# peer samples also need:
# kubectl get svc -n default sidb-cman-peer
```

---

## Mental model for new users

### Generated vs file mode

| | Generated (`spec.rules`) | File (`spec.configSource`) |
|--|--------------------------|----------------------------|
| Who writes `cman.ora` | Container from CR rules | You (ConfigMap) |
| Typical routing | DB registers via `remote_listener` | `next_hop` or service aliases |
| Client before registration | Fails with `ORA-12514` | Works after CMAN Healthy (next_hop) |
| DG / Broker through CMAN | Risky | Prefer global `next_hop` |

### What the operator creates

For every `ConnectionManager`:

- Deployment (CMAN pod replicas)  
- Internal Service (listener, default 1521)  
- Optional external Service (`LoadBalancer` / NLB)  
- ConfigMap mount only when you supply `configSource` (file mode)

### Name collisions

Most SIDB-focused samples use `metadata.name: cman-sidb`. Apply **one** sample per namespace, or rename the resource **and** the `CMAN_…` listener hostname inside `cman.ora` before applying another.

---

## Pre-flight checks

```bash
export NS=default
export CMAN=cman-sidb
export SIDB=sidb-sample
```

```bash
kubectl get crd connectionmanagers.network.oracle.com
kubectl get singleinstancedatabase "$SIDB" -n "$NS" -o wide
kubectl get svc -n "$NS" "$SIDB"
kubectl get nodes -o wide
```

**Expect:** SIDB `Healthy`, Service for the SIDB exists, CMAN CRD present.

---

## Quick Start A — global `next_hop` (recommended)

No `remote_listener`. Preferred for SIDB Data Guard / DataguardBroker scenarios.

Official sample: [`cman-sidb-nexthop.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/cman/samples/cman-sidb-nexthop.yaml).

### 1. Edit placeholders

Replace:

- `<cman-container-image-with-next-hop-support>`  
- `<subnet-ocid>` (OCI NLB)  
- Namespace / Service DNS / `apppdb1` if yours differ  

Core idea of the ConfigMap:

```yaml
next_hop=
  (description=(address=(protocol=tcp)(host=sidb-sample.default.svc.cluster.local)(port=1521)))
```

Accept rule for the PDB service:

```text
(src=*)(dst=*)(srv=apppdb1)(act=accept)
```

### 2. Apply and wait

```bash
kubectl apply -f cman-sidb-nexthop.yaml
kubectl wait --for=jsonpath='{.status.status}'=Healthy \
  "cman/$CMAN" -n "$NS" --timeout=300s
kubectl get cman "$CMAN" -n "$NS" \
  -o jsonpath='{.status.status}{"\n"}{.status.externalEndpoint}{"\n"}{.status.cman.configMode}{"\n"}'
```

`configMode` should report **file**.

### 3. Discover the endpoint

```bash
kubectl get svc -n "$NS" -l app.kubernetes.io/name=cman-sidb -o wide
```

### 4. Connect

```bash
sqlplus 'sys/<password>@//<cman-external-ip>:1521/apppdb1 as sysdba'
```

In-cluster:

```text
@//cman-sidb.default.svc.cluster.local:1521/apppdb1
```

---

## Quick Start B — generated rules + registration

Use only when you want the database to **register** services with CMAN. **Not** recommended for Broker switchover through CMAN.

Sample: [`cman-sidb.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/cman/samples/cman-sidb.yaml).

High-level CR shape:

```yaml
apiVersion: network.oracle.com/v4
kind: ConnectionManager
metadata:
  name: cman-sidb
  namespace: default
spec:
  runtime:
    image: "<cman-container-image>"
    replicas: 1
  service:
    internal:
      enabled: true
      ports:
        - name: cman
          port: 1521
          targetPort: 1521
    external:
      enabled: true
      serviceType: LoadBalancer
      # OCI NLB annotations…
  logLevel: user
  traceLevel: user
  registrationInvitedNodes: "*"
  rules:
    - host: sidb-sample.default.svc.cluster.local
      src: "*"
      dst: "*"
      srv: apppdb1
      action: accept
```

### Order (critical)

1. **Apply CMAN** and wait until Healthy.  
2. From the SIDB pod, confirm CMAN DNS resolves:

```bash
kubectl exec -n "$NS" <sidb-pod> -- getent hosts cman-sidb.default.svc.cluster.local
```

3. Set `remote_listener` and register:

```sql
ALTER SYSTEM SET remote_listener=
  '(ADDRESS=(PROTOCOL=TCP)(HOST=cman-sidb.default.svc.cluster.local)(PORT=1521))'
  SCOPE=BOTH;
ALTER SYSTEM REGISTER;
```

4. Verify services on CMAN **before** client tests:

```bash
kubectl exec -n "$NS" deploy/cman-sidb -- cmctl show services
```

5. Then Easy Connect through the CMAN external IP.

| Mistake | Symptom |
|---------|---------|
| Client test before REGISTER | `ORA-12514` (CMAN up, service missing) |
| `remote_listener` before CMAN exists | `ORA-00132` / `ORA-00141` (hostname unresolved) |

For **two** SIDBs, set `remote_listener` + `REGISTER` on **each** database after CMAN is Healthy ([`cman-sidb-peer.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/cman/samples/cman-sidb-peer.yaml)).

---

## Multi-backend: service-alias `next_hop`

When `apppdb1` and `apppdb2` live on different SIDB Services, a **single global** `next_hop` is not enough. Use service-aware aliases:

Sample: [`cman-sidb-peer-nexthop.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/cman/samples/cman-sidb-peer-nexthop.yaml)

- Deploy **both** `sidb-sample` and `sidb-cman-peer` first.  
- ConfigMap embeds a commented `CMAN_TNSNAMES_BEGIN` / `END` block; the image extracts it to `tnsnames.ora`.  
- `use_service_as_tnsnames_alias=on` maps the requested service name to the right backend.  
- Sample uses `replicas: 2` so every CMAN pod has identical local alias routing.  

Canonical deep template with comments: [`config/samples/connectionmanager/cman-sidb-peer-filemode.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/config/samples/connectionmanager/cman-sidb-peer-filemode.yaml).

---

## Status and verification

```bash
kubectl get cman -n "$NS"
kubectl describe cman "$CMAN" -n "$NS"
kubectl get deploy,svc,pod -n "$NS" -l app.kubernetes.io/name=cman-sidb

kubectl get cman "$CMAN" -n "$NS" -o jsonpath='{.status.status}{"\n"}{.status.readyReplicas}{"\n"}{.status.externalEndpoint}{"\n"}{.status.cman.configMode}{"\n"}'
```

| Status field | Meaning |
|--------------|---------|
| `status.status` | High-level state (Healthy / Ready / Error / Maintenance, depending on release) |
| `status.readyReplicas` | Ready pods |
| `status.internalService` / `externalService` | Service names |
| `status.externalEndpoint` | LB address when reported |
| `status.cman.configMode` | `generated` or `file` |

Inside the pod:

```bash
kubectl exec -n "$NS" deploy/cman-sidb -- cmctl show services
kubectl logs -n "$NS" deploy/cman-sidb --tail=200
```

---

## Optional: RAC, Restart, external listeners

The same `ConnectionManager` CR fronts any reachable Oracle listener. Replace backend hostnames:

- RAC SCAN Service — [`cman-rac-nexthop.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/cman/samples/cman-rac-nexthop.yaml) / [`cman-rac.yaml`](https://github.com/oracle/oracle-database-operator/blob/main/docs/cman/samples/cman-rac.yaml)  
- Oracle Restart Service DNS  
- External host/IP in `next_hop` or `rules[].host`  

For RAC-on-Kubernetes provisioning see [Provision Oracle RAC…](/blog/provision-oracle-rac-database-kubernetes-operator/).

---

## Placement, replicas, and maintenance

- `spec.runtime.replicas` — scale CMAN pods; for multi-service backends prefer **service-alias** so every replica has the same local routing.  
- `nodeSelector` / `affinity` — pin or spread replicas (samples show preferred anti-affinity).  
- `spec.maintenance.enabled` — interactive maintenance shell; readiness fails and status reports Maintenance (see upstream field reference).  
- Optional PVC via `spec.storage` for persistent CMAN logs/data outside reserved config paths.

---

## Troubleshooting

| Symptom | Likely cause | What to check |
|---------|--------------|---------------|
| `ORA-12514` via CMAN (generated) | Service not registered | CMAN Healthy → `remote_listener` → `REGISTER` → `cmctl show services` |
| `ORA-00132` / `ORA-00141` on `remote_listener` | CMAN DNS missing | Deploy CMAN first; `getent hosts` from SIDB pod |
| `ORA-12529` | Rule `src`/`dst`/`srv` mismatch | Relax to `dst=*` / `srv=*` for lab tests |
| EXTERNAL-IP pending | No LB controller / bad annotations | OCI subnet OCID; or use NodePort / in-cluster only |
| Next-hop fails | Image lacks feature | Image must support `next_hop` / `CMAN_TNSNAMES_*` |
| Peer route broken | Second SIDB missing | `kubectl get svc sidb-cman-peer` before apply |
| Webhook reject | Mixed file + generated fields | Drop `rules`/`logLevel` when using `configSource` |
| Sample conflict | Two CRs named `cman-sidb` | Rename resource + listener hostname |

Full table: [docs/cman Troubleshooting](https://github.com/oracle/oracle-database-operator/tree/main/docs/cman#troubleshooting).

---

## FAQ

### Is CMAN the same as an OCI Network Load Balancer?

No. An NLB is L4 TCP load balancing. **CMAN** understands Oracle Net services, rules, and (optionally) registration. Samples often put an **NLB in front of CMAN** for a stable VIP; CMAN still does SQL\*Net routing to SIDB.

### Do I need CMAN for a single SIDB lab?

Not required. Clients can use the SIDB Service directly. CMAN adds a front door, policy, multi-backend routing, and a stable name for HA topologies.

### Can I use CMAN with Data Guard?

Yes. Prefer **global `next_hop`** (or carefully designed file-mode aliases) so Broker static connect identifiers stay reachable during switchover. See cross-cluster CMAN Data Guard docs linked above, and the [Data Guard SIDB blog](/blog/deploy-oracle-data-guard-kubernetes-sidb/).

### Generated vs file — which should I learn first?

Start with **`cman-sidb-nexthop.yaml`**. Add generated rules only when you explicitly want database registration on CMAN.

---

## SEO-friendly takeaways

**Primary question:** *How do I deploy Oracle Connection Manager with SIDB on Kubernetes using OraOperator?*  

**Answer:** Deploy a Healthy SIDB first, install OraOperator with the `ConnectionManager` CRD (preview 2.3+), apply a file-mode global `next_hop` sample (`cman-sidb-nexthop.yaml`) pointing at the SIDB Service, wait until CMAN is Healthy, then connect with Easy Connect through the CMAN external or ClusterIP endpoint. Use generated `spec.rules` only when you will set `remote_listener` and `ALTER SYSTEM REGISTER` after CMAN is up; for Data Guard switchover through CMAN, stay on `next_hop`.

**Keywords covered naturally:** Oracle Connection Manager Kubernetes, OraOperator ConnectionManager, CMAN SIDB next_hop, remote_listener CMAN, cmctl show services, SQL\*Net proxy OKE.

---

## Closing

CMAN on Kubernetes is a **front-door story**: SIDB owns the database; `ConnectionManager` owns the SQL\*Net proxy. New users succeed when they deploy backends first, pick **one** pattern (prefer global `next_hop` for simplicity and Data Guard safety), wait for CMAN Healthy, and verify with `cmctl` before blaming the client connect string.

Start from the official [docs/cman samples](https://github.com/oracle/oracle-database-operator/tree/main/docs/cman/samples), change only image, subnet, namespace, and service names that must match your cluster, and keep the CMAN README as the living field reference. When Easy Connect through CMAN returns a session to `apppdb1`, you have a reusable pattern for multi-backend aliases, RAC SCAN fronting, and HA topologies that need a stable Oracle Net endpoint.

If you already follow the [SIDB Data Guard](/blog/deploy-oracle-data-guard-kubernetes-sidb/) or [True Cache](/blog/deploy-oracle-true-cache-kubernetes-rac-primary/) guides, this CMAN post is the networking companion that sits in front of those databases on the same operator platform.
