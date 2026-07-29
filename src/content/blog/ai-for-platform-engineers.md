---
title: "AI Tooling for Platform Engineers"
description: "Where LLMs help (and hurt) when you work on Kubernetes, CI/CD, and internal developer platforms."
pubDate: 2026-01-20
author: "Saurabh Ahuja"
tags: ["ai", "platform", "devops", "productivity"]
featured: false
---

AI will not replace platform engineering. It will change how fast we draft manifests, debug failures, and document systems.

## High-leverage uses

- **Drafting** Terraform / Helm / CRDs from a clear intent
- **Explaining** unfamiliar stack traces and controller logs
- **Summarizing** long RFCs and postmortems
- **Scaffolding** tests and runbooks

## Guardrails

1. Never paste secrets into a model.
2. Treat generated YAML as untrusted until reviewed.
3. Prefer local / private models for proprietary code.
4. Keep humans in the loop for production changes.

## A practical workflow

```text
Intent → AI draft → lint/validate → peer review → apply → observe
```

Platform teams that codify validation (OPA, Kyverno, CI checks) get more value from AI because mistakes are cheaper.

## What to measure

- Time from idea to merged PR
- Change failure rate
- On-call cognitive load

If AI only increases PR volume without improving reliability, you have automation theater — not leverage.
