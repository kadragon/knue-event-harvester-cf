# KNUE Event Harvester

Node 22 + TypeScript cron CLI that polls the KNUE announcements RSS feed, enriches items with a local Ollama LLM (optional OCR via vision model), deduplicates against a local SQLite database, and syncs events into Google Calendar while sending Telegram notifications.

## Features

- Cron-triggered via `run.sh` — no persistent server required.
- RSS parsing for the KNUE bulletin (`bbsNo=28`) with U+FFFD sanitisation.
- OCR for image attachments via a local Ollama vision model (optional).
- AI-driven summarisation and event extraction via local Ollama.
- Google Calendar v3 integration using a service account with JWT auth.
- Deduplication via cosine similarity scoring against recent calendar events.
- SQLite persistence of processed post IDs and calendar metadata.
- Telegram Bot notifications for new events.

## Requirements

- **Node 22** (LTS)
- **Ollama** running locally (`ollama serve`) with at least one content model pulled
- **Google Cloud service account** with Google Calendar API enabled, and the service account shared with the target calendar
- **Telegram bot** (optional — skip `TELEGRAM_BOT_TOKEN` to disable notifications)
- **SQLite** — provided by `better-sqlite3` (no separate install)

## Quick Start

```bash
git clone <repo>
cd knue-event-harvester
npm install
npm run build
cp .env.example .env
# Edit .env with your values (see Environment Variables below)
node dist/index.js
```

The first run creates `data/state.db` automatically.

## Environment Variables

Copy `.env.example` to `.env` and fill in your values.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OLLAMA_HOST` | No | `http://127.0.0.1:11434` | Ollama server URL |
| `OLLAMA_CONTENT_MODEL` | **Yes** | — | Model for summarisation (e.g. `llama3.1:8b`) |
| `OLLAMA_VISION_MODEL` | No | — | Vision model for OCR; omit to skip OCR |
| `DATABASE_PATH` | No | `./data/state.db` | SQLite state file path |
| `SIMILARITY_THRESHOLD` | No | `0.85` | Cosine similarity for dedup (0–1) |
| `LOOKBACK_DAYS` | No | `30` | Days to look back for duplicate Calendar events |
| `GOOGLE_CALENDAR_ID` | **Yes** | — | Target Google Calendar ID |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | **Yes** | — | Full service account JSON (single-line, escaped) |
| `TELEGRAM_BOT_TOKEN` | No | — | Telegram bot token; omit to disable |
| `TELEGRAM_USER_ID` | No | — | Telegram user/chat ID for notifications |

## Operation (Cron)

`run.sh` handles auto-updating (git pull, conditional rebuild) before each run. Logs go to `logs/harvester-YYYY-MM-DD.log`.

**Important:** concurrent invocations create duplicate Calendar events. Use `flock`:

```cron
# Run every 15 minutes, max one instance at a time
*/15 * * * * flock -n /tmp/knue-harvester.lock bash /path/to/run.sh
```

## Development

```bash
npm run build          # compile TypeScript
npm run lint           # tsc --noEmit type check
npm test               # run tests
npm run test:coverage  # run tests with coverage report (thresholds: lines 80, functions 80, branches 75)
```

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for the full data flow, module responsibilities, data model, and external integration details.
