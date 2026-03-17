import type { AiSummary, PreviewContent, CalendarEventInput, RssItem, AiEvent } from "../types";

export interface AiEnv {
  OPENAI_API_KEY: string;
  OPENAI_CONTENT_MODEL: string;
  OPENAI_VISION_MODEL?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_AI_GATEWAY_NAME?: string;
  CLOUDFLARE_AI_GATEWAY_AUTH?: string;
}

interface OpenAIResponse {
  choices: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const JSON_FALLBACK: AiSummary = {
  summary: "요약 정보를 생성하지 못했습니다.",
  highlights: [],
  actionItems: [],
  links: [],
};

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const AI_GATEWAY_ENDPOINT_TEMPLATE = "https://gateway.ai.cloudflare.com/v1/{accountId}/{gatewayName}/openai/chat/completions";

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
  reg: "®",
  hellip: "…",
  mdash: "—",
  ndash: "–",
};

function decodeHtmlEntities(text: string): string {
  // Handle numeric entities (&#233;, &#x3A9;) and named entities (&lt;, &amp;)
  // Using regex approach ensures proper handling of all entity types
  return text.replace(/&(#\d+|#x[\da-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    // Hexadecimal numeric entity (e.g., &#x3A9; -> Ω)
    if (entity.startsWith("#x")) {
      return String.fromCodePoint(parseInt(entity.slice(2), 16));
    }
    // Decimal numeric entity (e.g., &#233; -> é)
    if (entity.startsWith("#")) {
      return String.fromCodePoint(parseInt(entity.slice(1), 10));
    }
    // Named entity (e.g., &amp; -> &)
    // Return the entity itself if not found in map (prevents breaking unknown entities)
    return HTML_ENTITY_MAP[entity] ?? match;
  });
}

function buildOpenAIEndpoint(env: AiEnv): string {
  // Cloudflare AI Gateway 사용 설정
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_AI_GATEWAY_NAME) {
    return AI_GATEWAY_ENDPOINT_TEMPLATE.replace("{accountId}", env.CLOUDFLARE_ACCOUNT_ID).replace("{gatewayName}", env.CLOUDFLARE_AI_GATEWAY_NAME);
  }
  // AI Gateway 미설정시 OpenAI 직접 호출
  return OPENAI_ENDPOINT;
}

function buildHeaders(env: AiEnv): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  };

  if (env.CLOUDFLARE_AI_GATEWAY_AUTH) {
    headers["cf-aig-authorization"] = `Bearer ${env.CLOUDFLARE_AI_GATEWAY_AUTH}`;
  }

  return headers;
}

async function parseJson(content: string | undefined): Promise<AiSummary> {
  if (!content) return JSON_FALLBACK;
  try {
    const data = JSON.parse(content);
    return {
      summary: data.summary ?? JSON_FALLBACK.summary,
      highlights: Array.isArray(data.highlights) ? data.highlights : [],
      actionItems: Array.isArray(data.actionItems) ? data.actionItems : [],
      links: Array.isArray(data.links) ? data.links : [],
      extractedText: typeof data.extractedText === "string" ? data.extractedText : undefined,
    } satisfies AiSummary;
  } catch (error) {
    console.error("Failed to parse AI JSON", error, content);
    return JSON_FALLBACK;
  }
}

export async function extractTextFromImage(
  env: AiEnv,
  preview: PreviewContent,
): Promise<string | undefined> {
  if (preview.sourceType !== "image" || !preview.imageBase64) return undefined;
  const model = env.OPENAI_VISION_MODEL ?? env.OPENAI_CONTENT_MODEL;
  const payload = {
    model,
    messages: [
      {
        role: "system",
        content:
          "이미지에서 읽을 수 있는 모든 한국어 텍스트를 추출하는 OCR 어시스턴트입니다.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "이미지에서 보이는 텍스트를 원문 그대로 추출해서 JSON 으로 반환해 주세요.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${preview.contentType ?? "image/png"};base64,${preview.imageBase64}`,
            },
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ocr_result",
        strict: true,
        schema: {
          type: "object",
          properties: {
            extractedText: { type: "string" },
          },
          required: ["extractedText"],
          additionalProperties: false,
        },
      },
    },
  };

  const endpoint = buildOpenAIEndpoint(env);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: buildHeaders(env),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    console.error("Vision request failed", response.status, await response.text());
    return undefined;
  }
  const data = (await response.json()) as OpenAIResponse;
  const content = data.choices[0]?.message?.content;
  try {
    const parsed = JSON.parse(content ?? "{}");
    return typeof parsed.extractedText === "string" ? parsed.extractedText : undefined;
  } catch (error) {
    console.error("Failed to parse OCR JSON", error, content);
    return undefined;
  }
}

export async function generateSummary(
  env: AiEnv,
  params: {
    title: string;
    description: string;
    previewText?: string;
    attachmentText?: string;
    link: string;
    pubDate: string;
  },
): Promise<AiSummary> {
  const { title, description, previewText, attachmentText, link, pubDate } = params;
  const prompt = [
    "다음 공지사항을 캘린더 설명용으로 간결하게 요약해 주세요. 본문을 옮기지 말고, 훑어볼 수 있는 수준으로 축약하세요.",
    "",
    `제목: ${title}`,
    `게시일: ${pubDate}`,
    `본문:\n${description}`,
    "",
    `첨부/미리보기:\n${previewText ?? "(없음)"}`,
    "",
    `첨부 메타:\n${attachmentText ?? "(없음)"}`,
    "",
    `원문 링크: ${link}`,
  ].join("\n");

  const payload = {
    model: env.OPENAI_CONTENT_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "announcement_summary",
        strict: true,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            highlights: { type: "array", items: { type: "string" }, maxItems: 4 },
            actionItems: { type: "array", items: { type: "string" }, maxItems: 2 },
            links: { type: "array", items: { type: "string" } },
          },
          required: ["summary", "highlights", "actionItems", "links"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "system",
        content:
          `한국교원대학교 공지사항을 구글 캘린더 설명용으로 요약하는 어시스턴트입니다.

규칙:
- summary: 1~2문장. 핵심만 (누가, 무엇을, 왜). 본문을 그대로 옮기지 말 것.
- highlights: 최대 4개. 캘린더에서 빠르게 확인할 정보만 (대상, 장소, 신청방법 등).
  - 캘린더 이벤트 자체의 시작/종료 날짜와 중복되는 정보는 제외.
  - 각 항목은 "라벨: 값" 형식, 간결하게.
- actionItems: 최대 2개. 사용자가 반드시 해야 할 행동만 (신청, 제출 등). 단순 안내는 제외.
  - 동사로 시작, 한 줄로.
- links: 본문 내 외부 URL만. 원문 링크(${link})와 동일한 URL만 제외.
- 한국어로만 작성하세요.`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  const endpoint = buildOpenAIEndpoint(env);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: buildHeaders(env),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error("Summary request failed", response.status, await response.text());
    return JSON_FALLBACK;
  }
  const data = (await response.json()) as OpenAIResponse;
  return parseJson(data.choices[0]?.message?.content);
}

const EVENT_JSON_FALLBACK: CalendarEventInput = {
  title: "제목 없음",
  description: "설명 없음",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  startTime: undefined,
  endTime: undefined,
};

function buildEventInput(event: AiEvent, pubDate: string): CalendarEventInput {
  return {
    title: event.title ?? EVENT_JSON_FALLBACK.title,
    description: event.description ?? EVENT_JSON_FALLBACK.description,
    startDate: event.startDate ?? pubDate,
    endDate: event.endDate ?? (event.startDate ?? pubDate),
    startTime: typeof event.startTime === "string" ? event.startTime : undefined,
    endTime: typeof event.endTime === "string" ? event.endTime : undefined,
  };
}

async function parseEventJsonArray(content: string | undefined, pubDate: string): Promise<CalendarEventInput[]> {
  if (!content) return [];
  try {
    const data = JSON.parse(content);
    if (Array.isArray(data.events)) {
      const events = data.events as AiEvent[];
      return events
        .map((event) => buildEventInput(event, pubDate))
        .filter((event) => event.title && event.description);
    } else {
      console.warn("Unexpected response format: missing events array", content);
      return [];
    }
  } catch (error) {
    console.error("Failed to parse event JSON", error, content);
    return [EVENT_JSON_FALLBACK];
  }
}

async function fetchEventInfoWithFallback(
  env: AiEnv,
  payload: Record<string, unknown>,
): Promise<Response> {
  const endpoint = buildOpenAIEndpoint(env);

  try {
    return await fetch(endpoint, {
      method: "POST",
      headers: buildHeaders(env),
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("AI request failed, trying direct OpenAI", error);
    // Fallback to direct OpenAI
    return fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: buildHeaders(env),
      body: JSON.stringify(payload),
    });
  }
}

export async function generateEventInfos(
  env: AiEnv,
  item: RssItem,
): Promise<CalendarEventInput[]> {
  const prompt = `다음은 한국교원대학교 공지사항입니다. 캘린더 이벤트 정보를 JSON으로 추출해 주세요.

제목: ${item.title}
게시일: ${item.pubDate}
본문:
${decodeHtmlEntities(item.descriptionHtml)}

RSS 링크: ${item.link}

중요 지침:
- "본문"을 분석하여 다수의 행사가 있는지 확인합니다.
- 각 행사는 개별 일정으로 분리하여 처리해야 합니다.

■ 일정으로 추출하지 않아야 하는 경우 (빈 events 배열 반환):
- 구체적인 날짜(YYYY-MM-DD 또는 M월 D일 등)가 본문에 없는 일반 공지
- 인사 발령, 조직 변경, 시설 안내, 규정 변경 등 일정이 아닌 공지
- "추후 공지", "별도 안내" 등 날짜가 미정인 경우

■ 신청/접수 마감일만 있는 경우:
- 마감일을 startDate와 endDate로 사용하여 일정으로 추출합니다.
- title에 "(마감)" 등을 포함하여 마감일임을 명시합니다.

행사 날짜 처리 기준:
- 연도가 명시된 경우: 해당 연도를 그대로 사용합니다.
- 연도가 없는 경우:
    - 게시일의 연도를 기준으로 합니다.
    - 기준 연도의 행사일이 게시일과 같거나 이후인 경우: 그대로 사용합니다.
    - 기준 연도의 행사일이 게시일 이전인 경우: 연도를 1년 뒤로 조정하여 게시일 이후가 되도록 합니다.
- 모든 행사일은 반드시 게시일 이후여야 합니다.

시간 처리 기준:
- Asia/Seoul (KST) 시간대를 사용합니다.
- 종일 행사 또는 시간이 명시되지 않은 경우: startTime과 endTime을 모두 null로 설정합니다.
- 시작 시간만 있고 종료 시간이 불분명한 경우: endTime을 null로 설정합니다.
- 시간 형식: HH:MM (24시간제)

행사 설명 작성 기준:
- description에는 행사의 한 줄 요약을 반드시 작성하세요. 빈 문자열은 불가합니다.`;

  const payload = {
    model: env.OPENAI_CONTENT_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "calendar_events",
        strict: true,
        schema: {
          type: "object",
          properties: {
            events: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  startDate: { type: "string" },
                  endDate: { type: "string" },
                  startTime: { type: ["string", "null"] },
                  endTime: { type: ["string", "null"] },
                },
                required: ["title", "description", "startDate", "endDate", "startTime", "endTime"],
                additionalProperties: false,
              },
            },
          },
          required: ["events"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "system",
        content:
        "한국교원대학교 공지사항에서 캘린더 일정 정보를 추출하는 어시스턴트입니다. 본문을 분석하여 구체적인 날짜가 있는 행사/일정만 추출하세요. 일반 공지(인사 발령, 시설 안내, 규정 변경 등)나 구체적 날짜가 없는 공지는 빈 events 배열을 반환하세요. 한국어로만 작성하세요.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  let response = await fetchEventInfoWithFallback(env, payload);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Event info request failed", response.status, errorText);

    // If Gateway failed, try direct OpenAI
    const endpoint = buildOpenAIEndpoint(env);
    let isGatewayEndpoint = false;
    try {
      const url = new URL(endpoint);
      isGatewayEndpoint = url.hostname === "gateway.ai.cloudflare.com";
    } catch {
      // Invalid URL, treat as not gateway
      isGatewayEndpoint = false;
    }

    if (isGatewayEndpoint) {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: buildHeaders(env),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error("Direct OpenAI also failed", response.status, await response.text());
        return [EVENT_JSON_FALLBACK];
      }
    } else {
      return [EVENT_JSON_FALLBACK];
    }
  }

  const data = (await response.json()) as OpenAIResponse;
  const aiResponse = data.choices[0]?.message?.content;

  return parseEventJsonArray(aiResponse, item.pubDate);
}
