# Telegram Notification Improvements

**Intent**: Improve Telegram notification format by disabling link preview, fixing calendar URL, and simplifying link text

**Scope**:
- In: Telegram message formatting, Google Calendar URL generation
- Out: RSS parsing, AI processing, calendar event creation logic

**Dependencies**:
- src/lib/telegram.ts
- src/index.ts (buildCalendarEventUrl)

## Behaviour (GWT)

- **AC-1**: GIVEN a Telegram notification is sent WHEN the message contains URLs THEN link preview should be disabled
- **AC-2**: GIVEN a Google Calendar event is created WHEN building the event URL THEN use htmlLink from API response, OR fallback to properly encoded eid format (`/calendar/u/0/r/event?eid={base64url(eventId + " " + calendarId)}`)
- **AC-3**: GIVEN a notification message is formatted WHEN adding links THEN display link text as `[바로가기]` instead of showing URL or domain

## Examples (Tabular)

| Case | Current Behavior | Expected Behavior |
|---|---|---|
| Link Preview | Shows link preview in Telegram | No link preview |
| Calendar URL | `eventedit/{id}` (broken) | Use `htmlLink` from API OR `event?eid={base64(id + " " + calendarId)}` |
| Link Text (RSS) | `[www.knue.ac.kr](url)` | `[바로가기](url)` |
| Link Text (Calendar) | `[Google Calendar](url)` | `[바로가기](url)` |

## API (Summary)

**Modified Functions**:
- `sendNotification()`: Add `disable_web_page_preview: true` to Telegram API call
- `formatMessage()`: Replace link text extraction with static `[바로가기]`, remove unused `extractDomain()` helper
- `buildCalendarEventUrl()`: Properly encode eid as Base64URL(`eventId + " " + calendarId`)
- `GoogleCalendarEvent`: Add `htmlLink?: string` field to type definition
- `processNewItem()`: Prefer `htmlLink` from API, fallback to `buildCalendarEventUrl()`

**No Breaking Changes**: Internal implementation only

## Data & State

No data model changes. No migrations required.

## Tracing

**Spec-ID**: SPEC-TELEGRAM-IMPROVEMENTS-001
**Trace-To**:
- src/lib/telegram.ts (sendNotification, formatMessage)
- src/lib/calendar.ts (GoogleCalendarEvent type)
- src/index.ts (buildCalendarEventUrl, processNewItem)
- test/lib/telegram.test.ts
- test/lib/calendar.test.ts
