---
id: TASK-2025-11-23-BUILD-DEPS-RESEARCH
version: 1.0.0
scope: folder:.tasks/2025-11-23-build-deps
status: completed
depends: [SPEC-BUILD-DEPS-001]
last-updated: 2025-11-23
owner: codex
---

# Research — Vitest Dependency Conflict

## Observations
- Build log shows `npm ERR! ERESOLVE` while installing `@vitest/coverage-v8@4.0.10`.
- Installed dev dependency `vitest@3.2.4` conflicts with coverage plugin peer requirement `vitest@4.0.10`.
- Command used in CI: `npm clean-install --progress=false` (strict peer resolution).

## Options
1. Upgrade `vitest` to `^4.0.10` (requires verifying breaking changes).
2. Downgrade `@vitest/coverage-v8` to a v3 release matching current Vitest.

## Decision
- Prefer **Option 2** (downgrade coverage plugin) to minimize code/test changes while restoring build stability.
