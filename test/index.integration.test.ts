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

  describe('Health check endpoint', () => {
    it('should return success stats on healthy run', async () => {
      // Mock successful run
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<rss><item>test</item></rss>'),
      });
      const mockItems: RssItem[] = [];
      (parseRss as any).mockReturnValue(mockItems);
      (obtainAccessToken as any).mockResolvedValue('test-token');
      (listEvents as any).mockResolvedValue([]);

      const request = new Request('http://example.com/health');
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      const data = await response.json() as { ok: boolean; stats: { processed: number; created: number } };
      expect(data.ok).toBe(true);
      expect(data.stats).toEqual({ processed: 0, created: 0 });
    });

    it('should return error on failed run', async () => {
      // Mock failed RSS fetch
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const request = new Request('http://example.com/health');
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(500);
      const data = await response.json() as { ok: boolean; error: string };
      expect(data.ok).toBe(false);
      expect(data.error).toContain('Network error');
    });

    it('should return default response for non-health endpoints', async () => {
      const request = new Request('http://example.com/');
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe('knue-event-harvester');
    });
  });

  describe('Full processing workflow', () => {
    it('should process new RSS items successfully', async () => {
      const mockItem: RssItem = {
        id: '123',
        title: 'Test Event',
        link: 'http://example.com/123',
        pubDate: '2025-10-15',
        descriptionHtml: '<p>Test description</p>',
        attachment: {
          filename: 'document.pdf',
          url: 'http://download.example.com/doc.pdf',
          preview: 'http://preview.example.com/123',
        },
      };

      const mockEvent = { id: 'event-123', summary: 'Test Event' };

      // Setup mocks for successful processing
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<rss><item>test</item></rss>'),
      });
      (parseRss as any).mockReturnValue([mockItem]);
      (obtainAccessToken as any).mockResolvedValue('test-token');
      (listEvents as any).mockResolvedValue([]);
      (getProcessedRecord as any).mockResolvedValue(null);
      (htmlToText as any).mockReturnValue('Test description');
      (resolveAttachmentText as any).mockReturnValue('첨부 파일: document.pdf');
      (getFileType as any).mockReturnValue('pdf');
      (fetchPreviewContent as any).mockResolvedValue({ sourceType: 'text', text: 'Preview text' });
      (generateSummary as any).mockResolvedValue({
        summary: 'AI Summary',
        highlights: ['Point 1'],
        actionItems: [],
        links: [],
      });
      (generateEventInfos as any).mockResolvedValue([{
        title: 'Test Event',
        description: 'Test description',
        startDate: '2023-01-01',
        endDate: '2023-01-01',
        startTime: undefined,
        endTime: undefined,
      }]);
      (computeHash as any).mockResolvedValue('test-hash');
      (isDuplicate as any).mockResolvedValue(false);
      (createEvent as any).mockResolvedValue(mockEvent);
      (putProcessedRecord as any).mockResolvedValue(undefined);

      const request = new Request('http://example.com/health');
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      const data = await response.json() as { ok: boolean; stats: { processed: number; created: number } };
      expect(data.ok).toBe(true);
      expect(data.stats).toEqual({ processed: 1, created: 1 });

      // Verify key function calls
      expect(parseRss).toHaveBeenCalled();
      expect(obtainAccessToken).toHaveBeenCalledWith(mockEnv);
      expect(createEvent).toHaveBeenCalled();
      expect(putProcessedRecord).toHaveBeenCalledWith(mockEnv, '123', expect.objectContaining({
        nttNo: '123',
        hash: 'test-hash',
      }));
    });

    it('should skip already processed items', async () => {
      const mockItem: RssItem = {
        id: '123',
        title: 'Test Event',
        link: 'http://example.com/123',
        pubDate: '2025-10-15',
        descriptionHtml: '<p>Test description</p>',
      };

      const existingRecord: ProcessedRecord = {
        eventId: 'existing-event',
        nttNo: '123',
        processedAt: '2023-01-01T00:00:00Z',
        hash: 'existing-hash',
      };

      // Setup mocks
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<rss><item>test</item></rss>'),
      });
      (parseRss as any).mockReturnValue([mockItem]);
      (obtainAccessToken as any).mockResolvedValue('test-token');
      (listEvents as any).mockResolvedValue([]);
      (getProcessedRecord as any).mockResolvedValue(existingRecord);

      const request = new Request('http://example.com/health');
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      const data = await response.json() as { ok: boolean; stats: { processed: number; created: number } };
      expect(data.ok).toBe(true);
      expect(data.stats).toEqual({ processed: 1, created: 0 });

      // Should not call processing functions
      expect(createEvent).not.toHaveBeenCalled();
    });

    it('should handle duplicate detection', async () => {
      const mockItem: RssItem = {
        id: '123',
        title: 'Test Event',
        link: 'http://example.com/123',
        pubDate: '2025-10-15',
        descriptionHtml: '<p>Test description</p>',
      };

      // Setup mocks for duplicate detection
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<rss><item>test</item></rss>'),
      });
      (parseRss as any).mockReturnValue([mockItem]);
      (obtainAccessToken as any).mockResolvedValue('test-token');
      (listEvents as any).mockResolvedValue([]);
      (getProcessedRecord as any).mockResolvedValue(null);
      (htmlToText as any).mockReturnValue('Test description');
      (resolveAttachmentText as any).mockReturnValue('');
      (generateSummary as any).mockResolvedValue({
        summary: 'AI Summary',
        highlights: [],
        actionItems: [],
        links: [],
      });
      (generateEventInfos as any).mockResolvedValue([{
        title: 'Test Event',
        description: 'Test description',
        startDate: '2023-01-01',
        endDate: '2023-01-01',
        startTime: undefined,
        endTime: undefined,
      }]);
      (computeHash as any).mockResolvedValue('test-hash');
      (isDuplicate as any).mockResolvedValue(true); // Duplicate detected
      (putProcessedRecord as any).mockResolvedValue(undefined);

      const request = new Request('http://example.com/health');
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      const data = await response.json() as { ok: boolean; stats: { processed: number; created: number } };
      expect(data.ok).toBe(true);
      expect(data.stats).toEqual({ processed: 1, created: 0 });

      // Should store duplicate record but not create event
      expect(createEvent).not.toHaveBeenCalled();
      expect(putProcessedRecord).toHaveBeenCalledWith(mockEnv, '123', expect.objectContaining({
        eventId: 'duplicate-skip',
      }));
    });

    it('should handle processing errors gracefully', async () => {
      const mockItem: RssItem = {
        id: '123',
        title: 'Test Event',
        link: 'http://example.com/123',
        pubDate: '2025-10-15',
        descriptionHtml: '<p>Test description</p>',
      };

      // Setup mocks with error in processing
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<rss><item>test</item></rss>'),
      });
      (parseRss as any).mockReturnValue([mockItem]);
      (obtainAccessToken as any).mockResolvedValue('test-token');
      (listEvents as any).mockResolvedValue([]);
      (getProcessedRecord as any).mockResolvedValue(null);
      (generateSummary as any).mockResolvedValue({
        summary: 'Test summary',
        highlights: [],
        actionItems: [],
        links: [],
      });
      (generateEventInfos as any).mockResolvedValue([{
        title: 'Test Event',
        description: 'Test description',
        startDate: '2025-10-15',
        endDate: '2025-10-15',
      }]);
      (htmlToText as any).mockImplementation(() => {
        throw new Error('HTML processing failed');
      });

      const request = new Request('http://example.com/health');
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      const data = await response.json() as { ok: boolean; stats: { processed: number; created: number } };
      expect(data.ok).toBe(true);
      expect(data.stats).toEqual({ processed: 0, created: 0 }); // Error prevents processing

      // Should attempt to check if already processed
      expect(getProcessedRecord).toHaveBeenCalled();
    });
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

  describe('Time-based duplicate detection', () => {
    it('should not create duplicate events for same-day events with different times', async () => {
      const mockItem: RssItem = {
        id: '123',
        title: 'School Opening Day',
        link: 'http://example.com/123',
        pubDate: '2025-10-15',
        descriptionHtml: '<p>Two events: morning academic session and afternoon gala</p>',
      };

      // Mock existing events in calendar (morning event)
      const existingCalendarEvent = {
        id: 'existing-morning',
        summary: 'Academic Session',
        description: '09:00-11:00',
        start: { dateTime: '2025-10-22T09:00:00+09:00' },
        end: { dateTime: '2025-10-22T11:00:00+09:00' },
        extendedProperties: { private: { nttNo: 'other-123' } },
      };

      // Setup mocks
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<rss><item>test</item></rss>'),
      });
      (parseRss as any).mockReturnValue([mockItem]);
      (obtainAccessToken as any).mockResolvedValue('test-token');
      (listEvents as any).mockResolvedValue([existingCalendarEvent]);
      (getProcessedRecord as any).mockResolvedValue(null);
      (htmlToText as any).mockReturnValue('Two events: morning and afternoon');
      (resolveAttachmentText as any).mockReturnValue('');
      (generateSummary as any).mockResolvedValue({
        summary: 'School Opening Day',
        highlights: [],
        actionItems: [],
        links: [],
      });
      // AI extracts 2 events: morning and afternoon
      (generateEventInfos as any).mockResolvedValue([
        {
          title: 'Academic Session',
          description: 'Morning session',
          startDate: '2025-10-22',
          endDate: '2025-10-22',
          startTime: '09:00',
          endTime: '11:00',
        },
        {
          title: 'Gala Ceremony',
          description: 'Afternoon gala',
          startDate: '2025-10-22',
          endDate: '2025-10-22',
          startTime: '14:00',
          endTime: '15:00',
        },
      ]);
      (computeHash as any).mockResolvedValue('test-hash');
      // isDuplicate should be called twice (once for each event)
      // First call: morning → returns true (exact match with existing)
      // Second call: afternoon → returns false (different time, not a duplicate)
      (isDuplicate as any)
        .mockResolvedValueOnce(true) // Morning duplicate
        .mockResolvedValueOnce(false); // Afternoon unique
      (createEvent as any).mockResolvedValue({ id: 'event-afternoon' });
      (putProcessedRecord as any).mockResolvedValue(undefined);

      const request = new Request('http://example.com/health');
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      const data = await response.json() as { ok: boolean; stats: { processed: number; created: number } };
      expect(data.ok).toBe(true);
      expect(data.stats.created).toBe(1); // Only afternoon event created

      // Verify isDuplicate was called twice with correct inputs
      expect(isDuplicate).toHaveBeenCalledTimes(2);
    });

    it('should handle maxResults 50+ pagination correctly', async () => {
      const mockItem: RssItem = {
        id: '123',
        title: 'Test Event',
        link: 'http://example.com/123',
        pubDate: '2025-10-15',
        descriptionHtml: '<p>Test</p>',
      };

      // Mock 60+ existing events to exceed maxResults=50
      const existingEvents = Array.from({ length: 60 }, (_, i) => ({
        id: `existing-${i}`,
        summary: `Event ${i}`,
        description: '',
        start: { dateTime: `2025-10-${String((i % 28) + 1).padStart(2, '0')}T${String((i % 24)).padStart(2, '0')}:00:00+09:00` },
        end: { dateTime: `2025-10-${String((i % 28) + 1).padStart(2, '0')}T${String((i % 24) + 1).padStart(2, '0')}:00:00+09:00` },
        extendedProperties: { private: { nttNo: `old-${i}` } },
      }));

      // Setup mocks
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<rss><item>test</item></rss>'),
      });
      (parseRss as any).mockReturnValue([mockItem]);
      (obtainAccessToken as any).mockResolvedValue('test-token');
      (listEvents as any).mockResolvedValue(existingEvents); // Return all 60
      (getProcessedRecord as any).mockResolvedValue(null);
      (htmlToText as any).mockReturnValue('Test description');
      (resolveAttachmentText as any).mockReturnValue('');
      (generateSummary as any).mockResolvedValue({
        summary: 'Test Event',
        highlights: [],
        actionItems: [],
        links: [],
      });
      (generateEventInfos as any).mockResolvedValue([{
        title: 'Test Event',
        description: 'Test',
        startDate: '2025-10-15',
        endDate: '2025-10-15',
        startTime: '15:00',
        endTime: '16:00',
      }]);
      (computeHash as any).mockResolvedValue('test-hash');
      (isDuplicate as any).mockResolvedValue(false);
      (createEvent as any).mockResolvedValue({ id: 'event-123' });
      (putProcessedRecord as any).mockResolvedValue(undefined);

      const request = new Request('http://example.com/health');
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      const data = await response.json() as { ok: boolean; stats: { processed: number; created: number } };
      expect(data.ok).toBe(true);
      expect(data.stats.created).toBe(1);

      // Verify listEvents was called and returned all 60 events for deduplication
      expect(listEvents).toHaveBeenCalled();
      expect(isDuplicate).toHaveBeenCalledWith(existingEvents, expect.any(Object), expect.any(Object));
    });

    it('should extract and handle multiple events from single RSS item correctly', async () => {
      const mockItem: RssItem = {
        id: '456',
        title: 'Multi-Event Day',
        link: 'http://example.com/456',
        pubDate: '2025-10-15',
        descriptionHtml: '<p>Three simultaneous events planned for opening day</p>',
      };

      // Setup mocks
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<rss><item>test</item></rss>'),
      });
      (parseRss as any).mockReturnValue([mockItem]);
      (obtainAccessToken as any).mockResolvedValue('test-token');
      (listEvents as any).mockResolvedValue([]);
      (getProcessedRecord as any).mockResolvedValue(null);
      (htmlToText as any).mockReturnValue('Three events planned');
      (resolveAttachmentText as any).mockReturnValue('');
      (generateSummary as any).mockResolvedValue({
        summary: 'Multi-Event Day',
        highlights: [],
        actionItems: [],
        links: [],
      });
      // AI extracts 3 events from single RSS item
      (generateEventInfos as any).mockResolvedValue([
        {
          title: 'Opening Ceremony',
          description: 'Main event',
          startDate: '2025-10-22',
          endDate: '2025-10-22',
          startTime: '09:00',
          endTime: '10:00',
        },
        {
          title: 'Academic Forum',
          description: 'Research presentations',
          startDate: '2025-10-22',
          endDate: '2025-10-22',
          startTime: '10:30',
          endTime: '12:00',
        },
        {
          title: 'Lunch Reception',
          description: 'Network lunch',
          startDate: '2025-10-22',
          endDate: '2025-10-22',
          startTime: '12:00',
          endTime: '13:00',
        },
      ]);
      (computeHash as any).mockResolvedValue('test-hash');
      (isDuplicate as any).mockResolvedValue(false); // None are duplicates
      (createEvent as any)
        .mockResolvedValueOnce({ id: 'event-1' })
        .mockResolvedValueOnce({ id: 'event-2' })
        .mockResolvedValueOnce({ id: 'event-3' });
      (putProcessedRecord as any).mockResolvedValue(undefined);

      const request = new Request('http://example.com/health');
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      const data = await response.json() as { ok: boolean; stats: { processed: number; created: number } };
      expect(data.ok).toBe(true);
      expect(data.stats.processed).toBe(1); // 1 RSS item
      expect(data.stats.created).toBe(3); // 3 calendar events

      // Verify createEvent was called 3 times
      expect(createEvent).toHaveBeenCalledTimes(3);
      // Verify putProcessedRecord was called with nttNo from RSS item
      expect(putProcessedRecord).toHaveBeenCalledWith(mockEnv, '456', expect.any(Object));
    });
  });
});
