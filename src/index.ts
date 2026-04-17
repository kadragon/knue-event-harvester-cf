import { extractTextFromImage, generateEventInfos, generateSummary, type AiEnv } from "./lib/ai.js";
import {
  obtainAccessToken,
  listEvents,
  createEvent,
  type CalendarEnv,
  type GoogleCalendarEvent,
} from "./lib/calendar.js";
import { isDuplicate, computeHash } from "./lib/dedupe.js";
import { sendNotification } from "./lib/telegram.js";

import { parseRss } from "./lib/rss.js";
import {
  getProcessedRecord,
  putProcessedRecord,
  getMaxProcessedId,
  updateMaxProcessedId,
  openDatabase,
  LEGACY_FEED_ID,
  type StateEnv,
} from "./lib/state.js";
import type {
  CalendarEventInput,
  FeedSource,
  ProcessedRecord,
  RssItem,
  AiSummary,
  PreviewContent,
} from "./types.js";
import { deduplicateLinks, buildAttachmentFromFile } from "./lib/utils.js";
import { getFileType } from "./lib/preview.js";

interface Env extends StateEnv, CalendarEnv, AiEnv {
  SIMILARITY_THRESHOLD?: string;
  LOOKBACK_DAYS?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_USER_ID?: string;
}

export const FEEDS: readonly FeedSource[] = [
  {
    id: LEGACY_FEED_ID,
    url: "https://www.knue.ac.kr/rssBbsNtt.do?bbsNo=28",
    label: "공지사항",
  },
  {
    id: "bbs250",
    url: "https://www.knue.ac.kr/rssBbsNtt.do?bbsNo=250",
    label: "청람동정",
  },
];

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

async function fetchRssFeed(url: string): Promise<string> {
  const response = await fetch(url, {
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

const MAX_HIGHLIGHTS = 4;
const MAX_ACTION_ITEMS = 2;

export function buildDescription(
  item: RssItem,
  summary: AiSummary
): string {
  const parts: string[] = [];
  parts.push(summary.summary);
  const limitedHighlights = summary.highlights.slice(0, MAX_HIGHLIGHTS);
  if (limitedHighlights.length > 0) {
    parts.push(
      "주요 포인트:\n" +
        limitedHighlights.map((line) => `- ${line}`).join("\n")
    );
  }
  const limitedActions = summary.actionItems.slice(0, MAX_ACTION_ITEMS);
  if (limitedActions.length > 0) {
    parts.push(
      "확인/신청 사항:\n" +
        limitedActions.map((line) => `- ${line}`).join("\n")
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
 * Format date for display, omitting year if it matches current year
 * @param date - Date in YYYY-MM-DD format
 * @returns Formatted date (MM-DD if current year, YYYY-MM-DD otherwise)
 */
export function formatDateForDisplay(date: string): string {
  const currentYear = new Date().getFullYear();
  const dateYear = parseInt(date.substring(0, 4), 10);

  if (dateYear === currentYear) {
    // Return MM-DD format (omit year)
    return date.substring(5); // Returns "MM-DD"
  }

  // Return full YYYY-MM-DD format
  return date;
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

  // Format dates for display (omit year if current year)
  const formattedStartDate = formatDateForDisplay(eventInput.startDate);
  const formattedEndDate = formatDateForDisplay(eventInput.endDate);

  // Split into two events
  const startEvent: CalendarEventInput = {
    ...eventInput,
    title: `${eventInput.title} (~${formattedEndDate})`,
    endDate: eventInput.startDate, // Make it single-day event
    startTime: eventInput.startTime,
    endTime: eventInput.endTime,
  };

  const endEvent: CalendarEventInput = {
    ...eventInput,
    title: `${eventInput.title} (${formattedStartDate}~)`,
    startDate: eventInput.endDate, // Make it single-day event
    startTime: eventInput.startTime,
    endTime: eventInput.endTime,
  };

  return [startEvent, endEvent];
}

async function fetchImageAsBase64(url: string): Promise<PreviewContent | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Image fetch failed (${response.status}): ${url}`);
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const buffer = await response.arrayBuffer();
    const imageBase64 = Buffer.from(buffer).toString("base64");
    return { sourceType: "image", imageBase64, contentType };
  } catch (error) {
    console.warn("Failed to fetch image", url, error);
    return null;
  }
}

export async function processNewItem(
  env: Env,
  feedId: string,
  item: RssItem,
  accessToken: string,
  existingEvents: GoogleCalendarEvent[],
  similarityThreshold: number
): Promise<GoogleCalendarEvent[]> {
  // OCR: 첨부 이미지가 있으면 vision 모델로 텍스트 추출
  let previewText: string | undefined;
  if (item.attachment?.url && getFileType(item.attachment.filename) === "image") {
    const imageContent = await fetchImageAsBase64(item.attachment.url);
    if (imageContent) {
      previewText = await extractTextFromImage(env, imageContent);
      if (previewText) {
        console.log(`OCR extracted ${previewText.length} chars from image for item ${item.id}`);
      }
    }
  }

  const [summary, eventInputs] = await Promise.all([
    generateSummary(env, {
      title: item.title,
      description: item.descriptionHtml,
      previewText,
      attachmentText: item.attachment
        ? item.attachment.filename
          ? `첨부파일: ${item.attachment.filename}`
          : undefined
        : undefined,
      link: item.link,
      pubDate: item.pubDate,
    }),
    generateEventInfos(env, item, previewText),
  ]);
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
        feedId,
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
      await putProcessedRecord(env, feedId, item.id, {
        eventId: "duplicate-skip",
        nttNo: item.id,
        processedAt: new Date().toISOString(),
        hash: preparedEvents[0]?.hash ?? "",
        feedId,
      });
      continue;
    }

    // Create all events (now we know none are duplicates)
    const newlyCreatedEvents: GoogleCalendarEvent[] = [];
    const attachments = buildAttachmentFromFile(item);

    for (const prepared of preparedEvents) {
      const created = await createEvent(env, accessToken, prepared.input, prepared.meta, {
        summaryHash: prepared.hash,
        feedId,
      }, attachments ? [attachments] : undefined);

      newlyCreatedEvents.push(created);
    }

    // All events created successfully, now commit state changes atomically
    for (let i = 0; i < newlyCreatedEvents.length; i++) {
      const created = newlyCreatedEvents[i];
      const prepared = preparedEvents[i];

      await putProcessedRecord(env, feedId, item.id, {
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
      `No meaningful events extracted for item ${item.id} (feed=${feedId}), marking as processed`
    );
    await putProcessedRecord(env, feedId, item.id, {
      eventId: "",
      nttNo: item.id,
      processedAt: new Date().toISOString(),
      hash: "",
      feedId,
    });
  }

  return createdEvents;
}

export async function run(
  env: Env,
  feeds: readonly FeedSource[] = FEEDS,
): Promise<{ processed: number; created: number }> {
  const accessToken = await obtainAccessToken(env);
  const lookbackDays = Number.parseInt(env.LOOKBACK_DAYS ?? "60", 10);
  const now = new Date();
  const start = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [existing, similarityThreshold] = await Promise.all([
    listEvents(env, accessToken, {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
    }),
    Promise.resolve(Number.parseFloat(env.SIMILARITY_THRESHOLD ?? "0.85")),
  ]);

  let totalProcessed = 0;
  let totalCreated = 0;

  for (const feed of feeds) {
    try {
      const stats = await runFeed(env, feed, accessToken, existing, similarityThreshold);
      totalProcessed += stats.processed;
      totalCreated += stats.created;
    } catch (error) {
      console.error(`Failed to process feed ${feed.id} (${feed.url})`, error);
    }
  }

  return { processed: totalProcessed, created: totalCreated };
}

async function runFeed(
  env: Env,
  feed: FeedSource,
  accessToken: string,
  existing: GoogleCalendarEvent[],
  similarityThreshold: number,
): Promise<{ processed: number; created: number }> {
  const rssXml = await fetchRssFeed(feed.url);
  const items = parseRss(rssXml);
  const maxProcessedId = await getMaxProcessedId(env, feed.id);

  let processed = 0;
  let created = 0;
  const skippedItems: string[] = [];
  const alreadyProcessedItems: string[] = [];
  let maxSuccessfulId = 0;

  for (const item of items) {
    const itemId = Number.parseInt(item.id, 10);
    if (!Number.isNaN(itemId) && itemId <= maxProcessedId) {
      alreadyProcessedItems.push(item.id);
      processed += 1;
      break;
    }

    if (!isWithinLastWeek(item.pubDate)) {
      skippedItems.push(`Item ${item.id} - pubDate ${item.pubDate}`);
      continue;
    }

    if (Number.isNaN(itemId)) {
      const already = await getProcessedRecord(env, feed.id, item.id);
      if (already) {
        alreadyProcessedItems.push(item.id);
        processed += 1;
        continue;
      }
    }

    try {
      const results = await processNewItem(
        env,
        feed.id,
        item,
        accessToken,
        existing,
        similarityThreshold,
      );
      processed += 1;
      created += results.length;

      if (!Number.isNaN(itemId) && itemId > maxSuccessfulId) {
        maxSuccessfulId = itemId;
      }
    } catch (error) {
      console.error(`Failed to process item ${item.id} (feed=${feed.id})`, error);
    }
  }

  if (maxSuccessfulId > 0) {
    await updateMaxProcessedId(env, feed.id, maxSuccessfulId.toString());
  }

  if (skippedItems.length > 0) {
    console.log(
      `[${feed.id}] Skipped ${skippedItems.length} items (older than 1 week):\n${skippedItems.join("\n")}`,
    );
  }

  if (alreadyProcessedItems.length > 0) {
    console.log(
      `[${feed.id}] Already processed ${alreadyProcessedItems.length} items (max_id: ${maxProcessedId})`,
    );
  }

  return { processed, created };
}

async function main() {
  const { config } = await import("dotenv");
  config();

  const dbPath = process.env.DATABASE_PATH ?? (() => {
    const defaultPath = new URL("../data/state.db", import.meta.url).pathname;
    console.warn(`DATABASE_PATH not set, using default: ${defaultPath}`);
    return defaultPath;
  })();
  const db = openDatabase(dbPath);

  const env: Env = {
    db,
    OLLAMA_HOST: process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434",
    OLLAMA_CONTENT_MODEL: process.env.OLLAMA_CONTENT_MODEL ?? "llama3.1:8b",
    OLLAMA_VISION_MODEL: process.env.OLLAMA_VISION_MODEL,
    GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID ?? "",
    GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "",
    SIMILARITY_THRESHOLD: process.env.SIMILARITY_THRESHOLD,
    LOOKBACK_DAYS: process.env.LOOKBACK_DAYS,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_USER_ID: process.env.TELEGRAM_USER_ID,
  };

  try {
    const stats = await run(env);
    console.log("Run complete", stats);
  } finally {
    db.close();
  }
}

const isMain = process.argv[1]
  ? new URL(import.meta.url).pathname === process.argv[1]
  : false;

if (isMain) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
