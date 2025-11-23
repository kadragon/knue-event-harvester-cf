---
id: SPEC-BUILD-DEPS-001
version: 1.0.0
scope: build
status: active
depends: []
last-updated: 2025-11-23
owner: codex
---

# Build Dependency Alignment

## Intent
Ensure npm installation succeeds in CI (Wrangler/Netlify) by keeping Vitest core and coverage plugin on compatible major versions, avoiding peer dependency conflicts.

## Context
- Current error: `@vitest/coverage-v8@4.0.10` requires `vitest@4.0.10` but project uses `vitest@3.2.4`, causing `npm ERR! ERESOLVE` during `npm clean-install`.
- Node runtime: 22.x; build runs in Cloudflare Wrangler pipeline.

## Behaviour (GWT)
- **GIVEN** npm install runs in CI **WHEN** dependencies are resolved **THEN** no peer-dependency conflicts are reported.
- **GIVEN** coverage scripts run (`npm run test:coverage`) **WHEN** Vitest executes **THEN** coverage reports generate without version errors.

## Acceptance Tests
1. `npm ci` (or `npm install`) completes without `ERESOLVE` errors.
2. `npm run test:coverage` succeeds locally and in CI using the aligned versions.

## Linked Tasks
- TASK-2025-11-23-BUILD-DEPS
