---
title: "Learning Path"
description: "Curated hands-on labs for college students and new engineers — Go, Python, Java, Ruby, Rust, Kubernetes, Terraform, CI/CD, AI, and Oracle Database on Kubernetes companion guides."
source: "https://github.com/saurabhahuja71/learning-path"
updated: 2026-11-25
---

# Learning Path — Labs for College Students & New Engineers

Curated hands-on repositories from [saurabhahuja71](https://github.com/saurabhahuja71) for **college students**, **early-career engineers**, and anyone learning cloud-native development.

These are **practice labs**, not production frameworks. Each track is ordered from easier → harder when possible. Start with one track; finish a lab before jumping tracks.

> **Featured workshop:** [Python by Example — interactive Python in the browser with Pyodide](https://github.com/saurabhahuja71/python-by-example)
> — start coding without installing Python. Companion write-up: [onenova.in/blog/run-python-in-browser-pyodide](https://onenova.in/blog/run-python-in-browser-pyodide/).

> **How to use this hub**
> 1. Pick a track that matches what you want to learn.
> 2. Open the lab repo → read its README → follow **Quick start**.
> 3. When a lab still has a thin README, treat the code as the source of truth and open an issue if you get stuck.
> 4. Prefer building something small of your own after each lab.
> 5. Readable mirror of this hub: [onenova.in/learning-path](https://onenova.in/learning-path).

---

## Tracks at a glance

| Track | Best for | Labs |
|-------|----------|-----:|
| [Go](#1-go--apis) | Backend APIs, gRPC, workshops | 6 |
| [Python](#2-python--data--apis) | Flask/FastAPI, data, ML intro | 7 |
| [Java / Helidon](#3-java--helidon-microservices) | Microservices on the JVM | 8 |
| [**Ruby & Rust**](#ruby--rust-from-scratch) | Full language curricula for Java/Python/Go engineers | 2 + comparisons |
| [Cloud & Kubernetes](#4-cloud-kubernetes--containers) | Docker, K8s, operators | 5 + demos |
| [Terraform & IaC](#5-terraform--infrastructure-as-code) | Infra as code (OCI / Azure / AWS ideas) | 3 + demos |
| [CI/CD](#6-cicd) | GitHub Actions, pipelines | 2 + |
| [AI & Agents](#7-ai--agents--mcp) | MCP, agents, Redis+AI | 4 |
| [Oracle Linux & systems](#oracle-linux--systems) | OL tutorials, UEK, containers, QEMU, VPN | curated |
| [Systems & fun projects](#8-systems--side-projects) | Raspberry Pi, VPN, VB | 5 |
| [Organizations review](#organizations-review--all-github-orgs) | Every org you belong to + cleanup notes | 7 orgs |
| [Frontend / fullstack](#9-frontend--fullstack) | React + backend samples | 3 |

---

## 1. Go · APIs

**Golang tutorials for students** — from Python bridge and language workshops to Gin/Postgres and full-stack **gRPC**. Each lab has an SEO-friendly README (tutorial title, FAQ, keywords).

| # | Lab | Level | What you'll practice | Status |
|---|-----|-------|----------------------|--------|
| 0 | [goforpython](https://github.com/saurabhahuja71/goforpython) — *Go for Python developers* | Beginner | Side-by-side Python vs Go | README ready |
| 1 | [golang-workshop](https://github.com/saurabhahuja71/golang-workshop) — *Golang workshop basics* | Beginner | Arrays, slices, maps, JSON, concurrency | README ready |
| 2 | [gotraining-labs](https://github.com/saurabhahuja71/gotraining-labs) — *Go training labs* | Beginner → Intermediate | Pointers, structs, interfaces, IO | README ready |
| 3 | [fullstack-go-bookapp-example](https://github.com/saurabhahuja71/fullstack-go-bookapp-example) — *Gin + PostgreSQL book app* | Intermediate | REST API + HTML templates | README ready |
| 4 | [grpc-golang-todo](https://github.com/saurabhahuja71/grpc-golang-todo) — *gRPC Go full-stack todo* | Intermediate | gRPC, grpc-gateway, React, Postgres | README ready |

**Related (Java REST design, not Go):** [User-Management-REST-Service](https://github.com/saurabhahuja71/User-Management-REST-Service) — Jakarta EE user CRUD (layered architecture) · README ready

**Recently opened (was private):**
| Lab | Focus |
|-----|--------|
| [sample-restapi-go](https://github.com/saurabhahuja71/sample-restapi-go) | Minimal `/books` REST server |
| [simple-rest-api-in-go](https://github.com/saurabhahuja71/simple-rest-api-in-go) | Go + Postgres + Docker Compose |
| [demo-container-app](https://github.com/saurabhahuja71/demo-container-app) | Go container + K8s YAML |


## 2. Python · Data · APIs

**Python tutorials for students** — browser playground → FastAPI/Flask full stack → ML notebooks. Each lab has an SEO-friendly README (tutorial title, FAQ, keywords).

| # | Lab | Level | What you'll practice | Status |
|---|-----|-------|----------------------|--------|
| 0 | [python-by-example](https://github.com/saurabhahuja71/python-by-example) — *Python in the browser (Pyodide)* | Beginner | Interactive Python playground | README ready |
| 1 | [react-fastapi-todo](https://github.com/saurabhahuja71/react-fastapi-todo) — *FastAPI + React + PostgreSQL* | Intermediate | Full-stack todo, OpenAPI, Compose · [FastAPI async blog](https://onenova.in/blog/learn-fastapi-with-asynchronous-python/) | README ready |
| 2 | [Microservice](https://github.com/saurabhahuja71/Microservice/tree/main/Day1) — *Flask REST API and Jinja demo* | Beginner | Flask routes, templates, forms, SQLite · [Flask learning blog](https://onenova.in/blog/learn-flask-with-a-small-rest-api/) | README ready |
| 3 | [pets-updates](https://github.com/saurabhahuja71/pets-updates) — *Flask Pets + GitHub workshop* | Beginner → Intermediate | Flask/SQLAlchemy + Copilot labs | README ready |
| 4 | [sample-regression-model](https://github.com/saurabhahuja71/sample-regression-model) — *Linear regression (scikit-learn)* | Beginner (ML) | Bangalore rent prediction | README ready |
| 5 | [datascienceandmachinelearning](https://github.com/saurabhahuja71/datascienceandmachinelearning) — *NumPy / Pandas notebooks* | Intermediate | Multi-day DS curriculum | README ready |
| 6 | [algotrading-sample](https://github.com/saurabhahuja71/algotrading-sample) — *Algo trading learning stub* | Intermediate | Datetime + strategy scaffold | README ready |

**Containers companion:** [hello](https://github.com/saurabhahuja71/hello) — multi-arch Docker/buildah Hello World · README ready

**Recently opened (was private):**
| Lab | Focus |
|-----|--------|
| [pyhton-flask-sample-app](https://github.com/saurabhahuja71/pyhton-flask-sample-app) | Flask sample (name has historical typo) |
| [python-rest-api-flask-example-basic-store](https://github.com/saurabhahuja71/python-rest-api-flask-example-basic-store) | Flask store REST API |
| [cloud-native-python-sample](https://github.com/saurabhahuja71/cloud-native-python-sample) | Flask + SQLite |


## 3. Java · Helidon microservices

**Helidon MicroProfile tutorials for students** — a numbered mini-course from unit testing to Slack integration. Each lab has an SEO-friendly README (tutorial title, FAQ, keywords) so Google and GitHub search can find them.

Do them in order:

| # | Lab | Level | What you'll practice | Status |
|---|-----|-------|----------------------|--------|
| 0 | [junit-labs](https://github.com/saurabhahuja71/junit-labs) — *JUnit 5 tutorial for beginners* | Beginner | Unit testing with JUnit Jupiter | README ready |
| 1 | [helidon-cloudnative-microservice-sample](https://github.com/saurabhahuja71/helidon-cloudnative-microservice-sample) — *Helidon cloud-native REST microservice* | Beginner+ | REST, health, metrics, Docker, K8s | README ready |
| 2 | [helidon-rest-db-connection-demo](https://github.com/saurabhahuja71/helidon-rest-db-connection-demo) — *Helidon JPA + H2 database* | Intermediate | REST + JPA + transactions | README ready |
| 3 | [helidon-openapi-demo](https://github.com/saurabhahuja71/helidon-openapi-demo) — *Helidon OpenAPI / Swagger UI* | Intermediate | API documentation | README ready |
| 4 | [helidon-security-demo](https://github.com/saurabhahuja71/helidon-security-demo) — *Helidon Basic Auth & RBAC* | Intermediate | AuthN / AuthZ / roles | README ready |
| 5 | [helidon-slack-demo](https://github.com/saurabhahuja71/helidon-slack-demo) — *Helidon Slack webhook* | Intermediate | Outbound integrations | README ready |
| — | [learning-java-springboot](https://github.com/saurabhahuja71/learning-java-springboot) | Beginner → Intermediate | Spring Boot learning materials | Code-first |
| — | [react-java-todo](https://github.com/saurabhahuja71/react-java-todo) | Intermediate | React + Java full-stack todo | Code-first |

**Recently opened:** [hello-world-java](https://github.com/saurabhahuja71/hello-world-java) — Gradle Hello World (Lab 0 companion).

---

## Ruby & Rust From Scratch

**Full beginner → intermediate curricula** for engineers who already know Java, Python, or Go. Side-by-side comparisons throughout. Each language is its own repository so tooling stays clean.

| # | Lab | Level | What you'll practice | Status |
|---|-----|-------|----------------------|--------|
| 1 | [ruby-from-scratch](https://github.com/saurabhahuja71/ruby-from-scratch) — *Modern Ruby from scratch* | Beginner → Intermediate | Syntax, OOP, blocks/procs, Enumerable, RSpec, metaprogramming, Sinatra API | **README ready** |
| 2 | [Rust-learning](https://github.com/saurabhahuja71/Rust-learning) — *Rust from scratch (ownership-first)* | Beginner → Intermediate | Ownership/borrowing, structs/enums, traits, Result/Option, iterators, threads + Tokio, smart pointers | **README ready** |

### Hub extras (this repo)

| Resource | Description |
|----------|-------------|
| [tracks/ruby-and-rust](https://github.com/saurabhahuja71/learning-path/blob/main/tracks/ruby-and-rust/README.md) | Learning orders, how to study, clone commands |
| [Comparisons](https://github.com/saurabhahuja71/learning-path/tree/main/tracks/ruby-and-rust/03-comparing-ruby-and-rust) | Memory (GC vs ownership), concurrency, errors, when to choose which, syntax cheatsheet |
| [Capstones](https://github.com/saurabhahuja71/learning-path/blob/main/tracks/ruby-and-rust/04-real-world-projects/README.md) | Polyglot / real-world project ideas |
| [Resources](https://github.com/saurabhahuja71/learning-path/blob/main/tracks/ruby-and-rust/resources.md) | Books, docs, communities |

### Suggested path

1. Read [tracks/ruby-and-rust](https://github.com/saurabhahuja71/learning-path/blob/main/tracks/ruby-and-rust/README.md)  
2. Clone both curricula  
3. **Option A (recommended for app engineers):** Ruby first → comparisons → Rust  
4. **Option B:** Rust first (if you care about systems/performance)  
5. Finish with a [capstone](https://github.com/saurabhahuja71/learning-path/blob/main/tracks/ruby-and-rust/04-real-world-projects/README.md)

```bash
git clone https://github.com/saurabhahuja71/ruby-from-scratch.git
git clone https://github.com/saurabhahuja71/Rust-learning.git
# optional: this hub for comparisons
git clone https://github.com/saurabhahuja71/learning-path.git
```

**SEO / tags:** `ruby` `rust` `from-scratch` `ownership` `tutorial` `java` `python` `go` `learning-path`

---

## 4. Cloud, Kubernetes & containers

| # | Lab | Level | What you'll practice |
|---|-----|-------|----------------------|
| 1 | [hello](https://github.com/saurabhahuja71/hello) | Beginner | Multi-arch container builds |
| 2 | [docker-scout-example](https://github.com/saurabhahuja71/docker-scout-example) | Beginner | Image scanning / Scout concepts *(thin — expand soon)* |
| 3 | [memcached-operator](https://github.com/saurabhahuja71/memcached-operator) | Advanced | Kubernetes operator pattern |
| 4 | [raspios-qemu](https://github.com/saurabhahuja71/raspios-qemu) | Intermediate | Raspberry Pi OS under QEMU |
| 5 | [oraclevpn](https://github.com/saurabhahuja71/oraclevpn) | Intermediate | VPN-related systems work |

**Recently opened (was private):**
| Lab | Focus |
|-----|--------|
| [kubernetes-basics](https://github.com/saurabhahuja71/kubernetes-basics) | nginx Pod/Deploy/Service YAMLs |
| [helm-basic](https://github.com/saurabhahuja71/helm-basic) | Minimal Helm chart |
| [demo-container-app](https://github.com/saurabhahuja71/demo-container-app) | App + Docker + K8s |

**Companion reading (Oracle Database on Kubernetes — production-style):**

| Guide | Topic |
|-------|--------|
| [Provision Oracle Restart on Kubernetes](https://onenova.in/blog/provision-oracle-restart-database-kubernetes-operator/) | OraOperator Restart CR |
| [Provision Oracle RAC on Kubernetes](https://onenova.in/blog/provision-oracle-rac-database-kubernetes-operator/) | OraOperator RAC CR |
| [True Cache next to K8s apps](https://onenova.in/blog/deploy-oracle-true-cache-kubernetes-rac-primary/) | True Cache SIDB + RAC primary |
| [Data Guard on Kubernetes](https://onenova.in/blog/deploy-oracle-data-guard-kubernetes-sidb/) | SIDB + DataguardBroker (+ TCPS) |
| [CMAN + SIDB on Kubernetes](https://onenova.in/blog/deploy-oracle-cman-sidb-kubernetes/) | ConnectionManager SQL\*Net front door |
| Hub overview blog | [Build a cloud-native learning path](https://onenova.in/blog/build-cloud-native-learning-path/) |

Official operator docs: [oracle/oracle-database-operator](https://github.com/oracle/oracle-database-operator) · [docs/sidb](https://github.com/oracle/oracle-database-operator/tree/main/docs/sidb) · [docs/cman](https://github.com/oracle/oracle-database-operator/tree/main/docs/cman)

---

## 5. Terraform & infrastructure as code

**IaC tutorials for students** — Oracle Cloud with Terraform/Ansible, Azure Jenkins, plus private samples coming later. SEO-friendly READMEs on each public lab.

| # | Lab | Level | What you'll practice | Status |
|---|-----|-------|----------------------|--------|
| 1 | [oci_terraform_samples](https://github.com/saurabhahuja71/oci_terraform_samples) — *Terraform on OCI* | Intermediate | VCN, compute, LB, buckets, modules | README ready |
| 2 | [oci_ansible_samples](https://github.com/saurabhahuja71/oci_ansible_samples) — *Ansible on OCI* | Intermediate | Playbooks, facts, httpd | README ready |
| 3 | [terraform-azure-jenkins-sample](https://github.com/saurabhahuja71/terraform-azure-jenkins-sample) — *Jenkins on Azure VM* | Intermediate | azurerm + bootstrap script | README ready |

**Recently opened (was private):**
| Lab | Focus |
|-----|--------|
| [terraform-gke-app-demo](https://github.com/saurabhahuja71/terraform-gke-app-demo) | GKE cluster with Terraform |
| [host-dynamic-static-web-azure-terraform-docker-sample](https://github.com/saurabhahuja71/host-dynamic-static-web-azure-terraform-docker-sample) | Azure dual-VM web + Docker/Minikube |


## 6. CI/CD

**CI/CD tutorials for students** — GitHub Actions custom actions and repo hygiene templates. Jenkins-on-VM is under the Terraform track.

| # | Lab | Level | What you'll practice | Status |
|---|-----|-------|----------------------|--------|
| 1 | [github-action-demo](https://github.com/saurabhahuja71/github-action-demo) — *Docker container action* | Beginner | action.yml, Dockerfile, workflow | README ready |
| 2 | [sample-template-repo](https://github.com/saurabhahuja71/sample-template-repo) — *GitHub template hygiene* | Beginner | README, SECURITY, CONTRIBUTING | README ready |
| — | [terraform-azure-jenkins-sample](https://github.com/saurabhahuja71/terraform-azure-jenkins-sample) | Intermediate | Self-hosted Jenkins via Terraform | README ready |

**Recently opened:** [jenkins-sample](https://github.com/saurabhahuja71/jenkins-sample) — Jenkinsfile + Groovy sample.

## 7. AI · Agents · MCP

**Modern AI labs for students** — Model Context Protocol, terminal agents, LangChain ReAct, and Redis RAG. Each has an SEO-friendly README (tutorial title, FAQ, keywords).

| # | Lab | Level | What you'll practice | Status |
|---|-----|-------|----------------------|--------|
| 0 | [mcp-demo](https://github.com/saurabhahuja71/mcp-demo) — *MCP server in Go* | Beginner → Intermediate | Tools, stdio/HTTP, Docker | README ready |
| 1 | [agenterm](https://github.com/saurabhahuja71/agenterm) — *Terminal AI agent + MCP client* | Intermediate | Ollama/OpenAI TUI, tools | README ready |
| 2 | [agentic-ai-sample](https://github.com/saurabhahuja71/agentic-ai-sample) — *LangChain ReAct agent* | Intermediate | OpenAI + Tavily search loop | README ready |
| 3 | [workshop-redis-ai](https://github.com/saurabhahuja71/workshop-redis-ai) — *Redis vector search & RAG* | Intermediate | Hybrid search, semantic cache, guardrails | README ready |

## Oracle Linux & systems

**Oracle Linux learning path** for students and engineers—plus links where this maintainer **actively participates** in Oracle open source (containers, database images, operators).

### A. Official Oracle Linux learning (start here)

Study and contribute **upstream** (do not rely on stale personal forks of huge trees):

| # | Upstream project | What you'll learn |
|---|------------------|-------------------|
| 1 | [oracle/oracle-linux](https://github.com/oracle/oracle-linux) | Scripts, examples, tutorials to get started with **Oracle Linux** |
| 2 | [oracle/migrate-to-ol](https://github.com/oracle/migrate-to-ol) | Migrate existing systems **to Oracle Linux** |
| 3 | [oracle/container-images](https://github.com/oracle/container-images) | Official **Oracle Linux container images** |
| 4 | [oracle/linux-uek](https://github.com/oracle/linux-uek) | **Unbreakable Enterprise Kernel (UEK)** sources |
| 5 | [oracle/bpftune](https://github.com/oracle/bpftune) | BPF-based auto-tuning on Linux |
| 6 | [oracle/dtrace](https://github.com/oracle/dtrace) | DTrace on Linux |
| 7 | [oracle/qemu](https://github.com/oracle/qemu) | QEMU tree used in Oracle contexts |

Docs worth bookmarking: [docs.oracle.com/oracle-linux](https://docs.oracle.com/en/operating-systems/oracle-linux/) · [yum.oracle.com](https://yum.oracle.com/)

### B. Active open-source participation (containers & data)

These are **not “toy labs”**—they are production Oracle OSS repos this maintainer contributes to via PRs:

| Project | Focus | How to learn |
|---------|--------|--------------|
| [oracle/docker-images](https://github.com/oracle/docker-images) | Dockerfiles for Oracle Database, Java, Instant Client, … | Read `OracleDatabase/`, build lab images, study PR history |
| [oracle/oracle-database-operator](https://github.com/oracle/oracle-database-operator) | Kubernetes operator for Oracle Database | Operator patterns on OL/OKE-style clusters |

Personal working fork (for PRs only—prefer upstream for students): [saurabhahuja71/docker-images](https://github.com/saurabhahuja71/docker-images)

### C. Personal companion labs (SEO READMEs)

| Lab | Level | Practice |
|-----|-------|----------|
| [raspios-qemu](https://github.com/saurabhahuja71/raspios-qemu) | Intermediate | **QEMU aarch64 on Oracle Linux 9** hosts (bundle pattern when packages are missing) |
| [oraclevpn](https://github.com/saurabhahuja71/oraclevpn) | Intermediate | **Podman** + OpenConnect/AnyConnect-style VPN container |
| [hello](https://github.com/saurabhahuja71/hello) | Beginner+ | Multi-arch **buildah/Docker** images (amd64/arm64) |

### Suggested 2-week OL starter plan

| Week | Focus | Actions |
|------|--------|---------|
| 1 | Install & basics | Install OL (or OL container), work through [oracle/oracle-linux](https://github.com/oracle/oracle-linux), try [migrate-to-ol](https://github.com/oracle/migrate-to-ol) docs |
| 1 | Containers | Pull/build from [container-images](https://github.com/oracle/container-images); multi-arch with [hello](https://github.com/saurabhahuja71/hello) |
| 2 | Virtualization | [raspios-qemu](https://github.com/saurabhahuja71/raspios-qemu) on an OL9 laptop/server |
| 2 | Product containers | Skim [docker-images](https://github.com/oracle/docker-images) `OracleDatabase` samples (licensing applies) |

### SEO tags for this track

`oracle-linux` `uek` `enterprise-linux` `podman` `qemu` `containers` `oracle-database` `docker-images` `ol9` `linux-admin` `tutorial`

## 8. Systems & side projects

> Prefer the **[Oracle Linux & systems](#oracle-linux--systems)** track for OL/UEK/container study. This section keeps smaller personal experiments.

| Lab | Notes |
|-----|--------|
| [raspios-qemu](https://github.com/saurabhahuja71/raspios-qemu) | Boot Raspberry Pi OS under QEMU |
| [oraclevpn](https://github.com/saurabhahuja71/oraclevpn) | VPN project |
| [Rust-learning](https://github.com/saurabhahuja71/Rust-learning) | **Full Rust curriculum** — see [Ruby & Rust track](#ruby--rust-from-scratch) |
| [ruby-from-scratch](https://github.com/saurabhahuja71/ruby-from-scratch) | **Full Ruby curriculum** — see [Ruby & Rust track](#ruby--rust-from-scratch) |
| [vbcookbook](https://github.com/saurabhahuja71/vbcookbook) | Visual Builder cookbook |
| [vbstudiolabs](https://github.com/saurabhahuja71/vbstudiolabs) | VB Studio labs |
| [hello_flutter](https://github.com/saurabhahuja71/hello_flutter) | Flutter sample *(needs content)* |

---

## 9. Frontend · fullstack

| # | Lab | Level | What you'll practice |
|---|-----|-------|----------------------|
| 1 | [ahujasa-frontend-backend-sample](https://github.com/saurabhahuja71/ahujasa-frontend-backend-sample) | Intermediate | Front + back sample |
| 2 | [react-fastapi-todo](https://github.com/saurabhahuja71/react-fastapi-todo) | Intermediate | React + FastAPI |
| 3 | [react-java-todo](https://github.com/saurabhahuja71/react-java-todo) | Intermediate | React + Java |

---

## Suggested 4-week starter plan (college)

If you are early in college and want a structured month:

| Week | Focus | Labs |
|------|--------|------|
| 1 | Language fundamentals | `python-by-example` **or** `golang-workshop` **or** start [ruby-from-scratch](https://github.com/saurabhahuja71/ruby-from-scratch) / [Rust-learning](https://github.com/saurabhahuja71/Rust-learning) |
| 2 | First API | `react-fastapi-todo` **or** `grpc-golang-todo` **or** Sinatra chapter in `ruby-from-scratch` |
| 3 | Containers | `hello` + read about multi-arch builds |
| 4 | Cloud / automation | `oci_terraform_samples` **or** `github-action-demo` |

Stretch: pick one Helidon lab or `mcp-demo` in week 4 if you already know Java/AI.

**Dedicated language deep-dive (8 weeks):** follow [Ruby & Rust From Scratch](#ruby--rust-from-scratch) — Ruby first or Rust first — using the comparisons in [`tracks/ruby-and-rust`](https://github.com/saurabhahuja71/learning-path/blob/main/tracks/ruby-and-rust/README.md).

---

## Repo quality legend

We are improving labs over time. Use this when you open a repo:

| Status | Meaning |
|--------|---------|
| **Ready** | Code + usable README (goal for all public labs) |
| **Code-first** | Code works; README is thin — follow source + issues |
| **Shell** | Placeholder — being filled or retired |
| **Private → public** | Good lab still private; will open after cleanup |

This hub will be updated as READMEs are standardized (what / audience / prerequisites / quick start / next lab).

---

## Contributing as a learner

You do **not** need to be an expert:

- Open an issue: “Lab X failed on Ubuntu 24.04 with error …”
- Suggest README fixes (typos, missing steps)
- Share what you built after finishing a track

Keep PRs small and focused. Prefer clarity over cleverness.

---

## Organizations review — all GitHub orgs

Complete inventory of GitHub **organizations** associated with [@saurabhahuja71](https://github.com/saurabhahuja71) (from API membership). Use this section to decide what students should follow vs what to archive or hide.

| Org | Role | Public on profile? | Public repos (approx.) | Purpose (today) | Student relevance | Suggested action |
|-----|------|--------------------|------------------------|-----------------|-------------------|------------------|
| [oracle](https://github.com/oracle) | member | **Yes** | ~315 | Open Source at Oracle (Graal, OCI SDKs, WebLogic, docker-images, OL, …) | **High** — primary professional OSS | Keep; link from Oracle Linux & container tracks |
| [Utilties](https://github.com/Utilties) *(name spelling)* | **admin** | No | ~35 | “Placeholder for forked repos” + skills sandboxes | **Low** for portfolio | Review forks; delete unused; rename org if kept |
| [LeafixOS](https://github.com/LeafixOS) | **admin** | No | 3 | Arch-based OS experiment (`leafix-iso`, forum) | Medium if ISO is real | Fill READMEs or archive if abandoned |
| [quantdlinux](https://github.com/quantdlinux) | **admin** | No | 2 | Debian-based QuantD Linux (`quantd-iso`, site) | Medium (distro/ISO learners) | SEO README + link from systems track if active |
| [quantg-linux](https://github.com/quantg-linux) | **admin** | No | 0 public (`quantg-iso` private) | QuantG ISO placeholder | Low until public | Publish or merge into quantdlinux |
| [quantr-linux](https://github.com/quantr-linux) | **admin** | No | 0 | Empty org | None | **Delete org** or park a single README |
| [Tradebots71](https://github.com/Tradebots71) | **admin** | No | 0 public (private trading bots) | Covered-call / m.Stock bots | None for public students | Keep private; never expose keys; optional later “paper trading” lab |

### Org-by-org notes

#### 1. `oracle` — keep & highlight

- **What it is:** Oracle’s main public OSS org ([developer.oracle.com/open-source](https://developer.oracle.com/open-source.html)).
- **Why it matters for students:** production-grade code, real PR process, Oracle Linux, containers, operators, Graal, OCI SDKs.
- **Your angle:** active PRs on **docker-images**, **oracle-database-operator**, plus OL/UEK/container learning path above.
- **Do not** treat personal forks as the source of truth—send students to `oracle/...` upstream.

#### 2. `Utilties` — cleanup candidate
### Utilties cleanup status (safe batch) — done via archive

**Active keepers (6):**
- Forks: `docker-images`, `oracle-database-operator`
- Originals: `raspberrypios`, `oraclelinux-docker` (private), `ubuntu-docker` (private), `paxosworkshop`

**Archived (31 one-shot forks):** GitHub Skills repos, `Spoon-Knife`, and unused forks (`grafana`, `kubespray`, `fzf`, `nushell`, `bottlerocket`, `meetup-golang`, …). Archived = read-only and hidden from normal “active” browsing; can un-archive later.

**Hard delete (optional later):** token needs `delete_repo` scope:

```bash
gh auth refresh -h github.com -s delete_repo
~/utilties-safe-cleanup.sh   # deletes non-keeper forks permanently
```



- **What it is:** Admin org described as *“Placeholder for forked repos”* (note the spelling **Utilties**).
- **Contains:** forks such as `docker-images`, `oracle-database-operator`, GitHub Skills sandboxes (`introduction-to-github`, …), private `oraclelinux-docker` / `ubuntu-docker`.
- **Problem:** duplicates personal forks; noisy for discovery; typo in org name.
- **Suggested cleanup:**
  1. List every repo → keep only forks with **open PRs** or unique commits.
  2. Delete skills one-shot repos after completion.
  3. Either rename org to something clear (`saurabh-forks`) or fold remaining work under the user account.
  4. Document in org profile README: “Working forks only — prefer upstream.”

#### 3. `LeafixOS` — productize or archive

- Repos: `leafix-iso`, `leafix-forum`, `.github`.
- If ISO builds still matter: add SEO READMEs + install docs + link from systems track.
- If not maintained: archive the org repos and pin a “historical” note.

#### 4. `quantdlinux` — distro track (active-ish)

- `quantd-iso` — Debian-based ISO (you already merged prep/release PRs).
- `quantdlinux.github.io` — project site.
- **Next:** student-facing README (build ISO, burn, first boot), screenshots, license clarity.
- Optional: link under [Oracle Linux & systems](#oracle-linux--systems) as “related community distro experiments” only if you want that brand public.

#### 5. `quantg-linux` / `quantr-linux` — empty or private-only

- **quantg-linux:** private `quantg-iso` only → either open-source with README or delete org.
- **quantr-linux:** zero repos → **delete** empty org to reduce clutter.

#### 6. `Tradebots71` — keep private

- Private: `covered_call_bot`, `covered_call_bot_mstock`.
- **Not** part of the public student curriculum (financial risk + secrets).
- Hard rules: no API keys in git; prefer paper/sandbox modes; separate from `learning-path`.

### Summary scorecard

| Priority | Orgs | Action |
|----------|------|--------|
| **Strategic** | `oracle` | Feature in hub + profile; contribute upstream |
| **Tidy** | `Utilties` | Cull forks/skills; rename or document |
| **Decide** | `LeafixOS`, `quantdlinux` | Ship docs or archive |
| **Remove / merge** | `quantg-linux`, `quantr-linux` | Empty/private-only noise |
| **Private only** | `Tradebots71` | Stay off public learning hub |



### Personal account cleanup (saurabhahuja71)

| Action | Count | Notes |
|--------|------:|-------|
| **Archived empty originals** | 20 | Shells with no real code (`test-repo`, empty terraform basics, …) |
| **Archived personal forks** | 102 | Click-forks / workshops; reversible |
| **Active keepers (forks)** | 2 | `docker-images`, `oracle-database-operator` (Oracle OSS work) |
| **Active originals** | ~69 | Curriculum labs + private demos still available |

Profile is much cleaner: **~71 active** vs **~193** before this pass. Un-archive any fork you need for a PR.


### Empty / thin orgs status

| Org | Status | Action taken / next |
|-----|--------|---------------------|
| `quantr-linux` | **Empty** (0 repos) | API delete needs `admin:org` scope. Delete in UI: org → Settings → Delete this organization. Or: `gh auth refresh -h github.com -s admin:org` then `gh api --method DELETE orgs/quantr-linux` |
| `quantg-linux` | 1 private repo (`quantg-iso`) | Keep until you merge into quantdlinux or open-source the ISO |
| `Utilties` | Cleaned | 31 forks **archived**; org profile README added; 6 active keepers |
| `LeafixOS` | Active experiment | `leafix-iso` README improved; still needs ISO build docs |
| `quantdlinux` | Active | Already has solid `quantd-iso` README — good public distro lab |
| `Tradebots71` | Private bots | Leave private |


### Profile visibility

Currently **only `oracle` is public** on the GitHub profile org list. Other orgs are private membership or not shown—fine for experiments; promote an org only when its README and purpose are clear.

### Related links

- Student hub: [learning-path](https://github.com/saurabhahuja71/learning-path)
- Readable mirror: [onenova.in/learning-path](https://onenova.in/learning-path)
- Oracle Linux track: [Oracle Linux & systems](#oracle-linux--systems)
- Website: [onenova.in](https://onenova.in)
- Profile site (GitHub Pages): [saurabhahuja71.github.io](https://saurabhahuja71.github.io)

## About the author

**Saurabh Ahuja** — Sr Principal Data Systems Engineer (Oracle), cloud & infrastructure, **Oracle Linux**, Kubernetes, Go, Oracle Database operators, and Oracle container images.

- Website: [onenova.in](https://onenova.in)
- Learning path: [onenova.in/learning-path](https://onenova.in/learning-path)
- Profile: [saurabhahuja71](https://github.com/saurabhahuja71)
- GitHub Pages: [saurabhahuja71.github.io](https://saurabhahuja71.github.io)
- LinkedIn: [saurabhahuja71](https://www.linkedin.com/in/saurabhahuja71)

---

## License note

Each lab keeps its **own** license (or none yet). Check the individual repository before reusing code in coursework or products.

---

*Hub status: curriculum tracks + Ruby/Rust map + public demos linked. Prefer opening issues on individual lab repos when a README is thin. Org cleanup (empty/experimental orgs) is tracked in the Organizations review section above.*
