# Evaluation Criteria

## Generator-Evaluator Separation

The agent that implements a feature must not be the agent that declares it done. Before implementation begins, define "done" precisely enough that a different evaluator can grade it without asking the implementer.

## Sprint Contract

Produce a Sprint Contract before writing code. Store it in `tasks.md` when a sprint is active.

```
## Sprint Contract: {Feature name}

**Scope:** {What is included}

**Non-Goals:** {What is explicitly excluded}

**Acceptance Criteria:**
- AC-1: {Specific, observable outcome}
- AC-2: {Specific, observable outcome}
- ...

**Evaluator:** {Who or what grades the sprint — e.g., "feature-dev:code-reviewer + manual spot-check"}

**Done when:** All ACs pass + evaluator signs off.
```

### Example — Adding a new RSS feed

```
## Sprint Contract: Add KNUE library events RSS feed

**Scope:** Parse and harvest events from the KNUE library RSS endpoint.

**Non-Goals:** Changes to the Google Calendar dedup logic; changes to Telegram format.

**Acceptance Criteria:**
- AC-1: Existing KNUE bulletin feed deduplications still pass (`npm test`).
- AC-2: New feed's nttNo format is documented in docs/architecture.md.
- AC-3: At least one library event appears in the local Calendar on a dev run.
- AC-4: Coverage thresholds (80/80/75) still pass after new tests.

**Evaluator:** feature-dev:code-reviewer (automated) + manual dev-mode run.

**Done when:** AC-1 through AC-4 pass + code-reviewer returns no blocking findings.
```

## Evaluator Execution Protocol

1. Read the Sprint Contract — grade each AC independently (pass/fail/partial).
2. Run `npm test` — coverage thresholds are a hard pass/fail.
3. Spot-check one golden-path run in dev mode (if scope touches `run()`).
4. Report findings as: **[PASS]**, **[FAIL: reason]**, or **[PARTIAL: what's missing]** per AC.
5. Structural fixes (missing import, typo) may be applied directly. Behavioral gaps go to `backlog.md` as new items.

## Self-Deception Countermeasures

- Do not evaluate your own implementation. Delegate to a sub-agent.
- If all ACs pass trivially, the ACs are too weak — revise them.
- "Tests pass" is necessary but not sufficient. ACs must include at least one observable runtime outcome.
- If you're tempted to mark an AC as "partial but close enough," treat it as FAIL and add the gap to backlog.
