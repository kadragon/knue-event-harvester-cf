# KNUE Event Harvester Agent Rules

Node 22 + TypeScript cron CLI: pulls KNUE bulletin RSS → enriches via local Ollama → deduplicates against SQLite → publishes to Google Calendar + Telegram.

## Docs Index (read on demand)

| File | When to read |
|------|--------------|
| `docs/architecture.md` | Before modifying execution flow, modules, or data model |
| `docs/conventions.md` | Before writing new code, naming things, or making commits |
| `docs/workflows.md` | When starting any implementation cycle |
| `docs/delegation.md` | Before delegating to sub-agents — Delegation routing table and context manifests |
| `docs/eval-criteria.md` | When evaluating completed features |
| `docs/runbook.md` | For build, test, run commands and common failures |

## Golden Principles

Violations block commits or fail CI. No exceptions.

1. **Coverage thresholds hold** — `src/lib/**` must meet lines 80 / functions 80 / branches 75. Enforced: `vitest.config.ts` thresholds + CI.
2. **TypeScript strict + ESM `.js` suffix** — strict mode on; relative imports require `.js` extension (NodeNext). Enforced: `tsc --noEmit` in lefthook + CI.
3. **SQLite schema is additive only** — no `DROP COLUMN`, `DROP TABLE`, or `RENAME COLUMN` in `src/lib/state.ts`. Breaking changes wipe `data/state.db`. Enforced: `pre-commit-schema-guard.sh` in lefthook.
4. **Per-item loop errors never abort `run()`** — one bad RSS item must not stop the rest. Enforced: integration test assertion in `test/`.
5. **Commit format `[TYPE] description`** — TYPE ∈ `FEAT FIX REFACTOR DOCS HARNESS CONSTRAINT PLAN TEST CHORE`. Enforced: `commit-msg-format.sh` (advisory for humans, blocking for Claude sessions).

## Delegation (Hard Stop)

Read `docs/delegation.md` for context manifests. All triggers are objective.

| Trigger (objective) | Delegate | Model | Gate |
|---------------------|----------|-------|------|
| First edit in `src/` or `test/` this session | `Explore` subagent | sonnet | Mandatory |
| Change touches `src/lib/state.ts` | `feature-dev:code-explorer` | sonnet | Mandatory |
| Change touches `src/lib/calendar.ts` | `feature-dev:code-explorer` | sonnet | Mandatory |
| Change touches `run.sh` or `.github/workflows/` | `Explore` subagent | sonnet | Mandatory |
| Change touches ≥3 files across `src/` | `Plan` subagent | sonnet | Mandatory before edits |
| Same failure 2× | `codex:rescue` | — | Escalation |
| Post-implementation (always) | `feature-dev:code-reviewer` | sonnet | Mandatory |

## Token Economy

Rules that apply every message — keep the context window lean.

1. Do not re-read a file already read in this session. If you need to check a change, read only the diff/region.
2. Do not call tools just to confirm information you already have. Simple questions deserve direct answers.
3. Run independent tool calls in parallel (multiple reads, grep + glob, etc.) — not sequentially.
4. Delegate any analysis that would produce >20 lines of output to a sub-agent; return only the conclusion to this context.
5. Do not restate what the user just said. They can read their own message.

## Working with Existing Code

- `src/lib/state.ts` schema is additive only — no migration framework. Dropping or renaming columns deletes `data/state.db` for all users.
- Single-instance execution — concurrent `run.sh` invocations create duplicate Calendar events. Cron must use `flock` (see `docs/runbook.md`).
- `src/lib/preview.ts` is not wired into `run()` — do not assume it executes.

## Language Policy

Code, commits, docs: English. User-facing strings (Telegram messages, Calendar event titles): Korean (already true in `src/`).

## Maintenance

Update this file **only** when ALL of the following are true:

1. Information is not directly discoverable from code / config / manifests / docs
2. It is operationally significant — affects build, test, deploy, or runtime safety
3. It would likely cause mistakes if left undocumented
4. It is stable and not task-specific

**Never add:** architecture summaries, directory overviews, style conventions already enforced by tooling, anything already visible in the repo, or temporary / task-specific instructions.

Prefer modifying or removing outdated entries over appending. When unsure, add a short inline `TODO:` comment rather than inventing guidance.

Size budget: target ≤100 lines, hard warn >200. Move long content to `docs/*.md` and leave a pointer line here.
