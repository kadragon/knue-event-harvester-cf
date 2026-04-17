# Conventions

Only conventions agents frequently get wrong are listed here. The linter catches the rest.

## Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| Source files | lowercase single-word (or hyphenated) | `state.ts`, `rss.ts` |
| Functions / variables | camelCase | `fetchRssFeed`, `nttNo` |
| Classes / types / interfaces | PascalCase, no `I` prefix | `CalendarEvent`, `RssItem` |
| Environment variable names | SCREAMING_SNAKE_CASE | `OLLAMA_HOST`, `DATABASE_PATH` |
| SQLite column names | snake_case | `ntt_no`, `processed_at` |
| camelCase ↔ snake_case boundary | At `src/lib/state.ts` — DB layer uses snake_case; all callers use camelCase | `ntt_no` in SQL → `nttNo` in TS |

## Imports

ESM with NodeNext module resolution — **relative imports must use `.js` extension**:

```ts
// CORRECT
import { fetchRssFeed } from './lib/rss.js';

// WRONG — fails at runtime under NodeNext
import { fetchRssFeed } from './lib/rss';
```

## Environment Variable Pattern

Each module that reads env vars has a `*Env` object parsed at module load or at `run()` entry. Do not scatter `process.env.*` calls deep in business logic — keep them at the `*Env` boundary in `src/index.ts` or the relevant module's env block.

## Trace Comments

Spec-driven work uses `Trace: SPEC-*` and `Trace: AC-*` comments to link implementation to acceptance criteria. Not required for ad-hoc fixes, but required when a Sprint Contract specifies acceptance criteria.

```ts
// Trace: AC-3 — per-item errors must not abort the loop
try {
  await processItem(item);
} catch (err) {
  logger.error({ err, nttNo: item.nttNo }, 'item processing failed');
}
```

## Commit Format

```
[TYPE] Short description (imperative, ≤72 chars)
```

Approved types: `FEAT` `FIX` `REFACTOR` `DOCS` `HARNESS` `CONSTRAINT` `PLAN` `TEST` `CHORE`

Automated exceptions (not blocked by commit-msg hook): Dependabot `build(deps):`, GitHub merge commits, `Revert "..."`.

## User-Facing Strings

Telegram notification text and Google Calendar event titles are in Korean. Do not change them to English — this is intentional, not a bug.

## TDD Discipline

RED → GREEN → REFACTOR. Write the failing test first. The test documents the acceptance criterion; the implementation satisfies it.
