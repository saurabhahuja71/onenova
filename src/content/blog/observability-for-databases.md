---
title: "Observability Patterns for Database Platforms"
description: "Metrics, SLOs, and dashboards that actually help when Oracle or Postgres is under pressure."
pubDate: 2025-09-03
author: "Saurabh Ahuja"
tags: ["observability", "prometheus", "grafana", "databases", "sre"]
featured: true
---

Databases fail in boring ways until they fail in exciting ways. Good observability makes the boring failures visible early.

## Golden signals (adapted)

For database platforms, adapt the classic four:

| Signal | Examples |
|--------|----------|
| Latency | Query P95, commit latency, lock wait |
| Traffic | QPS, connections, transactions/sec |
| Errors | Failed logons, ORA- errors, deadlocks |
| Saturation | CPU, IOPS, redo, temp, memory |

## Prometheus tips

- Prefer **histograms** for latency; avoid averaging averages.
- Export **labels carefully** — high-cardinality SQL text will burn your TSDB.
- Alert on **symptoms** (SLO burn) before paging on every counter blip.

## Grafana layout that works

1. **Overview** — health at a glance for on-call
2. **Workload** — who is driving load
3. **Storage & HA** — capacity and replication lag
4. **Drill-down** — links to logs and traces

## Closing thought

Observability is a product for humans under stress. Optimize for time-to-insight, not chart count.
