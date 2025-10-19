import type { AiSummary, PreviewContent, CalendarEventInput, RssItem } from "../types";

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

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');
}

function buildOpenAIEndpoint(env: AiEnv): string {
  // Cloudflare AI Gateway 사용 설정
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_AI_GATEWAY_NAME) {
    return `https://gateway.ai.cloudflare.com/v1/account/${env.CLOUDFLARE_ACCOUNT_ID}/ai-gateway/${env.CLOUDFLARE_AI_GATEWAY_NAME}/openai/chat/completions`;
  }
  // AI Gateway 미설정시 OpenAI 직접 호출
  return "https://api.openai.com/v1/chat/completions";
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
          "You are an OCR assistant. Extract all readable Korean text. Return JSON {\"extractedText\": string}.",
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
    response_format: { type: "json_object" },
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
  const prompt = `다음은 한국교원대학교 공지사항입니다. 핵심 정보를 JSON 으로 구성해 주세요.\n\n제목: ${title}\n게시일: ${pubDate}\n본문:\n${description}\n\n첨부/미리보기:\n${previewText ?? "(없음)"}\n\n첨부 메타:\n${attachmentText ?? "(없음)"}\n\n원문 링크: ${link}`;

  const payload = {
    model: env.OPENAI_CONTENT_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a helpful assistant that summarizes university announcements. Output JSON with keys summary (string), highlights (string[]), actionItems (string[]), links (string[]). Korean language only.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.2,
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

async function parseEventJsonArray(content: string | undefined, pubDate: string): Promise<CalendarEventInput[]> {
  console.log("Parsing content:", content);
  if (!content) return [EVENT_JSON_FALLBACK];
  try {
    const data = JSON.parse(content);
    console.log("Parsed JSON data:", data);
    if (Array.isArray(data.events)) {
      console.log("Found events array");
      return data.events.map((event: any) => ({
        title: event.title ?? EVENT_JSON_FALLBACK.title,
        description: event.description ?? EVENT_JSON_FALLBACK.description,
        startDate: event.startDate ?? pubDate,
        endDate: event.endDate ?? (event.startDate ?? pubDate),
        startTime: typeof event.startTime === "string" ? event.startTime : undefined,
        endTime: typeof event.endTime === "string" ? event.endTime : undefined,
      })).filter((event) => event.title && event.description);
    } else {
      console.log("No events array, treating as single event");
      // Single event fallback
      const event = {
        title: data.title ?? EVENT_JSON_FALLBACK.title,
        description: data.description ?? EVENT_JSON_FALLBACK.description,
        startDate: data.startDate ?? pubDate,
        endDate: data.endDate ?? (data.startDate ?? pubDate),
        startTime: typeof data.startTime === "string" ? data.startTime : undefined,
        endTime: typeof data.endTime === "string" ? data.endTime : undefined,
      };
      return [event];
    }
  } catch (error) {
    console.error("Failed to parse event JSON", error, content);
    return [EVENT_JSON_FALLBACK];
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

행사 날짜 처리 기준:
- 연도가 명시된 경우: 해당 연도를 그대로 사용합니다.
- 연도가 없는 경우:
    - 게시일의 연도를 기준으로 합니다.
    - 기준 연도의 행사일이 게시일과 같거나 이후인 경우: 그대로 사용합니다.
    - 기준 연도의 행사일이 게시일 이전인 경우: 연도를 1년 뒤로 조정하여 게시일 이후가 되도록 합니다.
- 모든 행사일은 반드시 게시일 이후여야 합니다.

시간대:
- Asia/Seoul (KST) 시간대를 사용합니다.

행사 설명 작성 기준:
- 명확한 항목 형식으로 구성되어야 하며, 이모지를 포함할 수 있습니다.
- 예시:
    - 👐 대상: 재학생
    - 🧑‍🏫 강사: 홍길동

반환 형식:
- 행사 정보는 항상 목록(List) 형태로 반환해야 합니다. 하나의 행사만 있는 경우에도 마찬가지입니다.
- 각 이벤트: title, description, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), startTime (HH:MM, optional), endTime (HH:MM, optional)`;

  const payload = {
    model: env.OPENAI_CONTENT_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
        "You are a helpful assistant that extracts calendar event information from university announcements. Analyze the content to identify multiple events if present. Output JSON with key 'events' containing an array of event objects, each with title, description, startDate, endDate, startTime (optional), endTime (optional). Korean language only for title and description.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.2,
  };

  console.log("AI Prompt for event extraction:", prompt);
  console.log("AI Payload model:", payload.model);

  let response: Response;
  const endpoint = buildOpenAIEndpoint(env);

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: buildHeaders(env),
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("AI request failed, trying direct OpenAI", error);
    // Fallback to direct OpenAI
    const directEndpoint = "https://api.openai.com/v1/chat/completions";
    response = await fetch(directEndpoint, {
      method: "POST",
      headers: buildHeaders(env),
      body: JSON.stringify(payload),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Event info request failed", response.status, errorText);

    // If Gateway failed, try direct OpenAI
    if (endpoint.includes("gateway.ai.cloudflare.com")) {
      console.log("Gateway failed, trying direct OpenAI");
      const directEndpoint = "https://api.openai.com/v1/chat/completions";
      const directResponse = await fetch(directEndpoint, {
        method: "POST",
        headers: buildHeaders(env),
        body: JSON.stringify(payload),
      });

      if (!directResponse.ok) {
        console.error("Direct OpenAI also failed", directResponse.status, await directResponse.text());
        return [EVENT_JSON_FALLBACK];
      }

      const directData = (await directResponse.json()) as OpenAIResponse;
      const directAiResponse = directData.choices[0]?.message?.content;
      console.log("Direct AI Response:", directAiResponse);

      const parsed = parseEventJsonArray(directAiResponse, item.pubDate);
      console.log("Parsed events from direct:", parsed);

      return parsed;
    }

    return [EVENT_JSON_FALLBACK];
  }
  const data = (await response.json()) as OpenAIResponse;
  const aiResponse = data.choices[0]?.message?.content;
  console.log("AI Response:", aiResponse);

  const parsed = parseEventJsonArray(aiResponse, item.pubDate);
  console.log("Parsed events:", parsed);

  return parsed;
}
