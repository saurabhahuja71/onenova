---
title: "Building Kubernetes Operators in Go"
description: "A practical introduction to controller-runtime, reconciliation loops, and production-ready operator patterns."
pubDate: 2025-11-12
author: "Saurabh Ahuja"
tags: ["kubernetes", "go", "operators", "cloud-native"]
featured: true
---

Kubernetes operators encode human operational knowledge into software. When done well, they turn fragile runbooks into reliable control loops.

## Why operators?

Day-2 operations — upgrades, backups, failover, scaling — rarely fit a single Helm chart. Operators close that gap by continuously reconciling **desired state** (CRDs) with **actual state** (cluster resources).

## Core loop

A typical reconcile looks like:

1. Fetch the custom resource.
2. Observe related objects (Pods, PVCs, Secrets).
3. Compute a plan (create / update / delete).
4. Apply changes and update status conditions.
5. Requeue with backoff on errors.

```go
func (r *DatabaseReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    var db myv1.Database
    if err := r.Get(ctx, req.NamespacedName, &db); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }
    // observe → plan → act → status
    return ctrl.Result{}, nil
}
```

## Production checklist

- **Status conditions** with clear `Ready` / `Degraded` semantics
- **Idempotent** reconcile (safe on restarts)
- **Finalizers** for ordered teardown
- **Metrics** (`reconcile_total`, `reconcile_errors`)
- **e2e tests** with envtest or a real kind cluster

## Further reading

- [controller-runtime](https://github.com/kubernetes-sigs/controller-runtime)
- [Operator SDK](https://sdk.operatorframework.io/)
- CNCF operator whitepapers and CKA/CKAD material

If you are starting your first operator, keep the CRD surface small and invest early in status and observability.
