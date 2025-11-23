---
id: SPEC-CI-WORKFLOW-001
version: 1.0.0
scope: ci
status: active
depends: []
last-updated: 2025-11-23
owner: codex
---

# CI Workflow Stability

## Intent
Prevent peer dependency and type errors by enforcing consistent Node version and mandatory lint/test/typecheck gates on pull requests.

## Behaviour (GWT)
- GIVEN a pull request is opened to `main` WHEN the workflow runs THEN it installs deps with the pinned Node version and fails if lint/test fail (lint already performs type checks via `tsc --noEmit`).
- GIVEN the project uses Node 22 locally WHEN CI runs THEN it uses Node 22 to avoid version drift.

## Acceptance Tests
1. GitHub Actions workflow `CI` installs dependencies and runs `npm run lint` and `npm run test` on PRs to `main` (lint covers type checking).
2. Workflow uses Node `22.x` and fails fast on script errors.

## Linked Tasks
- TASK-2025-11-23-CI-WORKFLOW
