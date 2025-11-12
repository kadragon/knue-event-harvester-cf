import { generateEventInfos, generateSummary, type AiEnv } from "./lib/ai";
import type {
  ScheduledController,
  ExecutionContext,
} from "@cloudflare/workers-types";
import {
  obtainAccessToken,
  listEvents,
  createEvent,
  type CalendarEnv,
  type GoogleCalendarEvent,
} from "./lib/calendar";
import { isDuplicate, computeHash } from "./lib/dedupe";
import { sendNotification } from "./lib/telegram";

import { parseRss } from "./lib/rss";
import {
  getProcessedRecord,
  putProcessedRecord,
  getMaxProcessedId,
  updateMaxProcessedId,
  type StateEnv,
} from "./lib/state";
import type {
  CalendarEventInput,
  ProcessedRecord,
  RssItem,
  AiSummary,
} from "./types";
import { deduplicateLinks, buildAttachmentFromFile } from "./lib/utils";

interface Env extends StateEnv, CalendarEnv, AiEnv {
  OPENAI_API_KEY: string;
  OPENAI_CONTENT_MODEL: string;
  OPENAI_VISION_MODEL?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_AI_GATEWAY_NAME?: string;
  CLOUDFLARE_AI_GATEWAY_AUTH?: string;
  SIMILARITY_THRESHOLD?: string;
  LOOKBACK_DAYS?: string;
  GOOGLE_CALENDAR_ID: string;
  GOOGLE_SERVICE_ACCOUNT_JSON: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_USER_ID?: string;
}

const RSS_URL = "https://www.knue.ac.kr/rssBbsNtt.do?bbsNo=28";

/**
 * Build Google Calendar event URL with proper eid encoding
 * Format: https://calendar.google.com/calendar/u/0/r/event?eid={base64url(eventId + " " + calendarId)}
 * Trace: SPEC-TELEGRAM-IMPROVEMENTS-001, AC-2
 */
function buildCalendarEventUrl(eventId: string, calendarId: string): string {
  // eid format: Base64URL(eventId + " " + calendarId)
  const eidRaw = `${eventId} ${calendarId}`;
  const eidEncoded = btoa(eidRaw)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `https://calendar.google.com/calendar/u/0/r/event?eid=${eidEncoded}`;
}

async function fetchRssFeed(): Promise<string> {
  const response = await fetch(RSS_URL, {
    headers: {
      "User-Agent": "knue-event-harvester/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status}`);
  }
  return response.text();
}

export function normalizeDate(pubDate: string): string {
  if (!pubDate) {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(pubDate)) return pubDate;
  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

/**
 * Check if pubDate is within the last 7 days from today
 * Returns true if the item should be processed, false if it's too old
 */
export function isWithinLastWeek(pubDate: string): boolean {
  if (!pubDate) return true; // Process if no pubDate available

  try {
    const normalizedDate = normalizeDate(pubDate);
    const itemDate = new Date(normalizedDate);
    const today = new Date();

    // Set time to midnight for accurate day comparison
    itemDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    // Calculate days difference
    const diffTime = today.getTime() - itemDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    // Include items from last 7 days and future items
    return diffDays <= 7 && diffDays >= -30; // Allow up to 30 days in future for upcoming events
  } catch (error) {
    console.warn("Failed to parse pubDate for filtering:", pubDate, error);
    return true; // Process if parsing fails (fail-open)
  }
}

export function buildDescription(
  item: RssItem,
  summary: AiSummary
): string {
  const parts: string[] = [];
  parts.push(summary.summary);
  if (summary.highlights.length > 0) {
    parts.push(
      "주요 포인트:\n" +
        summary.highlights.map((line) => `- ${line}`).join("\n")
    );
  }
  if (summary.actionItems.length > 0) {
    parts.push(
      "확인/신청 사항:\n" +
        summary.actionItems.map((line) => `- ${line}`).join("\n")
    );
  }
  if (summary.links.length > 0 || item.link) {
    // AC-1: 링크 중복 제거 (원문 링크를 우선순위로)
    const uniqueLinks = deduplicateLinks(item.link, summary.links);
    parts.push(
      "관련 링크:\n" + uniqueLinks.map((link) => `- ${link}`).join("\n")
    );
  }
  return parts.join("\n\n");
}

/**
 * Calculate the number of days between two dates (inclusive)
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Number of days (inclusive)
 */
export function calculateDaysDuration(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays + 1; // +1 to make it inclusive (e.g., same day = 1 day)
}

/**
 * Split long events (>3 days) into two separate events: one for start date, one for end date
 * @param eventInput - Original event input
 * @returns Array of 1 or 2 events (split if duration > 3 days)
 */
export function splitLongEvent(eventInput: CalendarEventInput): CalendarEventInput[] {
  const duration = calculateDaysDuration(eventInput.startDate, eventInput.endDate);

  // If duration is 3 days or less, return the original event
  if (duration <= 3) {
    return [eventInput];
  }

  // Split into two events
  const startEvent: CalendarEventInput = {
    ...eventInput,
    title: `${eventInput.title} (~${eventInput.endDate})`,
    endDate: eventInput.startDate, // Make it single-day event
    startTime: eventInput.startTime,
    endTime: eventInput.endTime,
  };

  const endEvent: CalendarEventInput = {
    ...eventInput,
    title: `${eventInput.title} (${eventInput.startDate}~)`,
    startDate: eventInput.endDate, // Make it single-day event
    startTime: eventInput.startTime,
    endTime: eventInput.endTime,
  };

  return [startEvent, endEvent];
}

export async function processNewItem(
  env: Env,
  item: RssItem,
  accessToken: string,
  existingEvents: GoogleCalendarEvent[],
  similarityThreshold: number
): Promise<GoogleCalendarEvent[]> {
  const summary = await generateSummary(env, {
    title: item.title,
    description: item.descriptionHtml,
    previewText: undefined,
    attachmentText: item.attachment
      ? item.attachment.filename
        ? `첨부파일: ${item.attachment.filename}`
        : undefined
      : undefined,
    link: item.link,
    pubDate: item.pubDate,
  });
  const eventInputs = await generateEventInfos(env, item);
  const createdEvents: GoogleCalendarEvent[] = [];

  for (let eventInput of eventInputs) {
    // Default endTime to startTime to ensure timed events are consistently deduplicated
    if (eventInput.startTime && !eventInput.endTime) {
      eventInput = {
        ...eventInput,
        endTime: eventInput.startTime,
      };
    }
    // AC-2, AC-3: 원본 본문과 첨부파일 정보 제거
    const description = buildDescription(item, summary);
    eventInput.description = description;

    // Split long events (>3 days) into two separate events
    const eventsToCreate = splitLongEvent(eventInput);

    // Prepare and validate all split events before creating any
    // This ensures atomicity: either all parts are created or none
    type PreparedEvent = {
      input: CalendarEventInput;
      hash: string;
      meta: ProcessedRecord;
    };

    const preparedEvents: PreparedEvent[] = [];
    let hasDuplicate = false;

    for (const splitEvent of eventsToCreate) {
      const hash = await computeHash(splitEvent);
      const meta: ProcessedRecord = {
        eventId: "",
        nttNo: item.id,
        processedAt: new Date().toISOString(),
        hash,
      };

      const duplicate = await isDuplicate(existingEvents, splitEvent, {
        threshold: similarityThreshold,
        meta,
      });

      if (duplicate) {
        console.log(
          `Duplicate detected for ${item.id} event: ${splitEvent.title}`
        );
        hasDuplicate = true;
        break; // Stop checking if any part is duplicate
      }

      preparedEvents.push({ input: splitEvent, hash, meta });
    }

    // If any part is duplicate, skip the entire event group
    if (hasDuplicate) {
      await putProcessedRecord(env, item.id, {
        eventId: "duplicate-skip",
        nttNo: item.id,
        processedAt: new Date().toISOString(),
        hash: preparedEvents[0]?.hash ?? "",
      });
      continue;
    }

    // Create all events (now we know none are duplicates)
    const newlyCreatedEvents: GoogleCalendarEvent[] = [];
    const attachments = buildAttachmentFromFile(item);

    for (const prepared of preparedEvents) {
      const created = await createEvent(env, accessToken, prepared.input, prepared.meta, {
        summaryHash: prepared.hash,
      }, attachments ? [attachments] : undefined);

      newlyCreatedEvents.push(created);
    }

    // All events created successfully, now commit state changes atomically
    for (let i = 0; i < newlyCreatedEvents.length; i++) {
      const created = newlyCreatedEvents[i];
      const prepared = preparedEvents[i];

      await putProcessedRecord(env, item.id, {
        ...prepared.meta,
        eventId: created.id,
      });

      existingEvents.push(created);
      createdEvents.push(created);

      // Send Telegram notification (fire-and-forget, errors handled internally)
      // Prefer htmlLink from API, fallback to building URL with proper eid encoding
      const calendarUrl = created.htmlLink ?? buildCalendarEventUrl(created.id, env.GOOGLE_CALENDAR_ID);
      await sendNotification(
        {
          eventTitle: prepared.input.title,
          rssUrl: item.link,
          eventUrl: calendarUrl,
        },
        env
      );
    }
  }

  // 의미있는 일정이 없었을 때 상태 저장 (한 번 시도 후 더 이상 재시도하지 않음)
  if (eventInputs.length === 0) {
    console.log(
      `No meaningful events extracted for item ${item.id}, marking as processed`
    );
    await putProcessedRecord(env, item.id, {
      eventId: "",
      nttNo: item.id,
      processedAt: new Date().toISOString(),
      hash: "",
    });
  }

  return createdEvents;
}

async function run(env: Env): Promise<{ processed: number; created: number }> {
  const rssXml = await fetchRssFeed();
  const items = parseRss(rssXml);
  const accessToken = await obtainAccessToken(env);
  const lookbackDays = Number.parseInt(env.LOOKBACK_DAYS ?? "60", 10);
  const now = new Date();
  const start = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const maxProcessedId = await getMaxProcessedId(env);
  const [existing, similarityThreshold] = await Promise.all([
    listEvents(env, accessToken, {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
    }),
    Promise.resolve(Number.parseFloat(env.SIMILARITY_THRESHOLD ?? "0.85")),
  ]);

  let processed = 0;
  let created = 0;
  const skippedItems: string[] = [];
  const alreadyProcessedItems: string[] = [];
  let maxSuccessfulId = 0; // Track max successful numeric ID for batch update

  for (const item of items) {
    // Filter 1: Skip items that were already processed (based on max ID) - O(1) check
    const itemId = Number.parseInt(item.id, 10);
    if (itemId <= maxProcessedId) {
      alreadyProcessedItems.push(item.id);
      processed += 1;
      continue;
    }

    // Filter 2: Only process items with pubDate within last 7 days
    if (!isWithinLastWeek(item.pubDate)) {
      skippedItems.push(`Item ${item.id} - pubDate ${item.pubDate}`);
      continue;
    }

    // Filter 3: Fallback for non-numeric IDs to prevent reprocessing
    // Only check KV after passing date filter to avoid unnecessary I/O on stale items
    if (Number.isNaN(itemId)) {
      const already = await getProcessedRecord(env, item.id);
      if (already) {
        alreadyProcessedItems.push(item.id);
        processed += 1;
        continue;
      }
    }
    try {
      const results = await processNewItem(
        env,
        item,
        accessToken,
        existing,
        similarityThreshold
      );
      processed += 1;
      created += results.length;

      // Track successful numeric ID for batch update after loop completes
      if (!Number.isNaN(itemId) && itemId > maxSuccessfulId) {
        maxSuccessfulId = itemId;
      }
    } catch (error) {
      console.error("Failed to process item", item.id, error);
    }
  }

  // Update max processed ID only after batch completes
  // This ensures failed items are retried in the next run, not skipped
  if (maxSuccessfulId > 0) {
    await updateMaxProcessedId(env, maxSuccessfulId.toString());
  }

  if (skippedItems.length > 0) {
    console.log(
      `Skipped ${skippedItems.length} items (older than 1 week):\n${skippedItems.join("\n")}`
    );
  }

  if (alreadyProcessedItems.length > 0) {
    console.log(`Already processed ${alreadyProcessedItems.length} items (max_id: ${maxProcessedId})`);
  }

  return { processed, created };
}

export default {
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      run(env)
        .then((stats) => {
          console.log("Scheduled run complete", stats);
        })
        .catch((error) => {
          console.error("Scheduled run failed", error);
        })
    );
  },
};
