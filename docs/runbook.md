# Runbook

## Commands

```bash
# Development
npm run build          # tsc compile to dist/
npm start              # node dist/index.js
npm run lint           # tsc --noEmit (type-check only, no output)
npm test               # vitest run
npm run test:coverage  # vitest run --coverage (checks 80/80/75 thresholds on src/lib/**)
```

## Running Locally

```bash
cp .env.example .env
# Fill in .env values (see Environment Variables below)
npm install
npm run build
node dist/index.js
```

Logs to stdout by default. Run via `run.sh` to get file-based logging.

## Cron Setup (Production)

`run.sh` handles: `git pull --ff-only`, conditional rebuild (keyed on `package-lock.json` md5 stored in `.lock-hash`), then `node dist/index.js`. Logs go to `logs/harvester-YYYY-MM-DD.log`.

**Single-instance requirement:** concurrent invocations create duplicate Calendar events. Use `flock`:

```cron
# Run every 15 minutes, max one instance
*/15 * * * * flock -n /tmp/knue-harvester.lock bash /home/user/knue-event-harvester/run.sh
```

## Seeding state.db for Integration Tests

The database schema is auto-initialised on first run. To create an empty database manually, run the app once with `DRY_RUN=1` if that flag is supported, or just run `node dist/index.js` — it will create `data/state.db` with the correct schema and exit after the first cycle.

Alternatively, import and call `initDatabase()` from `src/lib/state.ts` directly in a test setup fixture.

## Sweep

Sweep script: `bash tools/sweep.sh`

**Trigger:** SessionStart hook fires automatically if `tools/.sweep-stamp` is older than 7 days. Also runnable manually at any time.

The sweep checks:
1. Lint (`tsc --noEmit`) — must pass
2. Test coverage — must meet 80/80/75 thresholds
3. Doc drift — README must not contain `Wrangler`, `OPENAI_API_KEY`, or `KV` (stale Cloudflare text)
4. Golden-principle violations — no `DROP COLUMN`/`DROP TABLE`/`RENAME COLUMN` in `src/lib/state.ts`; no secret keys logged to console
5. Harness freshness — AGENTS.md line count, `.agents/skills` symlink target

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OLLAMA_HOST` | No | `http://127.0.0.1:11434` | Ollama server URL |
| `OLLAMA_CONTENT_MODEL` | Yes | — | Model for content summarisation (e.g. `llama3.1:8b`) |
| `OLLAMA_VISION_MODEL` | No | — | Vision model for OCR; leave empty to skip OCR |
| `DATABASE_PATH` | No | `./data/state.db` | SQLite state database path |
| `SIMILARITY_THRESHOLD` | No | `0.85` | Cosine similarity threshold for dedup |
| `LOOKBACK_DAYS` | No | `30` | How far back to check for duplicate Calendar events |
| `GOOGLE_CALENDAR_ID` | Yes | — | Target Google Calendar ID |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Yes | — | Full service account JSON (single line, escaped) |
| `TELEGRAM_BOT_TOKEN` | No | — | Telegram bot token; skip Telegram if absent |
| `TELEGRAM_USER_ID` | No | — | Telegram user/chat ID for notifications |

## Common Failure Modes

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `Error: connect ECONNREFUSED 127.0.0.1:11434` | Ollama not running | `ollama serve` |
| `JWT sign failed` or `401 Unauthorized` on Calendar | Service account JSON malformed or missing calendar permissions | Re-export JSON (ensure `private_key` is unescaped), share calendar with service account email |
| Telegram: `400 Bad Request` | Invalid `TELEGRAM_USER_ID` format | Use numeric user ID, not username |
| Telegram: `429 Too Many Requests` | Rate limited | Notifications are fail-open — logged but not retried |
| `SQLITE_CANTOPEN` | `data/` directory does not exist | `mkdir -p data` |
| Duplicate Calendar events | Concurrent `run.sh` invocations | Add `flock` to cron (see above) |
| Coverage below threshold | New code in `src/lib/**` without tests | Write tests; `npm run test:coverage` shows uncovered lines |
