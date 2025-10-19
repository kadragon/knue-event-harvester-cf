export interface RssItem {
  id: string;
  title: string;
  link: string;
  pubDate: string; // ISO date string (YYYY-MM-DD)
  descriptionHtml: string;
  department?: string;
  attachment?: {
    filename?: string;
    url?: string;
    preview?: string;
  };
}

export interface PreviewContent {
  sourceType: "none" | "text" | "image" | "binary";
  text?: string;
  imageBase64?: string;
  contentType?: string;
}

export interface AiSummary {
  summary: string;
  highlights: string[];
  actionItems: string[];
  links: string[];
  extractedText?: string;
}

export interface CalendarEventInput {
  title: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface ProcessedRecord {
  eventId: string;
  nttNo: string;
  processedAt: string;
  hash: string;
}
