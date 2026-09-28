---
title: "Learn Flask with a Small REST API and Jinja Demo"
description: "Build a beginner-friendly Flask application with routes, Jinja templates, SQLite persistence, registration, and login while learning the request-response cycle."
pubDate: 2026-09-28
author: "Saurabh Ahuja"
tags:
  - python
  - flask
  - rest-api
  - jinja
  - sqlite
  - beginners
draft: false
---

Flask is a useful first web framework because it lets you see the complete path from an HTTP request to a Python function and back to an HTML or JSON response. You can start with one file, add routes one concept at a time, and learn the responsibilities of a web application without adopting a large framework structure immediately.

The companion repository for this exercise is the [Microservice Flask learning repository](https://github.com/saurabhahuja71/Microservice). The demo is under [`Day1/`](https://github.com/saurabhahuja71/Microservice/tree/main/Day1) and includes a small Flask application, Jinja templates, dependency declarations, and course material.

## What you will learn

The exercise demonstrates several important Flask foundations:

- Mapping URLs to Python functions with `@app.route`.
- Returning HTML from a route and rendering a Jinja template.
- Passing values and lists from Python into a template.
- Reading form data from a `POST` request.
- Storing users in SQLite with parameterized SQL.
- Hashing passwords instead of storing them as plain text.
- Returning useful HTTP status codes for invalid input and failed login.

The application is intentionally small. That makes it easier to trace a request before moving on to blueprints, an ORM, background work, or a production server.

## Run the project

Clone the repository and move into the Flask exercise:

```bash
git clone https://github.com/saurabhahuja71/Microservice.git
cd Microservice/Day1
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python main.py
```

The development server listens on port `5001`. Open [http://127.0.0.1:5001/](http://127.0.0.1:5001/) in a browser.

The SQLite file is created locally when the application starts. It is development data, so it should remain ignored and should not be committed as part of the exercise.

## Start with a route

A Flask route connects a URL and an HTTP method to a Python function:

```python
@app.route("/aboutus")
def about_us():
    return "<h2>This is the about us page</h2>"
```

Visit `/aboutus`, and Flask calls `about_us`. The return value becomes the response body. A route parameter can be converted before the function runs:

```python
@app.route("/user/<int:user_id>")
def user(user_id: int):
    return f"User ID is: {user_id}"
```

The `int` converter means `/user/42` is accepted as an integer, while a non-numeric value does not match this route. This is a simple way to connect URL design to Python types.

## Render a Jinja template

The home route passes data to `index.html`:

```python
@app.route("/")
def home():
    return render_template(
        "index.html",
        page_title="Flask Jinja Demo",
        heading="Welcome to Flask",
        message="Hello from a Jinja2 template!",
        learner="Sahu",
        topics=["Flask", "Jinja2", "Postman"],
    )
```

The template can display those values and loop over the topics:

```html
<h1>{{ heading }}</h1>
<p>{{ message }}</p>
<ul>
  {% for topic in topics %}
  <li>{{ topic }}</li>
  {% endfor %}
</ul>
```

Jinja escapes interpolated values by default, which is safer than concatenating untrusted input directly into HTML. Keep using the template expressions for user-controlled values and avoid marking input as safe unless its source and encoding are understood.

## Handle forms and persistence

The registration page accepts `GET` to display the form and `POST` to process it:

```python
@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        # validate, hash, and insert the user
    return render_template("register.html")
```

The demo uses SQLite because it has no separate server and is easy to inspect while learning. SQL parameters are passed separately from the query:

```python
connection.execute(
    "INSERT INTO users (username, password_hash) VALUES (?, ?)",
    (username, generate_password_hash(password)),
)
```

The placeholders help prevent SQL injection. Password hashing is equally important: the database stores a derived password hash, and login uses `check_password_hash` to verify the submitted password.

For a production application, add CSRF protection, session handling, rate limiting, secure cookie settings, configuration from environment variables, and a production WSGI server. This exercise is a learning boundary, not a complete authentication system.

## Try the routes with a browser or Postman

After starting the server, try these requests:

```text
GET  /
GET  /aboutus
GET  /report/engineering
GET  /user/42
GET  /register
POST /register
GET  /login
POST /login
```

For `POST /register`, send form fields named `username` and `password`. Register a user first, then send the same fields to `POST /login`. Also try an incorrect password and observe the `401` response.

## What to build next

Once the request flow is clear, extend the exercise in small steps:

1. Add a JSON endpoint such as `GET /api/users` without returning password hashes.
2. Add tests with Flask's test client.
3. Move database operations into a separate module.
4. Add environment-based configuration for the secret key and database path.
5. Add a Dockerfile and a health endpoint.

The point of the project is not to add every feature at once. It is to make each boundary—route, template, form, database, and test—visible enough that you can explain it.

## Continue to FastAPI

Flask is an excellent way to learn the web request lifecycle and traditional WSGI applications. When an application spends much of its time waiting for network or database operations, the next useful comparison is an asynchronous framework such as FastAPI. The [FastAPI asynchronous programming guide](/blog/learn-fastapi-with-asynchronous-python/) covers that next step and explains what async does and does not improve.
