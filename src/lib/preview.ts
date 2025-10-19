import type { PreviewContent, RssItem } from "../types";

export type FileType = "image" | "pdf" | "hwp" | "doc" | "other";

export function getFileType(filename: string | undefined): FileType {
  if (!filename) return "other";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext)) {
    return "image";
  }
  if (ext === "pdf") {
    return "pdf";
  }
  if (["hwp", "hwpx"].includes(ext)) {
    return "hwp";
  }
  if (["doc", "docx"].includes(ext)) {
    return "doc";
  }
  return "other";
}

export function extractPreviewId(previewUrl: string | undefined): string | null {
  if (!previewUrl) return null;
  try {
    const url = new URL(previewUrl);
    const id = url.searchParams.get("atchmnflNo");
    return id;
  } catch (error) {
    console.warn("Failed to parse preview url", error);
    return null;
  }
}

export async function fetchPreviewContent(
  previewUrl: string | undefined,
  env: EnvBindings,
  fetcher: typeof fetch = fetch,
): Promise<PreviewContent> {
  const id = extractPreviewId(previewUrl ?? "");
  if (!id) {
    return { sourceType: "none" };
  }
  const endpoint = `${env.PREVIEW_PARSER_BASE}?atchmnflNo=${id}`;
  const response = await fetcher(endpoint, {
    headers: {
      Authorization: `Bearer ${env.BEARER_TOKEN}`,
    },
  });
  if (!response.ok) {
    console.error(`Failed to fetch preview ${id}`, response.status, response.statusText);
    return { sourceType: "none" };
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.startsWith("image/")) {
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return {
      sourceType: "image",
      imageBase64: base64,
      contentType,
    };
  }
  if (
    contentType.startsWith("text/") ||
    contentType.includes("json") ||
    contentType.includes("xml")
  ) {
    const text = await response.text();
    return {
      sourceType: "text",
      text,
      contentType,
    };
  }
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return {
    sourceType: "binary",
    imageBase64: base64,
    contentType,
  };
}

export type EnvBindings = {
  PREVIEW_PARSER_BASE: string;
  BEARER_TOKEN: string;
};

export function resolveAttachmentText(item: RssItem): string {
  if (!item.attachment) return "";
  const parts: string[] = [];
  if (item.attachment.filename) parts.push(`첨부 파일: ${item.attachment.filename}`);
  if (item.attachment.url) parts.push(`다운로드: ${item.attachment.url}`);
  if (item.attachment.preview) parts.push(`미리보기: ${item.attachment.preview}`);
  return parts.join("\n");
}
