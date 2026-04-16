# Workflows

Six named workflows. Start each session by identifying which workflow applies.

## `code` — Implement a feature or fix

**Sprint Contract first.** Before writing a line of code, produce a Sprint Contract (see `docs/eval-criteria.md`) and confirm the acceptance criteria with the user.

1. **Scope check** — if the target module triggers a delegation rule (see `docs/delegation.md`), delegate to Explore or Plan agent before proceeding. This is a hard stop.
2. **RED** — write a failing test that encodes the acceptance criterion.
3. **GREEN** — write the minimum implementation to pass.
4. **REFACTOR** — clean up without changing behaviour; run tests to confirm.
5. **QA** — delegate to `feature-dev:code-reviewer` (mandatory). Pass: list of files modified + the Sprint Contract.
6. **Evaluate** — for changes >30 min in scope, delegate to `feature-dev:code-explorer` for an independent product evaluation against the Sprint Contract's acceptance criteria. For small solo changes (<30 min), self-evaluate with the checklist in `docs/eval-criteria.md`.

Permitted side-effects: write/edit `src/`, `test/`, `docs/`, `backlog.md`. Do not push; do not merge.

## `plan` — Scope and decompose work

1. Read `docs/architecture.md` to understand current module boundaries.
2. Read the relevant source files (delegate to Explore agent if >3 files touched).
3. Write a Sprint Contract to `tasks.md` (create if absent, using schema in `references/tasks-template.md` from harness-init skill).
4. Update `backlog.md` to set the chosen item to `[>]`.

Permitted side-effects: write `tasks.md`, update `backlog.md`.

## `draft` — Write or update documentation

1. Read the relevant source code to ground the doc in current reality.
2. Write to `docs/` or update `AGENTS.md` (apply the 4-rule edit policy in `AGENTS.md § Maintenance`).
3. Verify no dead references: all file paths mentioned in the doc exist.

Permitted side-effects: write `docs/`, edit `AGENTS.md`.

## `constrain` — Add a golden principle or enforcement rule

1. Identify what failed and why the existing harness didn't catch it.
2. Choose the lowest enforcement layer that would have caught it (hook → pre-commit → CI).
3. Add the rule, write a test or hook that enforces it mechanically.
4. Update `AGENTS.md § Golden Principles` if the principle is new.

Permitted side-effects: edit `.claude/hooks/`, `lefthook.yml`, `.github/workflows/`, `AGENTS.md`.

## `sweep` — Garbage collect the harness

Run manually between features: `bash tools/sweep.sh`

The sweep script checks: lint, test coverage thresholds, doc drift (Wrangler/OPENAI_API_KEY references in README), golden principle violations, harness freshness. See `docs/runbook.md § Sweep`.

## `explore` — Understand code before acting

Delegate to an Explore subagent. Pass: directory/file path, question to answer. Do not edit during this workflow.

---

## Context Anxiety

On long tasks, models may start cutting corners as context fills. Counter-measures:

- **Prefer session resets over context compaction.** If you are >70% through context, write a `handoff-{feature}.md` summarising current state, then start a fresh session referencing it. Do this proactively — not when already degraded.
- **Write the handoff at the start of multi-session work**, not when you first feel the pressure.
- Token Economy rules (see `AGENTS.md`) reduce the rate of context fill — apply them from the first message.
