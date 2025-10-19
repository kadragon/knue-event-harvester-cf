---
id: TASK-2025-10-19-KNUE-PLAN
version: 1.0.0
scope: folder:.tasks/2025-10-19-knue-calendar
status: active
supersedes: []
depends: [TASK-2025-10-19-KNUE-RESEARCH,TASK-2025-10-19-KNUE-SPEC]
last-updated: 2025-10-19
owner: codex
---

## Approach
1. **Infra Setup**
   - Initialize Cloudflare Worker project (`wrangler.toml`, TypeScript entrypoint).
   - Configure scheduled trigger (`crons = ["0 */4 * * *"]`).
   - Define bindings: KV (state), D1 (optional), Secrets (GCal credentials, OpenAI API key).
2. **RSS Processing Pipeline**
   - Fetch RSS feed, parse XML, normalize items with consistent ID (`nttNo`).
   - Compare against KV stored processed IDs; for new items enqueue processing.
3. **Content Enrichment**
   - Retrieve `preview1` via custom worker if present; detect content type.
   - For images, run OCR (Tesseract WASM or external API). For text/HTML, extract plain text.
   - Compose AI prompt with title, description, preview text; call OpenAI Chat Completions (configurable model) to get structured summary (JSON schema).
4. **Calendar Sync**
   - Build event object (all-day). Compute dedupe signature via vector similarity (OpenAI embeddings) or string similarity fallback.
   - List recent Google Calendar events (e.g., last 60 days). If similarity above threshold, skip.
   - Insert event when unique; include attachments info and AI summary.
5. **Persistence & Logging**
   - Save processed ID + metadata + dedupe hash in KV.
   - Log errors with structured console logs.
6. **Testing & Docs**
   - Implement unit tests for RSS parsing, preview parser, dedupe scoring.
   - Document environment setup, secrets, deployment steps in `README.md`.

## Rollback / Contingency
- Disable cron trigger via Wrangler if errors escalate.
- Remove processed ID entry for manual re-run.
