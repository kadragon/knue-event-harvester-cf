# index.ts Unit Tests
Intent: Improve test coverage for core business logic functions
Scope: normalizeDate, isWithinLastWeek, buildDescription, processNewItem

## Behaviour (GWT)

### normalizeDate
- AC-1: GIVEN a pubDate in ISO format (YYYY-MM-DD) WHEN normalizeDate is called THEN return same date
- AC-2: GIVEN a pubDate in non-standard format WHEN normalizeDate is called THEN parse and return ISO date
- AC-3: GIVEN empty pubDate WHEN normalizeDate is called THEN return today's date
- AC-4: GIVEN invalid date string WHEN normalizeDate is called THEN return today's date

### isWithinLastWeek
- AC-5: GIVEN pubDate within last 7 days WHEN isWithinLastWeek is called THEN return true
- AC-6: GIVEN pubDate older than 7 days WHEN isWithinLastWeek is called THEN return false
- AC-7: GIVEN pubDate in future (< 30 days) WHEN isWithinLastWeek is called THEN return true
- AC-8: GIVEN pubDate > 30 days in future WHEN isWithinLastWeek is called THEN return false
- AC-9: GIVEN empty pubDate WHEN isWithinLastWeek is called THEN return true (fail-open)
- AC-10: GIVEN invalid date WHEN isWithinLastWeek is called THEN return true (fail-open)

### buildDescription
- AC-11: GIVEN item with summary only WHEN buildDescription is called THEN return summary
- AC-12: GIVEN item with highlights WHEN buildDescription is called THEN include 주요 포인트 section
- AC-13: GIVEN item with actionItems WHEN buildDescription is called THEN include 확인/신청 사항 section
- AC-14: GIVEN item with links WHEN buildDescription is called THEN include 관련 링크 section
- AC-15: GIVEN duplicate links (item.link + summary.links) WHEN buildDescription is called THEN deduplicate

### processNewItem
- AC-16: GIVEN new item WHEN processNewItem is called THEN create event and save state
- AC-17: GIVEN duplicate item WHEN processNewItem is called THEN skip and mark as processed
- AC-18: GIVEN item with no meaningful events WHEN processNewItem is called THEN mark as processed without creating
- AC-19: GIVEN item with multiple event dates WHEN processNewItem is called THEN create multiple events

## API (Summary)
Functions are private but tested via index.integration.test.ts or separate test file:
- normalizeDate(pubDate: string): string
- isWithinLastWeek(pubDate: string): boolean
- buildDescription(item: RssItem, summary: AiSummary): string
- processNewItem(env, item, accessToken, existingEvents, similarityThreshold): Promise<GoogleCalendarEvent[]>

## Data & State
- Uses RssItem, AiSummary, GoogleCalendarEvent types
- Modifies env state via putProcessedRecord, updateMaxProcessedId
- Reads state via getProcessedRecord, getMaxProcessedId
