---
updated: 2025-11-23
owner: codex
---

# Working Memory

## Repository Snapshot
- Project: Cloudflare Worker that ingests KNUE RSS feed, enriches via AI, and syncs to Google Calendar.
- Test tooling: Vitest (unit/integration) with V8 coverage via `vitest.config.ts`.
- Build/deploy: Wrangler; scripts `npm run dev|test|test:coverage|deploy`.

## Session Notes (2025-11-23)
- Observed build failure on npm install: peer conflict between `vitest@3.2.4` and `@vitest/coverage-v8@4.0.10`.
- Decided to align coverage plugin to Vitest v3 to remove ERESOLVE without upgrading test runner.
- Added new spec `SPEC-BUILD-DEPS-001` and task `TASK-2025-11-23-BUILD-DEPS` to track the fix.
- Added CI workflow spec/task (`SPEC-CI-WORKFLOW-001`) to enforce lint/test (lint already typechecks) on PRs with Node 22.

## Next Session Hints
- Keep Vitest-related packages on matching major versions to avoid peer conflicts in CI.
- If upgrading to Vitest v4 later, bump both `vitest` and `@vitest/coverage-v8` together and rerun tests.
