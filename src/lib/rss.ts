import { DOMParser as XmldomParser } from "@xmldom/xmldom";
import type { RssItem } from "../types.js";

function textContent(node: Element | null | undefined): string {
  if (!node) return "";
  return (node.textContent ?? "").trim().replace(/\uFFFD+/g, "");
}

function parseXmlDocument(xml: string): ReturnType<DOMParser["parseFromString"]> {
  if (typeof DOMParser !== "undefined") {
    return new DOMParser().parseFromString(xml, "text/xml");
  }
  const parser = new XmldomParser({
    onError: (level: string, message: string) => {
      // KNUE RSS feeds contain literal U+FFFD in CSS font-family values (server-side
      // data rot from an old EUC-KR→UTF-8 migration). Suppress that specific noise;
      // surface everything else.
      if (level === "warning" && /Unicode replacement character/i.test(message)) return;
      console.warn(`[xmldom ${level}] ${message}`);
    },
  });
  return parser.parseFromString(xml, "text/xml") as unknown as ReturnType<DOMParser["parseFromString"]>;
}

function extractId(link: string): string {
  try {
    const url = new URL(link);
    const maybeId = url.searchParams.get("nttNo") ?? url.searchParams.get("articleNo");
    if (maybeId) return maybeId;
    return Buffer.from(link).toString("base64url");
  } catch (error) {
    console.error("Failed to parse link for id", error);
    return crypto.randomUUID();
  }
}

export function parseRss(xml: string): RssItem[] {
  const doc = parseXmlDocument(xml);
  const items = Array.from(doc.getElementsByTagName("item"));

  return items.map((item) => {
    const title = textContent(item.getElementsByTagName("title")[0]);
    const link = textContent(item.getElementsByTagName("link")[0]);
    const pubDate = textContent(item.getElementsByTagName("pubDate")[0]);
    const descriptionHtml = textContent(
      item.getElementsByTagName("description")[0],
    );
    const department = textContent(item.getElementsByTagName("department")[0]);

    const attachment = {
      filename: textContent(item.getElementsByTagName("filename1")[0]),
      url: textContent(item.getElementsByTagName("url1")[0]),
      preview: textContent(item.getElementsByTagName("preview1")[0]),
    };

    const cleanAttachment =
      attachment.filename || attachment.url || attachment.preview
        ? attachment
        : undefined;

    return {
      id: extractId(link),
      title,
      link,
      pubDate,
      descriptionHtml,
      department: department || undefined,
      attachment: cleanAttachment,
    } satisfies RssItem;
  });
}
