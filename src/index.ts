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

import { parseRss } from "./lib/rss";
import {
  getProcessedRecord,
  putProcessedRecord,
  type StateEnv,
} from "./lib/state";
import type {
  CalendarEventInput,
  ProcessedRecord,
  RssItem,
  AiSummary,
} from "./types";

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
  imageText?: string
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
    const linkLines = [...summary.links];
    if (item.link) linkLines.unshift(item.link);
    parts.push(
      "관련 링크:\n" + linkLines.map((link) => `- ${link}`).join("\n")
    );
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

  for (const eventInput of eventInputs) {
    const description = buildDescription(
      item,
      summary,
      item.descriptionHtml,
      item.attachment
        ? item.attachment.filename
          ? `첨부파일: ${item.attachment.filename}`
          : ""
        : "",
      undefined,
      undefined
    );
    eventInput.description = description;

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
      console.log(
        `Duplicate detected for ${item.id} event: ${eventInput.title}`
      );
      // 중복 감지 시에도 상태 저장 (다시 처리하지 않도록)
      await putProcessedRecord(env, item.id, {
        eventId: "duplicate-skip",
        nttNo: item.id,
        processedAt: new Date().toISOString(),
        hash,
      });
      continue;
    }

    const created = await createEvent(env, accessToken, eventInput, meta, {
      summaryHash: hash,
    });
    await putProcessedRecord(env, item.id, {
      ...meta,
      eventId: created.id,
    });
    existingEvents.push(created);
    createdEvents.push(created);
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
      const results = await processNewItem(
        env,
        item,
        accessToken,
        existing,
        similarityThreshold
      );
      processed += 1;
      created += results.length;
    } catch (error) {
      console.error("Failed to process item", item.id, error);
    }
  }

  return { processed, created };
}

async function testFirstItem(env: Env): Promise<any> {
  try {
    const rssXml = await fetchRssFeed();
    const items = parseRss(rssXml);
    if (items.length === 0) {
      return { error: "No RSS items found" };
    }
    const firstItem = items[0];
    console.log("Testing first RSS item:", firstItem.title, firstItem.id);

    const eventInputs = await generateEventInfos(env, firstItem);
    console.log("Extracted events:", eventInputs);

    return {
      item: {
        id: firstItem.id,
        title: firstItem.title,
        pubDate: firstItem.pubDate,
        descriptionLength: firstItem.descriptionHtml.length,
      },
      events: eventInputs,
    };
  } catch (error) {
    console.error("Test failed", error);
    return { error: String(error) };
  }
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
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      try {
        const stats = await run(env);
        return new Response(JSON.stringify({ ok: true, stats }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ ok: false, error: String(error) }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }
    if (url.pathname === "/test") {
      try {
        const result = await testFirstItem(env);
        return new Response(JSON.stringify(result, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ ok: false, error: String(error) }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }
    return new Response("knue-event-harvester");
  },
};
