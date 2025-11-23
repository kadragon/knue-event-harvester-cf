---
id: TASK-2025-11-23-CI-WORKFLOW-PLAN
version: 1.0.0
scope: folder:.tasks/2025-11-23-ci-workflow
status: completed
spec: SPEC-CI-WORKFLOW-001
depends: [TASK-2025-11-23-CI-WORKFLOW-RESEARCH]
last-updated: 2025-11-23
owner: codex
---

# Plan

1. Add `typecheck` npm script (tsc --noEmit) for local use.
2. Update CI workflow to use Node 22 and run lint/test on PRs (lint already typechecks) using existing v6 action versions.
3. Verify workflow syntax; no change to triggers (PR to main only).
4. Record progress in PROGRESS.md.
