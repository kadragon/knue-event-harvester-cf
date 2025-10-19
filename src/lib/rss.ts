import { DOMParser as XmldomParser } from "@xmldom/xmldom";
import type { RssItem } from "../types";

function textContent(node: Element | null | undefined): string {
  if (!node) return "";
  return (node.textContent ?? "").trim();
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
  const ParserCtor: typeof DOMParser = typeof DOMParser !== "undefined" ? DOMParser : (XmldomParser as unknown as typeof DOMParser);
  const parser = new ParserCtor();
  const doc = parser.parseFromString(xml, "text/xml");
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
