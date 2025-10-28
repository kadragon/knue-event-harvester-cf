# Telegram Notification Feature

**Intent**: Notify user via Telegram when a new Google Calendar event is created from RSS feed

**Scope**:
- In: Event creation success (from src/index.ts)
- Out: Telegram message with event details
- Does NOT: Block event creation if notification fails (best-effort)

**Dependencies**:
- Telegram Bot API (https://core.telegram.org/bots/api)
- Environment: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_USER_ID`

---

## Behaviour (GWT)

- **AC-1**: GIVEN new event created successfully WHEN `sendNotification()` called THEN Telegram message sent to user with title + RSS link + Calendar link

- **AC-2**: GIVEN `TELEGRAM_BOT_TOKEN` or `TELEGRAM_USER_ID` missing WHEN `sendNotification()` called THEN log warning and return silently (no error thrown)

- **AC-3**: GIVEN Telegram API fails (network error, auth failure) WHEN `sendNotification()` called THEN log error and return silently (does not block caller)

- **AC-4**: GIVEN all inputs valid WHEN `sendNotification()` called THEN message must contain:
  - Event title
  - Source RSS article URL
  - Google Calendar event URL/link
  - Formatted with markdown + emoji

---

## Examples (Message Format)

| Case | Title | RSS Link | Calendar Link | Expected Output |
|------|-------|----------|---|---|
| Success | "KNUE 개교기념일" | "https://knue.ac.kr/rssBbsNtt.do?nttNo=123" | "https://calendar.google.com/calendar/u/0/r/eventedit/{eventId}" | Message with all 3 fields |
| Empty title | "" | "https://knue.ac.kr/rssBbsNtt.do?nttNo=123" | "https://calendar.google.com/calendar/u/0/r/eventedit/{eventId}" | Message with 2 fields (title omitted) |

---

## API (Summary)

### Function Signature

```typescript
export async function sendNotification(
  payload: TelegramNotificationPayload,
  env: Env
): Promise<void>
```

### Input Type

```typescript
interface TelegramNotificationPayload {
  eventTitle: string;
  rssUrl: string;      // Original article URL (e.g., KNUE news)
  eventUrl: string;    // Google Calendar event URL
}
```

### Environment Variables

- `TELEGRAM_BOT_TOKEN`: Bot token from BotFather (format: 123456:ABC-DEF...)
- `TELEGRAM_USER_ID`: User ID to receive messages (numeric)

### Error Contract

- Missing env vars: Log warning, return void
- API failure (network, 4xx, 5xx): Log error, return void
- Invalid payload: Validate and sanitize, proceed

### Rate/Perf

- SLO: <1s per message
- Limits: Telegram API allows ~30 messages/second per bot
- No retry logic (1 attempt only)

---

## Data & State

No persistent state needed. Telegram Bot API handles deduplication server-side.

---

## Tracing

- Spec-ID: `SPEC-TELEGRAM-NOTIFICATION-001`
- Tests: `test/lib/telegram.test.ts` (AC-1 to AC-4)
- Implementation: `src/lib/telegram.ts`
- Integration: `src/index.ts` (after `createEvent()` success)

---

## Integration Point

```typescript
// In src/index.ts, after createEvent() success:
const event = await createEvent(eventInput, env);
await sendNotification({
  eventTitle: eventInput.title,
  rssUrl: item.link,         // Original RSS article URL
  eventUrl: buildCalendarEventUrl(event.id)
}, env);
```

Helper function:
```typescript
function buildCalendarEventUrl(eventId: string): string {
  return `https://calendar.google.com/calendar/u/0/r/eventedit/${eventId}`;
}
```
