import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../src/index';
import type { RssItem, ProcessedRecord } from '../src/types';

// Mock all external dependencies
vi.mock('../src/lib/rss', () => ({
  parseRss: vi.fn(),
}));

vi.mock('../src/lib/ai', () => ({
  generateSummary: vi.fn(),
  generateEventInfos: vi.fn(),
  extractTextFromImage: vi.fn(),
}));

vi.mock('../src/lib/calendar', () => ({
  obtainAccessToken: vi.fn(),
  listEvents: vi.fn(),
  createEvent: vi.fn(),
}));

vi.mock('../src/lib/dedupe', () => ({
  isDuplicate: vi.fn(),
  computeHash: vi.fn(),
}));

vi.mock('../src/lib/html', () => ({
  htmlToText: vi.fn(),
}));

vi.mock('../src/lib/preview', () => ({
  fetchPreviewContent: vi.fn(),
  resolveAttachmentText: vi.fn(),
  getFileType: vi.fn(),
}));

vi.mock('../src/lib/state', () => ({
  getProcessedRecord: vi.fn(),
  putProcessedRecord: vi.fn(),
}));

// Import after mocking
import { parseRss } from '../src/lib/rss';
import { generateSummary, generateEventInfos, extractTextFromImage } from '../src/lib/ai';
import { obtainAccessToken, listEvents, createEvent } from '../src/lib/calendar';
import { isDuplicate, computeHash } from '../src/lib/dedupe';
import { htmlToText } from '../src/lib/html';
import { fetchPreviewContent, resolveAttachmentText, getFileType } from '../src/lib/preview';
import { getProcessedRecord, putProcessedRecord } from '../src/lib/state';

describe('Worker Integration Tests', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = {
      PROCESSED_STORE: {},
      GOOGLE_SERVICE_ACCOUNT_JSON: '{}',
      GOOGLE_CALENDAR_ID: 'test-calendar',
      OPENAI_API_KEY: 'test-key',
      OPENAI_CONTENT_MODEL: 'gpt-4',
      PREVIEW_PARSER_BASE: 'https://api.example.com',
      BEARER_TOKEN: 'test-token',
      SIMILARITY_THRESHOLD: '0.85',
      LOOKBACK_DAYS: '60',
    };

    // Reset all mocks
    vi.clearAllMocks();

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

describe('Scheduled event handling', () => {
    it('should handle scheduled events', async () => {
      const mockController = {};
      const mockContext = {
        waitUntil: vi.fn().mockImplementation((promise) => {
          // Immediately await the promise for testing
          return promise;
        }),
      };

      // Mock successful run
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<rss><item>test</item></rss>'),
      });
      const mockItems: RssItem[] = [];
      (parseRss as any).mockReturnValue(mockItems);
      (obtainAccessToken as any).mockResolvedValue('test-token');
      (listEvents as any).mockResolvedValue([]);

      await worker.scheduled(mockController as any, mockEnv, mockContext as any);

      expect(mockContext.waitUntil).toHaveBeenCalled();
      // The scheduled handler returns void, waitUntil handles the promise
    });
  });

});
