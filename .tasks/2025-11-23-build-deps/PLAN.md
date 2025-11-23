---
id: TASK-2025-11-23-BUILD-DEPS-PLAN
version: 1.0.0
scope: folder:.tasks/2025-11-23-build-deps
status: completed
depends: [TASK-2025-11-23-BUILD-DEPS-RESEARCH]
spec: SPEC-BUILD-DEPS-001
last-updated: 2025-11-23
owner: codex
---

# Plan — Align Vitest Dependencies

1. Update `package.json` to use `@vitest/coverage-v8` v3.x matching `vitest@3.2.4`.
2. Regenerate `package-lock.json` with `npm install` to reflect the version change.
3. Run `npm test` (or `npm run test:coverage`) to confirm tooling still passes.
4. Record progress in `PROGRESS.md` and update `.governance/memory.md` with learnings.
