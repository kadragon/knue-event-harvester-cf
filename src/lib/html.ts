const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(input: string): string {
  return input.replace(/&(#\d+|#x[\da-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity.startsWith("#x")) {
      return String.fromCodePoint(parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCodePoint(parseInt(entity.slice(1), 10));
    }
    return ENTITY_MAP[entity] ?? match;
  });
}

export function htmlToText(html: string): string {
  if (!html) return "";

  // Remove script and style tags with their content, handling spaces in closing tags
  // Use multiple passes to ensure complete removal
  let normalized = html;
  let prevLength = 0;

  while (normalized.length !== prevLength) {
    prevLength = normalized.length;
    normalized = normalized
      .replace(/<script[\s\S]*?<\/\s*script\s*>/gi, "")
      .replace(/<style[\s\S]*?<\/\s*style\s*>/gi, "");
  }

  // Now process other HTML tags
  normalized = normalized
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "");

  const decoded = decodeEntities(normalized);
  return decoded
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}
