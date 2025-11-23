---
id: TASK-2025-11-23-CI-WORKFLOW-RESEARCH
version: 1.0.0
scope: folder:.tasks/2025-11-23-ci-workflow
status: completed
spec: SPEC-CI-WORKFLOW-001
last-updated: 2025-11-23
owner: codex
---

# Research

- Need CI to catch dependency drift and type errors that previously surfaced at install time.
- Current workflow runs on PR only; maintain that trigger per request.
- Runtime should match project expectation (Node 22.x).
- Add explicit typecheck script to support CI step.
