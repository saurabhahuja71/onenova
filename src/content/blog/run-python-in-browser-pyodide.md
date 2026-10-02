---
title: "Run Python in Your Browser with Pyodide: 10 Hands-On Examples"
description: "Learn Python without installing anything: use the Python by Example playground to run strings, loops, functions, data transformations, and a mini text analyzer directly in your browser."
pubDate: 2026-10-02
author: "Saurabh Ahuja"
tags:
  - python
  - pyodide
  - browser-python
  - webassembly
  - beginner
  - programming-tutorial
  - coding-playground
  - education
featured: true
draft: false
---

You can learn your first Python concepts before installing Python, creating a virtual environment, or opening a terminal. The [Python by Example playground](https://saurabhahuja71.github.io/python-by-example/) loads Python in the browser with [Pyodide](https://pyodide.org/), a CPython distribution compiled to WebAssembly.

That makes the feedback loop delightfully short: open the page, wait for **Python ready**, paste a small program, and click **Run Code**. The companion [GitHub repository](https://github.com/saurabhahuja71/python-by-example) is intentionally small enough to read in one sitting and extend as a classroom, workshop, or self-study exercise.

This tutorial takes that tiny playground and turns it into a practical first Python session. Every example below is designed to run as-is in the same editor.

## What you will learn

By the end, you will have practiced:

- expressions, variables, and formatted strings
- lists, dictionaries, loops, and comprehensions
- functions and simple validation
- sorting and aggregating structured data
- reading multi-line text already stored in your program
- a small text-analysis project you can extend

No local Python installation is required for these examples. A modern browser is enough.

## Start the playground

Open the [live Python by Example playground](https://saurabhahuja71.github.io/python-by-example/) and wait until its status says **Python ready**. Replace the starter code with one example at a time, then press **Run Code**.

The first load can take a little longer because the browser downloads the Python runtime. Later runs are much faster because the browser can reuse cached files. The code executes in the page; it is not sent to a server as a normal form submission.

If you prefer to run the project locally, clone it and serve the repository root:

```bash
git clone https://github.com/saurabhahuja71/python-by-example.git
cd python-by-example
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Example 1: Make the browser say hello

Start with output, variables, and an f-string:

```python
name = "Python learner"
topic = "browser programming"

print(f"Hello, {name}!")
print(f"Today we are learning {topic}.")
```

The `f` before the string lets Python insert the values inside `{}`. Try changing `name` and `topic`, run the program again, and observe how quickly you get feedback.

## Example 2: Turn minutes into a study plan

Python becomes useful when it transforms input into a result. This example converts a total number of study minutes into hours and remaining minutes:

```python
total_minutes = 95
hours = total_minutes // 60
minutes = total_minutes % 60

print(f"Study time: {hours} hour(s) and {minutes} minute(s)")
```

`//` gives the whole-number quotient and `%` gives the remainder. Try `45`, `120`, and `185` to test the logic.

## Example 3: Classify numbers with a loop

Loops let you repeat an operation without copying the same lines over and over:

```python
numbers = [3, 8, 13, 21, 34, 55]

for number in numbers:
    if number % 2 == 0:
        print(number, "is even")
    else:
        print(number, "is odd")
```

The loop visits each item. The condition checks whether division by two leaves a remainder. Change the list and add numbers of your own.

## Example 4: Use a list comprehension

Once a loop makes sense, the same transformation can often be written as a list comprehension:

```python
numbers = [1, 2, 3, 4, 5, 6]
squares = [number * number for number in numbers]
even_squares = [value for value in squares if value % 2 == 0]

print("Squares:", squares)
print("Even squares:", even_squares)
```

Read the first comprehension from left to right: take each `number`, calculate `number * number`, and collect the results into a new list.

## Example 5: Write a reusable function

Functions give a name to a piece of logic. They also make experiments easier because you can call the same code with different values:

```python
def study_message(name, minutes):
    if minutes <= 0:
        return f"{name}, choose a study time greater than zero."

    if minutes >= 60:
        hours = minutes // 60
        remaining = minutes % 60
        return f"{name}, plan {hours} hour(s) and {remaining} minute(s)."

    return f"{name}, plan {minutes} focused minute(s)."


print(study_message("Asha", 30))
print(study_message("Ravi", 90))
print(study_message("Mina", 0))
```

The `return` statement sends a value back to the caller. Try adding a rule for a long break when `minutes >= 120`.

## Example 6: Summarize a class using dictionaries

A dictionary stores related values under readable keys. Here, each learner has a name and a list of quiz scores:

```python
learners = [
    {"name": "Asha", "scores": [8, 9, 10]},
    {"name": "Ravi", "scores": [7, 8, 6]},
    {"name": "Mina", "scores": [10, 9, 9]},
]

for learner in learners:
    average = sum(learner["scores"]) / len(learner["scores"])
    print(f"{learner['name']}: {average:.1f}/10")
```

`sum()` totals the scores, `len()` counts them, and `:.1f` formats the average to one decimal place. This is the same kind of small transformation you will use later with CSV files, API responses, and database records.

## Example 7: Rank results with `sorted`

Python can sort structured records using a key function:

```python
projects = [
    {"name": "Weather dashboard", "completed": 12},
    {"name": "CLI notes", "completed": 19},
    {"name": "Reading tracker", "completed": 7},
]

ranked = sorted(projects, key=lambda project: project["completed"], reverse=True)

for position, project in enumerate(ranked, start=1):
    print(f"{position}. {project['name']} — {project['completed']} tasks")
```

The `lambda` tells `sorted()` which value to compare. `reverse=True` puts the largest number first. Try sorting alphabetically by changing the key to `project["name"]` and removing `reverse=True`.

## Example 8: Analyze text without a file

The browser playground can work with multi-line strings, so you can explore text processing without setting up a file:

```python
notes = """
Python is readable.
Small programs are useful.
Practice makes progress.
"""

lines = [line.strip() for line in notes.splitlines() if line.strip()]
words = " ".join(lines).split()

print("Lines:", len(lines))
print("Words:", len(words))
print("Characters:", len(" ".join(lines)))
```

The `splitlines()` method separates the text into lines. The list comprehension removes blank lines, and `split()` separates words on whitespace.

## Example 9: Build a mini word-frequency analyzer

Now combine strings, dictionaries, loops, and sorting into a small project:

```python
text = """
Python makes it easy to learn by doing.
Doing small projects builds confidence.
Python projects become more useful with practice.
"""

words = text.lower().replace(".", "").split()
counts = {}

for word in words:
    counts[word] = counts.get(word, 0) + 1

ranking = sorted(counts.items(), key=lambda item: item[1], reverse=True)

print("Most common words:")
for word, count in ranking[:5]:
    print(f"{word}: {count}")
```

This is a useful pattern: normalize input, accumulate values in a dictionary, then sort the result for presentation. Extend it by removing commas, ignoring short words, or displaying the top ten words instead of the top five.

## Example 10: Make a tiny command-line-style quiz

The playground is a browser page, but you can still model interaction with a list of questions. Keeping the answers in data makes the quiz easy to extend:

```python
questions = [
    {"question": "What keyword defines a function?", "answer": "def"},
    {"question": "What type stores key-value pairs?", "answer": "dictionary"},
    {"question": "What does 10 % 3 return?", "answer": "1"},
]

score = 0

for item in questions:
    print("Question:", item["question"])
    # Change this value to test different answers.
    response = item["answer"]

    if response.strip().lower() == item["answer"].lower():
        score += 1
        print("Correct!")
    else:
        print("Not quite.")

print(f"Score: {score}/{len(questions)}")
```

This version uses a fixed response so it works in every simple playground. If you extend the page with an input control, the same scoring logic can accept a learner's answer from the browser UI.

## A small challenge: create a personal project tracker

Use the patterns above to build a tracker with at least five projects. Each project should have:

- a name
- a category
- a completed-task count
- a target-task count

Then write a program that:

1. Calculates each project's completion percentage.
2. Prints the projects from most complete to least complete.
3. Labels projects below 50% as `needs attention`.
4. Prints the total number of remaining tasks.

Start with this data:

```python
projects = [
    {"name": "Python basics", "category": "learning", "done": 8, "target": 10},
    {"name": "Portfolio page", "category": "web", "done": 3, "target": 8},
    {"name": "API experiment", "category": "backend", "done": 6, "target": 6},
]
```

Do not worry about finding the shortest solution. The goal is to turn a problem into small, testable steps.

## What Pyodide changes—and what it does not

Pyodide brings CPython and many Python packages into the browser through WebAssembly. That is why these examples feel like Python even though there is no Python process running in your terminal. The official Pyodide quickstart describes the same basic flow: load `pyodide.js`, initialize the runtime, and execute code with `pyodide.runPython()`.

There are still important boundaries:

- Browser Python is excellent for language fundamentals, small experiments, and interactive teaching.
- It is not a replacement for learning filesystems, virtual environments, package management, servers, and deployment.
- A browser page cannot automatically access arbitrary local files or operating-system commands like a normal desktop process.
- Package support depends on what has been built for Pyodide; the standard library is the safest starting point.

The best progression is to use the playground for the first feedback loop, then move into local Python and a small application when you are ready. The broader [learning path](https://github.com/saurabhahuja71/learning-path) continues from this browser lab toward APIs, Flask, FastAPI, data science, containers, and cloud-native projects.

## Next steps

After finishing the examples:

1. Change every input value and predict the output before running the code.
2. Add one feature to the project tracker.
3. Read the small [Python by Example source](https://github.com/saurabhahuja71/python-by-example) and identify where the editor, status message, and run button are wired together.
4. Continue to a local Python installation when you need files, packages, tests, or a web server.
5. Build a small API after the fundamentals feel comfortable; the [FastAPI companion post](/blog/learn-fastapi-with-asynchronous-python/) is a natural next step.

The important habit is simple: write a small program, run it immediately, inspect the result, and change one thing. A browser playground makes that habit available in seconds.

## Frequently asked questions

### Do I need to install Python?

No. The live playground downloads the Python runtime into the browser. You only need a modern browser and an internet connection for the initial load.

### Is this the same as normal Python?

The language fundamentals are the same, but the runtime environment is different. Browser restrictions and package availability matter once you move beyond small exercises.

### Can I use pandas or NumPy?

Some packages are available in Pyodide, but this starter project intentionally stays dependency-free. Learn the core language first, then explore package loading and compatibility when you have a specific data task.

### Can I save my programs?

The playground is a simple editor, so save useful examples by copying them into a local file or forking the repository. The repository is also a good exercise in turning a static page into a richer learning tool.

