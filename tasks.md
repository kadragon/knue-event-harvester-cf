# Tasks

## Review backlog — PR #64 (out-of-scope polish)

Deferred from dev-review-cycle on 2026-04-17. Cross-feed ingestion is shipping; these are quality-of-life improvements for the multi-feed path.

- [ ] **Self-heal legacy rows on read** — `src/lib/state.ts:getProcessedRecord`. When the legacy fallback hits a pre-namespace row, rewrite it under `makeKey(LEGACY_FEED_ID, nttNo)` so the fallback branch can eventually be removed without a migration framework.
- [ ] **Single source for `LEGACY_FEED_ID`** — `src/lib/state.ts:10` duplicates the string defined in `FEEDS[0].id` (`src/index.ts:41`). Pick one source (e.g. reference `FEEDS[0].id` from state, or import `LEGACY_FEED_ID` when declaring `FEEDS`) so a rename of the legacy feed cannot silently break the state fallback.
- [ ] **Make `ProcessedRecord.feedId` required** — `src/types.ts:53`. All production call sites now set it; tightening the type catches future omissions at compile time. Touches `test/lib/calendar.test.ts` and `test/lib/state.test.ts` fixtures.
- [ ] **Replace positional assertions in integration test** — `test/index.integration.test.ts:206-209`. Swap `lastCall[1] === 'bbs250'` for `expect(putProcessedRecord).toHaveBeenCalledWith(expect.anything(), 'bbs250', '777', expect.objectContaining({ feedId: 'bbs250' }))`.
- [ ] **Harness: Gemini review script fails on macOS** — `kadragon-tools:dev-review-cycle/scripts/gemini-review.sh` uses GNU `timeout`, which is absent by default on macOS. Not a repo issue, but skipped Gemini's review on this cycle. Either install `coreutils` locally or patch the script upstream (`gtimeout`/`perl -e alarm`).
