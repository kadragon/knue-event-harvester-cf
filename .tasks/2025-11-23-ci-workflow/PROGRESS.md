---
id: TASK-2025-11-23-CI-WORKFLOW-PROGRESS
version: 1.0.0
scope: folder:.tasks/2025-11-23-ci-workflow
status: completed
spec: SPEC-CI-WORKFLOW-001
depends: [TASK-2025-11-23-CI-WORKFLOW-PLAN]
last-updated: 2025-11-23
owner: codex
---

# Progress

## 2025-11-23
- Added `typecheck` npm script (tsc --noEmit).
- Updated CI workflow to Node 22 and run lint/test on PRs with actions v6 (typecheck covered by lint).
