---
title: "Boltpy: A Terminal AI Coding Agent for Local Ollama and SGLang"
description: "Learn how to install and use Boltpy (Bolt), a terminal-native AI coding agent that works with local Ollama, SGLang, and OpenAI-compatible model servers. Includes beginner commands and example prompts."
pubDate: 2026-08-28
author: "Saurabh Ahuja"
tags:
  - boltpy
  - bolt
  - ai-coding-agent
  - terminal
  - ollama
  - sglang
  - local-llm
  - developer-tools
featured: true
draft: false
heroImage: "/images/blog/boltpy-terminal-ai-agent/01-boltpy-terminal.svg"
---

If you are searching for **Boltpy**, you may also see the project referred to as **Bolt**: a fast, keyboard-first, terminal-native AI coding agent for developers who want an assistant close to their code. It can inspect a project, answer questions, run bounded commands, use SSH, and work with local or self-hosted models instead of requiring a cloud AI account.

This guide explains how to install Boltpy, connect it to **Ollama** or **SGLang**, use the terminal UI, and write useful prompts as a first-time user.

![Boltpy terminal AI coding agent interface](/images/blog/boltpy-terminal-ai-agent/01-boltpy-terminal.svg)

## What is Boltpy?

Boltpy is a Python-based terminal AI coding agent. It is designed around a simple workflow:

1. Open Bolt in the project you are working on.
2. Ask a question in plain language.
3. Let Bolt inspect files or propose a plan.
4. Approve shell or SSH actions when you are ready.
5. Review the answer, test output, and changes yourself.

The terminal is the main interface, so you can use it over SSH, inside a development VM, or alongside your editor. The current interface includes a chat transcript, streaming responses, a todo panel, model selection, permission controls, plan mode, light and dark themes, and native terminal text selection.

## Why use a local terminal AI agent?

Local inference is useful when source code, prompts, or infrastructure details should remain on systems you control. Bolt supports local Ollama servers, remote Ollama servers, SGLang's OpenAI-compatible API, and other compatible inference endpoints such as vLLM or LM Studio.

Local models also make it easier to experiment with coding assistance without adding another cloud dependency. The trade-off is that response quality and speed depend on the model, GPU, RAM, network, and context window available on your machine.

## Install Boltpy

Bolt can be installed for the current Linux user without `sudo`:

```bash
curl -fsSL https://raw.githubusercontent.com/saurabhahuja71/boltpy/main/install.sh | bash
```

The installer creates an isolated environment under `~/.local/share/bolt` and places the command in `~/.local/bin`. If that directory is not already on your `PATH`, open a new shell or add it for the current session:

```bash
export PATH="$HOME/.local/bin:$PATH"
bolt --version
bolt doctor
```

For development from the source checkout:

```bash
uv sync --dev
uv run bolt --help
```

The project requires Python 3.12 or newer.

## Start Bolt with local Ollama

Install and start [Ollama](https://ollama.com/), then download a coding model. The exact model name depends on what your Ollama server exposes; `qwen3-coder` is the example used by Bolt's documentation:

```bash
ollama pull qwen3-coder
ollama list
```

Open Bolt in the current project:

```bash
bolt --provider ollama \
  --endpoint http://localhost:11434 \
  --model qwen3-coder
```

You can also use the shorter project form:

```bash
bolt .
```

For a remote Ollama host, replace the endpoint with the address reachable from your machine:

```bash
bolt --provider ollama \
  --endpoint http://ollama.internal:11434 \
  --model qwen3-coder
```

![Boltpy running with a local Ollama model](/images/blog/boltpy-terminal-ai-agent/02-boltpy-ollama-session.svg)

## Start Bolt with SGLang

SGLang exposes an OpenAI-compatible API. Start your SGLang server with a coding model, then point Bolt at the server's `/v1` endpoint:

```bash
bolt --provider sglang \
  --endpoint http://localhost:30000/v1 \
  --model Qwen/Qwen3-Coder
```

For a remote SGLang server:

```bash
bolt --provider sglang \
  --endpoint http://inference.internal:30000/v1 \
  --model Qwen/Qwen3-Coder
```

The model identifier must match the name served by SGLang. If your server uses a different OpenAI-compatible endpoint, use its provider name and URL in the same pattern.

![Boltpy using an SGLang OpenAI-compatible endpoint](/images/blog/boltpy-terminal-ai-agent/03-boltpy-sglang-session.svg)

## Your first Boltpy prompts

Start with read-only questions so you can understand the project context before allowing changes:

```text
Summarize the README and list the three most important setup steps.
```

```text
Inspect the current Git status and explain any uncommitted changes.
```

```text
Find the entry point for this application and explain the request flow.
```

```text
Read the deployment manifest and propose a plan without making changes.
```

For a multi-step coding task, be specific about the outcome and verification:

```text
Add input validation for the create-user endpoint. Inspect the existing
patterns first, propose a plan, implement the smallest change, run the
relevant tests, and show me the final diff.
```

For infrastructure work, name the exact boundary:

```text
Inspect the Kubernetes manifests. Do not apply anything. Tell me which
resources would change and what command I should run after reviewing them.
```

Good prompts tell Bolt what to inspect, what it may change, and how success should be verified. That is more reliable than asking it to “fix everything.”

## Understand Bolt's permission modes

Bolt has three useful modes:

- `ask` is the interactive default. Read-only tools can run, while shell and SSH actions request approval.
- `allow` permits tools for a headless or trusted automation flow.
- `plan` is read-first: Bolt proposes a step-by-step plan while write, shell, and SSH actions remain blocked.

Change mode from inside the terminal UI:

```text
/mode plan
/mode ask
/mode allow
```

When a shell or SSH action needs approval, choose Allow Once, Allow Session, Allow Permanently, or Deny. Permanent approvals are exact and human-readable; SSH approvals include the host, user, port, and command scope.

## Useful Bolt commands and shortcuts

Inside the TUI, these commands are especially useful:

```text
/help          Show commands and keyboard controls
/model         Choose the active configured model
/models        List models exposed by the provider
/todo          Toggle the live todo panel
/permissions   Review permanent approvals
/theme dark    Switch to the dark theme
/new           Start a new conversation
```

Important shortcuts include Enter to send, Shift+Enter for a newline, Ctrl+C to cancel the current task, Ctrl+Q to quit, Ctrl+Shift+M to cycle permission modes, and Ctrl+Shift+T to toggle the todo panel.

## Headless use in scripts

For one-off automation, `ask` streams an answer while `exec` runs with tools allowed:

```bash
bolt ask "Summarize the changed files in this repository"
bolt exec "Run the test suite and report failures only"
```

Use `--debug` when you need concise tool-loop diagnostics:

```bash
bolt exec --debug "Check the project health and report actionable failures"
```

Treat headless `exec` as an automation interface: use a dedicated workspace, avoid secrets in prompts, and keep the requested operation narrowly scoped.

## Configuration for repeatable use

Bolt loads defaults, the user configuration, a local `boltpy.toml`, and environment variables. A minimal local configuration looks like this:

```toml
provider = "ollama"
model = "qwen3-coder"
models = ["qwen3-coder", "another-local-model"]
permission_mode = "ask"
theme = "light"
```

Useful environment variables include `BOLT_PROVIDER`, `BOLT_ENDPOINT`, `BOLT_MODEL`, `BOLTPY_MODELS`, `BOLTPY_PERMISSION_MODE`, and `BOLTPY_THEME`.

## Practical safety checklist

- Never paste API keys, passwords, private keys, or production secrets into prompts.
- Start in `ask` or `plan` mode for an unfamiliar repository.
- Review generated code and YAML before committing or applying it.
- Use narrow prompts for shell and SSH work.
- Run tests and inspect `git diff` before claiming a change is complete.
- Remember that a local model can still make incorrect suggestions; local does not mean automatically correct.

## Get Boltpy and keep learning

The source code, issue tracker, and release notes are on [GitHub](https://github.com/saurabhahuja71/boltpy). If you were searching for **Boltpy**, **Bolt terminal AI**, **a local Ollama coding agent**, or **an SGLang coding assistant**, this is the same project and the same command: `bolt`.

The fastest path for a new user is: install one coding model, run `bolt .`, begin in `/mode plan`, ask focused questions, and move to `/mode ask` only after you understand what the agent intends to do.
