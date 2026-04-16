# Delegation

Delegation is a golden principle. Skipping a mandatory gate is a violation. All triggers are objective and measurable — never subjective.

## Routing Table

| Trigger (objective) | Delegate to | Model | Gate |
|---------------------|------------|-------|------|
| First edit in `src/` or `test/` this session | `Explore` subagent | sonnet | Mandatory, blocking |
| Change touches `src/lib/state.ts` (schema/persistence) | `feature-dev:code-explorer` | sonnet | Mandatory, blocking |
| Change touches `src/lib/calendar.ts` (JWT/OAuth) | `feature-dev:code-explorer` | sonnet | Mandatory, blocking |
| Change touches `run.sh` or `.github/workflows/` | `Explore` subagent | sonnet | Mandatory, blocking |
| Change touches ≥3 files across `src/` | `Plan` subagent | sonnet | Mandatory before edits |
| Post-implementation (always) | `feature-dev:code-reviewer` | sonnet | Mandatory, blocking |
| Same failure 2× | `codex:rescue` | opus | Escalation, blocking |
| Concurrent review desired | `pr-review-toolkit:silent-failure-hunter` | sonnet | Optional |

## Context Manifests

Sub-agents start with zero context. Pass file paths, not inline content.

### Explore subagent (first-edit in src/ or test/)

**Purpose:** Understand module structure before editing.

**Required context:**
- `src/` directory path — the module to explore
- `docs/architecture.md` — module boundaries and responsibilities
- Question: "What does this module do, what are its entry points, and what should I know before editing it?"

**Expected output:** Summary of entry points, key functions, notable invariants. Under 30 lines.

### feature-dev:code-explorer (state.ts or calendar.ts)

**Purpose:** Deep trace of a critical module before any changes.

**Required context for `src/lib/state.ts`:**
- `src/lib/state.ts`
- `test/lib/state.test.ts` (if it exists)
- `docs/architecture.md § Data Model`
- `docs/conventions.md § camelCase ↔ snake_case boundary`

**Required context for `src/lib/calendar.ts`:**
- `src/lib/calendar.ts`
- `docs/architecture.md § External Integrations`
- The Google Calendar v3 REST API endpoint patterns

**Expected output:** Execution path, key invariants, risks of proposed change. Under 40 lines.

### Plan subagent (≥3 files across src/)

**Purpose:** Design the change before any edits.

**Required context:**
- All target file paths
- `docs/architecture.md`
- `docs/conventions.md`
- Proposed feature description

**Expected output:** Implementation plan with specific files, functions, and sequence. Under 60 lines.

### feature-dev:code-reviewer (post-implementation)

**Purpose:** Independent QA pass on every implementation.

**Required context:**
- List of modified files (from `git diff --name-only`)
- `docs/conventions.md`
- `docs/architecture.md`
- The Sprint Contract acceptance criteria

**Expected output:** Pass/fail with specific line-level findings. Structural fixes (typos, missing imports) can be applied directly. Behavioral changes go to `backlog.md`.

### codex:rescue (same failure 2×)

**Purpose:** Root-cause investigation when the orchestrator is stuck.

**Required context:**
- Description of the failure (error message + steps taken)
- Relevant file paths
- What was tried and why it failed

**Expected output:** Root cause diagnosis and a concrete fix.

## Available Sub-Agents

| Agent | Use case |
|-------|---------|
| `Explore` subagent | Fast codebase exploration, file pattern matching |
| `Plan` subagent | Architecture analysis, multi-file change design |
| `feature-dev:code-reviewer` | Code review after implementation |
| `feature-dev:code-explorer` | Deep module analysis |
| `codex:rescue` | Stuck / second-opinion diagnosis |
| `pr-review-toolkit:code-reviewer` | PR-level review |
| `pr-review-toolkit:silent-failure-hunter` | Error handling audit |

## Why Objective Triggers

Agents overestimate their own understanding. A trigger like "if you're unfamiliar with the module" will always be rationalized away. The triggers above are countable (first edit, count of files, specific path matches) — no judgment required.
