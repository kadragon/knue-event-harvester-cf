# KNUE Event Harvester

Cloudflare Worker that polls the KNUE announcements RSS feed, enriches items with AI analysis/OCR, and syncs them into Google Calendar while preventing duplicates.

## Features

- Scheduled execution (every 4 hours) via Cloudflare Cron triggers.
- RSS parsing for the KNUE bulletin (`bbsNo=28`) with attachment metadata.
- Preview handling via custom parser endpoint, including OCR for image previews through OpenAI vision models.
- AI-driven summarisation and highlight extraction for calendar descriptions.
- Google Calendar integration using a service-account and deduplication logic based on similarity scoring.
- KV persistence of processed post IDs & calendar metadata.

## Project Structure

```
.agents/               # Policy loader & workflows
.spec/                 # Canonical spec
.tasks/                # Task-specific research/spec/plan/progress
src/
  index.ts             # Worker entry point
  lib/                 # RSS, AI, calendar, preview, dedupe utilities
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Authenticate Wrangler (if not already):
   ```bash
   npx wrangler login
   ```
3. Bind required resources:
   - Create a KV namespace and update `wrangler.toml` (`PROCESSED_STORE`).
   - Ensure Cron trigger (`0 */4 * * *`) is enabled after the first deploy.

## Required Secrets

Set the following secrets via Wrangler:

- `OPENAI_API_KEY` – API key with access to the selected models.
- `GOOGLE_SERVICE_ACCOUNT_JSON` – JSON of a service account with Calendar API enabled.
- `GOOGLE_CALENDAR_ID` – Target calendar (e.g., `example@group.calendar.google.com`).

```
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
npx wrangler secret put GOOGLE_CALENDAR_ID
```

Optional environment variables (already defaulted in `wrangler.toml`):

- `PREVIEW_PARSER_BASE` – Base URL to fetch preview content.
- `OPENAI_CONTENT_MODEL` / `OPENAI_VISION_MODEL`
- `SIMILARITY_THRESHOLD`
- `LOOKBACK_DAYS`

## Running Locally

Simulate scheduled runs:

```bash
npm run dev
```

Wrangler will expose `http://localhost:8787/health` for manual trigger, using configured bindings/secrets.

## Testing

```bash
npm test
```

The current suite covers RSS parsing and duplicate detection helpers. Extend with integration tests for calendar/AI mocks as needed.

## Deployment

```bash
npm run deploy
```

After deployment, confirm that the Cron trigger is active:

```bash
npx wrangler tail
```

## Maintenance Notes

- KV keys store processed `nttNo` values; delete a key to force reprocessing.
- Logs in Workers dashboard help audit AI/Calendar failures; consider integrating Sentry via HTTP if needed.
- Adjust AI prompts or similarity thresholds in `wrangler.toml` to tune event descriptions.
