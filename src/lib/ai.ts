import type { AiSummary, PreviewContent } from "../types";

export interface AiEnv {
  OPENAI_API_KEY: string;
  OPENAI_CONTENT_MODEL: string;
  OPENAI_VISION_MODEL?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_AI_GATEWAY_NAME?: string;
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

function buildOpenAIEndpoint(env: AiEnv): string {
  // Cloudflare AI Gateway 사용 설정
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_AI_GATEWAY_NAME) {
    return `https://gateway.ai.cloudflare.com/v1/account/${env.CLOUDFLARE_ACCOUNT_ID}/ai-gateway/${env.CLOUDFLARE_AI_GATEWAY_NAME}/openai/chat/completions`;
  }
  // AI Gateway 미설정시 OpenAI 직접 호출
  return "https://api.openai.com/v1/chat/completions";
}

function buildHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
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
    headers: buildHeaders(env.OPENAI_API_KEY),
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
    headers: buildHeaders(env.OPENAI_API_KEY),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error("Summary request failed", response.status, await response.text());
    return JSON_FALLBACK;
  }
  const data = (await response.json()) as OpenAIResponse;
  return parseJson(data.choices[0]?.message?.content);
}
