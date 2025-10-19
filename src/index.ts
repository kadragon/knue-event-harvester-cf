import { generateSummary, extractTextFromImage, type AiEnv } from "./lib/ai";
import {
  obtainAccessToken,
  listEvents,
  createEvent,
  type CalendarEnv,
  type GoogleCalendarEvent,
} from "./lib/calendar";
import { isDuplicate, computeHash } from "./lib/dedupe";
import { htmlToText } from "./lib/html";
import { fetchPreviewContent, resolveAttachmentText, type EnvBindings } from "./lib/preview";
import { parseRss } from "./lib/rss";
import { getProcessedRecord, putProcessedRecord, type StateEnv } from "./lib/state";
import type { AiSummary, CalendarEventInput, ProcessedRecord, RssItem } from "./types";

interface Env extends StateEnv, CalendarEnv, EnvBindings, AiEnv {
  OPENAI_API_KEY: string;
  OPENAI_CONTENT_MODEL: string;
  OPENAI_VISION_MODEL?: string;
  SIMILARITY_THRESHOLD?: string;
  LOOKBACK_DAYS?: string;
  GOOGLE_CALENDAR_ID: string;
  GOOGLE_SERVICE_ACCOUNT_JSON: string;
}

const RSS_URL = "https://www.knue.ac.kr/rssBbsNtt.do?bbsNo=28";

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

function normalizeDate(pubDate: string): string {
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

function buildDescription(
  item: RssItem,
  summary: AiSummary,
  htmlDescription: string,
  attachmentText: string,
  previewText?: string,
  imageText?: string,
): string {
  const parts: string[] = [];
  parts.push(summary.summary);
  if (summary.highlights.length > 0) {
    parts.push("주요 포인트:\n" + summary.highlights.map((line) => `- ${line}`).join("\n"));
  }
  if (summary.actionItems.length > 0) {
    parts.push("확인/신청 사항:\n" + summary.actionItems.map((line) => `- ${line}`).join("\n"));
  }
  if (summary.links.length > 0 || item.link) {
    const linkLines = [...summary.links];
    if (item.link) linkLines.unshift(item.link);
    parts.push("관련 링크:\n" + linkLines.map((link) => `- ${link}`).join("\n"));
  }
  if (attachmentText) parts.push(attachmentText);
  if (previewText) parts.push(`미리보기 요약:\n${previewText}`);
  if (imageText) parts.push(`OCR 추출 텍스트:\n${imageText}`);
  if (htmlDescription) {
    parts.push("원문 본문:\n" + htmlDescription);
  }
  return parts.join("\n\n");
}

async function processNewItem(
  env: Env,
  item: RssItem,
  accessToken: string,
  existingEvents: GoogleCalendarEvent[],
  similarityThreshold: number,
): Promise<GoogleCalendarEvent | null> {
  const normalizedDate = normalizeDate(item.pubDate);
  const plainText = htmlToText(item.descriptionHtml);
  const attachmentText = resolveAttachmentText(item);

  const preview = await fetchPreviewContent(item.attachment?.preview, env);
  let previewText: string | undefined;
  if (preview.sourceType === "text") {
    previewText = htmlToText(preview.text ?? "");
  }
  let imageText: string | undefined;
  if (preview.sourceType === "image") {
    imageText = await extractTextFromImage(env, preview);
  }
  const extraText = previewText ?? imageText ?? "";
  const aiSummary = await generateSummary(env, {
    title: item.title,
    description: plainText,
    previewText: extraText,
    attachmentText,
    link: item.link,
    pubDate: normalizedDate,
  });

  const description = buildDescription(
    item,
    aiSummary,
    plainText,
    attachmentText,
    previewText,
    imageText,
  );

  const eventInput: CalendarEventInput = {
    title: item.title.trim() || "제목 없음",
    description,
    startDate: normalizedDate,
    endDate: normalizedDate,
  };

  const hash = await computeHash(eventInput);
  const meta: ProcessedRecord = {
    eventId: "",
    nttNo: item.id,
    processedAt: new Date().toISOString(),
    hash,
  };

  const duplicate = await isDuplicate(existingEvents, eventInput, {
    threshold: similarityThreshold,
    meta,
  });
  if (duplicate) {
    console.log(`Duplicate detected for ${item.id}`);
    await putProcessedRecord(env, item.id, {
      ...meta,
      eventId: "duplicate-skip",
    });
    return null;
  }

  const created = await createEvent(env, accessToken, eventInput, meta, {
    summaryHash: hash,
  });
  await putProcessedRecord(env, item.id, {
    ...meta,
    eventId: created.id,
  });
  existingEvents.push(created);
  return created;
}

type GoogleCalendarEvent = Awaited<ReturnType<typeof createEvent>>;

async function run(env: Env): Promise<{ processed: number; created: number }> {
  const rssXml = await fetchRssFeed();
  const items = parseRss(rssXml);
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

  let processed = 0;
  let created = 0;

  for (const item of items) {
    const already = await getProcessedRecord(env, item.id);
    if (already) {
      processed += 1;
      continue;
    }
    try {
      const result = await processNewItem(env, item, accessToken, existing, similarityThreshold);
      processed += 1;
      if (result) created += 1;
    } catch (error) {
      console.error("Failed to process item", item.id, error);
    }
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
        }),
    );
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      try {
        const stats = await run(env);
        return new Response(JSON.stringify({ ok: true, stats }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(JSON.stringify({ ok: false, error: String(error) }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return new Response("knue-event-harvester");
  },
};
