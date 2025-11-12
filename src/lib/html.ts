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

/**
 * Remove dangerous tags (script, style) using a lightweight parser
 * Handles all variations of closing tags including spaces and attributes
 * E.g., </script>, </script >, </script\t\n bar>, etc.
 */
function removeDangerousTags(html: string): string {
  const dangerousTags = ['script', 'style'];
  let result = html;

  for (const tag of dangerousTags) {
    let output = '';
    let pos = 0;

    while (pos < result.length) {
      // Find opening tag: <script or <style (case-insensitive)
      const openTagStart = result.toLowerCase().indexOf(`<${tag}`, pos);

      if (openTagStart === -1) {
        // No more tags found, append rest of string
        output += result.slice(pos);
        break;
      }

      // Append everything before the opening tag
      output += result.slice(pos, openTagStart);

      // Find the end of opening tag (>)
      const openTagEnd = result.indexOf('>', openTagStart);
      if (openTagEnd === -1) {
        // Malformed tag, skip rest of document for safety
        break;
      }

      // Find closing tag: </script...> or </style...> (case-insensitive)
      // Must handle any characters between tag name and >
      const closeTagPattern = `</${tag}`;
      let closeTagStart = result.toLowerCase().indexOf(closeTagPattern, openTagEnd + 1);

      if (closeTagStart === -1) {
        // No closing tag found, remove everything from opening tag onwards
        break;
      }

      // Find the end of closing tag (>)
      const closeTagEnd = result.indexOf('>', closeTagStart);
      if (closeTagEnd === -1) {
        // Malformed closing tag, remove everything from opening tag onwards
        break;
      }

      // Skip everything from opening tag to end of closing tag
      pos = closeTagEnd + 1;
    }

    result = output;
  }

  return result;
}

export function htmlToText(html: string): string {
  if (!html) return "";

  // Remove dangerous tags using lightweight parser
  let normalized = removeDangerousTags(html);

  // Process other HTML tags
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
