import type { CalendarEventInput, ProcessedRecord } from "../types";
import type { GoogleCalendarEvent } from "./calendar";

export function normalizedLevenshtein(a: string, b: string): number {
  const source = a.trim().toLowerCase();
  const target = b.trim().toLowerCase();
  if (source === target) return 1;
  if (source.length === 0 || target.length === 0) return 0;
  const matrix: number[][] = Array.from({ length: source.length + 1 }, () => []);
  for (let i = 0; i <= source.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= target.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= source.length; i += 1) {
    for (let j = 1; j <= target.length; j += 1) {
      if (source[i - 1] === target[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1,
        );
      }
    }
  }

  const distance = matrix[source.length][target.length];
  const maxLength = Math.max(source.length, target.length);
  return 1 - distance / maxLength;
}

function normalizeText(text: string | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

export function computeHash(input: {
  title: string;
  description: string;
  startDate: string;
}): string {
  const payload = `${input.title}::${input.startDate}::${input.description}`;
  const buffer = new TextEncoder().encode(payload);
  return crypto.subtle.digest("SHA-256", buffer).then((digest) => {
    const bytes = new Uint8Array(digest);
    let hex = "";
    for (const byte of bytes) {
      hex += byte.toString(16).padStart(2, "0");
    }
    return hex;
  });
}

export async function isDuplicate(
  existing: GoogleCalendarEvent[],
  candidate: CalendarEventInput,
  options: { threshold: number; meta?: ProcessedRecord },
): Promise<boolean> {
  const normalizedTitle = normalizeText(candidate.title);
  const normalizedDescription = normalizeText(candidate.description);
  const day = candidate.startDate;
  for (const event of existing) {
    if (options.meta?.nttNo && event.extendedProperties?.private?.nttNo === options.meta.nttNo) {
      return true;
    }
    const eventDate = event.start?.date ?? event.start?.dateTime?.slice(0, 10);
    if (eventDate !== day) continue;
    const titleScore = normalizedLevenshtein(
      normalizedTitle,
      normalizeText(event.summary ?? ""),
    );
    const descScore = normalizedLevenshtein(
      normalizedDescription,
      normalizeText(event.description ?? ""),
    );
    const maxScore = Math.max(titleScore, descScore);
    if (maxScore >= options.threshold) {
      return true;
    }
  }
  return false;
}
