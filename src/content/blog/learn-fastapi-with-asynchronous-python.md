---
title: "Learn FastAPI with Asynchronous Python"
description: "Build a typed FastAPI service and understand how async and await improve concurrent I/O-bound work without pretending that asynchronous code makes every task faster."
pubDate: 2026-09-28
author: "Saurabh Ahuja"
tags:
  - python
  - fastapi
  - async
  - asyncio
  - rest-api
  - concurrency
draft: false
---

FastAPI is a natural next step after learning the basic Flask request-response cycle. It keeps Python's approachable syntax, adds type-driven request validation and OpenAPI documentation, and works well with asynchronous endpoints when a service spends time waiting for external systems.

The companion project is [react-fastapi-todo](https://github.com/saurabhahuja71/react-fastapi-todo), a full-stack FastAPI and React application with PostgreSQL and Compose. Its backend gives you a practical place to compare typed API handlers, database access, and asynchronous request handling.

## What asynchronous programming means

An asynchronous function can pause while it waits for an I/O operation, allowing the event loop to run other work. The key words are `async` and `await`:

```python
import asyncio

async def fetch_message() -> str:
    await asyncio.sleep(1)
    return "response received"
```

The `await` does not create another CPU core and does not make the one-second operation itself faster. It gives the event loop an opportunity to handle another request while this coroutine is waiting.

That distinction matters. Async is most useful for I/O-bound work such as HTTP calls, database queries through an async driver, file or socket operations, and services that must keep many connections moving. It is not a general speed button for CPU-heavy work such as image processing, large data transformations, or model training.

## Run the FastAPI project

Clone the companion repository and follow its current setup instructions:

```bash
git clone https://github.com/saurabhahuja71/react-fastapi-todo.git
cd react-fastapi-todo
```

The repository contains both the frontend and backend. Its README is the source of truth for the exact Compose and environment setup. A minimal FastAPI service, when installed separately, can be started with:

```bash
python -m pip install fastapi uvicorn
uvicorn app.main:app --reload
```

The module path depends on the project layout. Once the server is running, FastAPI normally exposes interactive documentation at `/docs` and an OpenAPI document at `/openapi.json`.

## Define a typed endpoint

A small endpoint can use Python type annotations to describe its contract:

```python
from fastapi import FastAPI

app = FastAPI(title="Async learning API")

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

FastAPI uses the annotations to generate documentation and validate the response shape. For request bodies, define a Pydantic model:

```python
from pydantic import BaseModel

class TodoCreate(BaseModel):
    title: str
    completed: bool = False

@app.post("/todos")
async def create_todo(todo: TodoCreate) -> TodoCreate:
    return todo
```

This keeps validation close to the API contract. It also makes the generated documentation useful to a frontend developer or a person testing the endpoint in Swagger UI.

## See the advantage with concurrent I/O

Suppose one request needs two independent upstream responses. A sequential implementation waits for the first call before starting the second:

```python
first = await fetch_first_service()
second = await fetch_second_service()
return {"first": first, "second": second}
```

If the calls are independent, they can be scheduled together:

```python
import asyncio

first, second = await asyncio.gather(
    fetch_first_service(),
    fetch_second_service(),
)
return {"first": first, "second": second}
```

If each upstream call takes about 300 milliseconds and neither depends on the other, the sequential path waits for roughly 600 milliseconds. The concurrent path can approach the slower individual call, plus scheduling and network overhead. Real results depend on the services, connection pools, timeouts, and network conditions.

This is where async can improve throughput and latency: the application is productive while its current operation is waiting. It does not eliminate upstream latency, and it can increase load on those upstream systems if concurrency is left unbounded.

## Use async-compatible libraries

An `async def` endpoint only provides the expected benefit when the work it awaits is also non-blocking. Use an async HTTP client for outbound requests and an async database driver or ORM configuration for database calls. A blocking call inside an async endpoint can stop the event loop:

```python
@app.get("/bad-example")
async def bad_example():
    result = blocking_http_request()  # blocks the event loop
    return result
```

If a library is synchronous and cannot be replaced, isolate the blocking work deliberately, for example with a worker thread or a regular synchronous endpoint. Choose based on measured behavior and library support rather than changing every function to `async def` automatically.

## Async does not solve CPU-bound work

This loop still occupies the event loop while it calculates:

```python
@app.get("/expensive")
async def expensive():
    value = sum(number * number for number in range(20_000_000))
    return {"value": value}
```

For CPU-heavy work, use a process pool, a task queue, a specialized worker, or a separate service. More workers and more resources may help, but the right choice depends on the workload. Keep API handlers short and move long-running jobs behind a job boundary when users do not need to wait for completion.

## Handle timeouts and concurrency limits

Concurrent requests need explicit limits. Add timeouts to outbound calls, bound connection pools, and decide what happens when one of several upstream calls fails. A service that launches unlimited work can exhaust file descriptors, database connections, memory, or a partner API's rate limit.

A practical async endpoint should answer these questions:

- How long may each dependency call wait?
- Should partial results be returned if one dependency fails?
- How many requests may use the dependency at once?
- Is the operation safe to retry?
- What metrics show queueing, timeout, and upstream failure?

The answers are part of the API design, not just an implementation detail.

## Compare Flask and FastAPI

The Flask exercise teaches the fundamentals clearly: routes, forms, templates, SQLite, and the request-response cycle. FastAPI adds typed API contracts, generated documentation, and a strong async story for I/O-heavy services.

Neither framework makes the other obsolete. A small server-rendered application can be simple and productive in Flask. A service with many concurrent network calls, typed JSON contracts, and a frontend client may benefit from FastAPI. Measure the workload and choose the simplest framework that makes the requirements clear.

## Suggested exercises

After running the FastAPI project, try these changes:

1. Add a `/health` endpoint and a typed response model.
2. Add a `TodoCreate` request model with validation.
3. Call two independent mock services with `asyncio.gather`.
4. Add timeouts and return a useful error when an upstream service is unavailable.
5. Compare sequential and concurrent versions with a small, repeatable benchmark.
6. Move a CPU-heavy operation to a worker and compare its effect on request responsiveness.

The goal is not to use async everywhere. The goal is to recognize waiting, make concurrency explicit, and preserve a service that remains understandable under load.
