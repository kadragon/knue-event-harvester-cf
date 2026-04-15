import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  openDatabase,
  getProcessedRecord,
  putProcessedRecord,
  getMaxProcessedId,
  updateMaxProcessedId,
  type StateEnv,
} from '../../src/lib/state.js';
import type { ProcessedRecord } from '../../src/types.js';

describe('State Module', () => {
  let db: Database.Database;
  let env: StateEnv;

  beforeEach(() => {
    // Each test gets a fresh in-memory database
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS processed_items (
        ntt_no       TEXT PRIMARY KEY,
        event_id     TEXT NOT NULL,
        processed_at TEXT NOT NULL,
        hash         TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    env = { db };
  });

  afterEach(() => {
    db.close();
  });

  describe('openDatabase', () => {
    it('should create tables and return a Database instance', () => {
      const tmpDb = openDatabase(':memory:');
      try {
        const tables = tmpDb
          .prepare("SELECT name FROM sqlite_master WHERE type='table'")
          .all() as Array<{ name: string }>;
        const names = tables.map((r) => r.name);
        expect(names).toContain('processed_items');
        expect(names).toContain('meta');
      } finally {
        tmpDb.close();
      }
    });
  });

  describe('getProcessedRecord', () => {
    it('should return processed record when found', async () => {
      const record: ProcessedRecord = {
        eventId: 'test-event',
        nttNo: '123',
        processedAt: '2023-01-01T00:00:00Z',
        hash: 'test-hash',
      };
      db.prepare(
        'INSERT INTO processed_items (ntt_no, event_id, processed_at, hash) VALUES (?, ?, ?, ?)'
      ).run('123', record.eventId, record.processedAt, record.hash);

      const result = await getProcessedRecord(env, '123');

      expect(result).toEqual(record);
    });

    it('should return null when key not found', async () => {
      const result = await getProcessedRecord(env, 'nonexistent-id');
      expect(result).toBeNull();
    });
  });

  describe('putProcessedRecord', () => {
    it('should store processed record successfully', async () => {
      const record: ProcessedRecord = {
        eventId: 'test-event',
        nttNo: '123',
        processedAt: '2023-01-01T00:00:00Z',
        hash: 'test-hash',
      };

      await putProcessedRecord(env, '123', record);

      const result = await getProcessedRecord(env, '123');
      expect(result).toEqual(record);
    });

    it('should overwrite existing record (upsert)', async () => {
      const original: ProcessedRecord = {
        eventId: 'original-event',
        nttNo: '456',
        processedAt: '2023-01-01T00:00:00Z',
        hash: 'original-hash',
      };
      const updated: ProcessedRecord = {
        eventId: 'updated-event',
        nttNo: '456',
        processedAt: '2023-06-15T12:00:00Z',
        hash: 'updated-hash',
      };

      await putProcessedRecord(env, '456', original);
      await putProcessedRecord(env, '456', updated);

      const result = await getProcessedRecord(env, '456');
      expect(result).toEqual(updated);
    });
  });

  describe('round-trip operations', () => {
    it('should store and retrieve record correctly', async () => {
      const record: ProcessedRecord = {
        eventId: 'round-trip-event',
        nttNo: '789',
        processedAt: '2023-06-15T12:30:45Z',
        hash: 'round-trip-hash',
      };

      await putProcessedRecord(env, '789', record);
      const retrieved = await getProcessedRecord(env, '789');
      expect(retrieved).toEqual(record);
    });
  });

  describe('getMaxProcessedId', () => {
    it('should return stored max ID', async () => {
      db.prepare("INSERT INTO meta (key, value) VALUES ('_max_processed_id', '5000')").run();

      const result = await getMaxProcessedId(env);
      expect(result).toBe(5000);
    });

    it('should return 0 when no max ID is stored', async () => {
      const result = await getMaxProcessedId(env);
      expect(result).toBe(0);
    });

    it('should parse large ID values correctly', async () => {
      db.prepare("INSERT INTO meta (key, value) VALUES ('_max_processed_id', '999999999')").run();

      const result = await getMaxProcessedId(env);
      expect(result).toBe(999999999);
    });

    it('should return 0 when stored value is not a number', async () => {
      db.prepare("INSERT INTO meta (key, value) VALUES ('_max_processed_id', 'not-a-number')").run();

      const result = await getMaxProcessedId(env);
      expect(result).toBe(0);
    });
  });

  describe('updateMaxProcessedId', () => {
    it('should update max ID when new ID is larger', async () => {
      db.prepare("INSERT INTO meta (key, value) VALUES ('_max_processed_id', '5000')").run();

      await updateMaxProcessedId(env, '5100');

      const result = await getMaxProcessedId(env);
      expect(result).toBe(5100);
    });

    it('should not update when new ID is smaller than current max', async () => {
      db.prepare("INSERT INTO meta (key, value) VALUES ('_max_processed_id', '5000')").run();

      await updateMaxProcessedId(env, '4999');

      const result = await getMaxProcessedId(env);
      expect(result).toBe(5000);
    });

    it('should update when current max is 0 (first time)', async () => {
      await updateMaxProcessedId(env, '100');

      const result = await getMaxProcessedId(env);
      expect(result).toBe(100);
    });

    it('should not update when equal IDs are given', async () => {
      db.prepare("INSERT INTO meta (key, value) VALUES ('_max_processed_id', '5000')").run();

      await updateMaxProcessedId(env, '5000');

      const result = await getMaxProcessedId(env);
      expect(result).toBe(5000);
    });

    it('should update max ID for large values', async () => {
      db.prepare("INSERT INTO meta (key, value) VALUES ('_max_processed_id', '999999998')").run();

      await updateMaxProcessedId(env, '999999999');

      const result = await getMaxProcessedId(env);
      expect(result).toBe(999999999);
    });

    it('should not update and not throw when new ID is not a number', async () => {
      db.prepare("INSERT INTO meta (key, value) VALUES ('_max_processed_id', '5000')").run();

      await updateMaxProcessedId(env, 'not-a-number');

      const result = await getMaxProcessedId(env);
      expect(result).toBe(5000);
    });
  });
});
