---
name: feedback-venv
description: Always use local .venv for Python dependencies, never install in global environment
metadata:
  type: feedback
---

Never install Python packages globally. Always use the project's local `.venv`:
1. Create with `python3 -m venv .venv` if it doesn't exist
2. Install into it with `.venv/bin/pip install <package>`
3. Run scripts with `.venv/bin/python <script>`

**Why:** User does not want global Python environment polluted with project-specific deps.
**How to apply:** Any time a Python script or tool (playwright, etc.) needs a package, use the local venv.
