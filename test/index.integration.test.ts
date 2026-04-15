import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { run } from '../src/index.js';
import type { RssItem } from '../src/types.js';

// Mock all external dependencies
vi.mock('../src/lib/rss.js', () => ({
  parseRss: vi.fn(),
}));

vi.mock('../src/lib/ai.js', () => ({
  generateSummary: vi.fn(),
  generateEventInfos: vi.fn(),
  extractTextFromImage: vi.fn(),
}));

vi.mock('../src/lib/calendar.js', () => ({
  obtainAccessToken: vi.fn(),
  listEvents: vi.fn(),
  createEvent: vi.fn(),
}));

vi.mock('../src/lib/dedupe.js', () => ({
  isDuplicate: vi.fn(),
  computeHash: vi.fn(),
}));

vi.mock('../src/lib/state.js', () => ({
  getProcessedRecord: vi.fn(),
  putProcessedRecord: vi.fn(),
  getMaxProcessedId: vi.fn(),
  updateMaxProcessedId: vi.fn(),
  openDatabase: vi.fn(),
}));

// Import after mocking
import { parseRss } from '../src/lib/rss.js';
import { generateSummary, generateEventInfos } from '../src/lib/ai.js';
import { obtainAccessToken, listEvents } from '../src/lib/calendar.js';
import { getMaxProcessedId } from '../src/lib/state.js';

describe('Integration Tests', () => {
  let mockEnv: any;
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    mockEnv = {
      db,
      GOOGLE_SERVICE_ACCOUNT_JSON: '{}',
      GOOGLE_CALENDAR_ID: 'test-calendar',
      OLLAMA_HOST: 'http://127.0.0.1:11434',
      OLLAMA_CONTENT_MODEL: 'llama3.1:8b',
      SIMILARITY_THRESHOLD: '0.85',
      LOOKBACK_DAYS: '60',
    };

    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  describe('run()', () => {
    it('should process an empty RSS feed without errors', async () => {
      const mockItems: RssItem[] = [];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<rss><channel></channel></rss>'),
      });
      (parseRss as ReturnType<typeof vi.fn>).mockReturnValue(mockItems);
      (obtainAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue('test-token');
      (listEvents as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getMaxProcessedId as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const stats = await run(mockEnv);

      expect(stats).toEqual({ processed: 0, created: 0 });
    });

    it('should skip items already processed (below maxProcessedId)', async () => {
      const mockItems: RssItem[] = [
        {
          id: '100',
          title: 'Old item',
          link: 'https://example.com/100',
          pubDate: '2023-01-01',
          descriptionHtml: '<p>Old content</p>',
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<rss/>'),
      });
      (parseRss as ReturnType<typeof vi.fn>).mockReturnValue(mockItems);
      (obtainAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue('test-token');
      (listEvents as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      // maxProcessedId = 200 means item 100 is already processed
      (getMaxProcessedId as ReturnType<typeof vi.fn>).mockResolvedValue(200);

      const stats = await run(mockEnv);

      expect(stats.processed).toBe(1);
      expect(stats.created).toBe(0);
      expect(generateSummary).not.toHaveBeenCalled();
      expect(generateEventInfos).not.toHaveBeenCalled();
    });
  });
});
