# Backlog

## Now

- [ ] Fix `isMain` detection for Windows/symlinked entries — use `fileURLToPath(import.meta.url)` compared to `realpathSync(process.argv[1])` — src/index.ts:496-498

## Next

## Review Debt

Items from PR #62 and #63 code review that were not resolved at merge time.

### PR #62 — migrate Cloudflare Workers to Node.js + Ollama + SQLite (2026-04-15)

- [ ] [doc] Add external scheduler setup instructions (systemd / cron) to replace removed Cloudflare cron trigger — src/index.ts

### PR #63 — RSS U+FFFD fix, emoji title prefix, auto-update in run.sh (2026-04-15)

- [ ] [debt] `DOMParser` (browser) path in `parseXmlDocument` skips `onError` suppression — U+FFFD warnings surface in non-Node runtimes; consider dropping the browser branch or documenting the limitation — src/lib/rss.ts:10-12
- [ ] [debt] U+FFFD stripping in `textContent()` also applies to `<link>` field — consider restricting to title/description if raw link preservation matters — src/lib/rss.ts:6

## Someday

- [ ] Wire `src/lib/preview.ts` into `run()` or delete it — currently built but unused
- [ ] Add integration test assertion that explicitly verifies per-item errors do not abort `run()` (covers Golden Principle 4)
