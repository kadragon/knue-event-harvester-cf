## Review Backlog

### PR #62 — feat: migrate Cloudflare Workers to Node.js + Ollama + SQLite (2026-04-15)

- [ ] [doc] Document single-instance requirement — concurrent runs can create duplicate calendar events; add to README or runbook (source: Claude) — src/lib/state.ts:65-91
- [ ] [doc] Add external scheduler setup instructions (systemd / cron) to replace removed Cloudflare cron trigger (source: Codex) — src/index.ts
- [ ] [debt] `isMain` detection fails on Windows and symlinked entries — use `fileURLToPath(import.meta.url)` compared to `realpathSync(process.argv[1])` (source: Claude) — src/index.ts:496-498
