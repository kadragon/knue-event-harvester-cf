import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getProcessedRecord, putProcessedRecord, type StateEnv } from '../src/lib/state';
import type { ProcessedRecord } from '../src/types';

// Mock KV namespace
const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
};

describe('State Module', () => {
  let mockEnv: StateEnv;

  beforeEach(() => {
    mockEnv = {
      PROCESSED_STORE: mockKV as any,
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getProcessedRecord', () => {
    it('should return processed record when found', async () => {
      const mockRecord: ProcessedRecord = {
        eventId: 'test-event',
        nttNo: '123',
        processedAt: '2023-01-01T00:00:00Z',
        hash: 'test-hash',
      };

      mockKV.get.mockResolvedValue(mockRecord);

      const result = await getProcessedRecord(mockEnv, 'test-id');

      expect(result).toEqual(mockRecord);
      expect(mockKV.get).toHaveBeenCalledWith('test-id', 'json');
    });

    it('should return null when key not found', async () => {
      mockKV.get.mockResolvedValue(null);

      const result = await getProcessedRecord(mockEnv, 'nonexistent-id');

      expect(result).toBeNull();
      expect(mockKV.get).toHaveBeenCalledWith('nonexistent-id', 'json');
    });

    it('should return null when KV returns undefined', async () => {
      mockKV.get.mockResolvedValue(undefined);

      const result = await getProcessedRecord(mockEnv, 'undefined-id');

      expect(result).toBeNull();
      expect(mockKV.get).toHaveBeenCalledWith('undefined-id', 'json');
    });
  });

  describe('putProcessedRecord', () => {
    it('should store processed record successfully', async () => {
      const mockRecord: ProcessedRecord = {
        eventId: 'test-event',
        nttNo: '123',
        processedAt: '2023-01-01T00:00:00Z',
        hash: 'test-hash',
      };

      mockKV.put.mockResolvedValue(undefined);

      await putProcessedRecord(mockEnv, 'test-id', mockRecord);

      expect(mockKV.put).toHaveBeenCalledWith('test-id', JSON.stringify(mockRecord));
    });

    it('should handle complex record data', async () => {
      const mockRecord: ProcessedRecord = {
        eventId: 'complex-event-id',
        nttNo: '456',
        processedAt: '2023-12-31T23:59:59Z',
        hash: 'complex-hash-with-special-chars',
      };

      mockKV.put.mockResolvedValue(undefined);

      await putProcessedRecord(mockEnv, 'complex-id', mockRecord);

      expect(mockKV.put).toHaveBeenCalledWith('complex-id', JSON.stringify(mockRecord));
    });
  });

  describe('round-trip operations', () => {
    it('should store and retrieve record correctly', async () => {
      const mockRecord: ProcessedRecord = {
        eventId: 'round-trip-event',
        nttNo: '789',
        processedAt: '2023-06-15T12:30:45Z',
        hash: 'round-trip-hash',
      };

      // Mock successful put
      mockKV.put.mockResolvedValue(undefined);

      // Store the record
      await putProcessedRecord(mockEnv, 'round-trip-id', mockRecord);

      // Mock successful get
      mockKV.get.mockResolvedValue(mockRecord);

      // Retrieve the record
      const retrieved = await getProcessedRecord(mockEnv, 'round-trip-id');

      expect(retrieved).toEqual(mockRecord);
      expect(mockKV.put).toHaveBeenCalledWith('round-trip-id', JSON.stringify(mockRecord));
      expect(mockKV.get).toHaveBeenCalledWith('round-trip-id', 'json');
    });
  });
});
