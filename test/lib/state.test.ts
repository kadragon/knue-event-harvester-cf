import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getProcessedRecord, putProcessedRecord, getMaxProcessedId, updateMaxProcessedId, type StateEnv } from '../../src/lib/state';
import type { ProcessedRecord } from '../../src/types';

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

  describe('getMaxProcessedId', () => {
    it('should return stored max ID', async () => {
      mockKV.get.mockResolvedValue('5000');

      const result = await getMaxProcessedId(mockEnv);

      expect(result).toBe(5000);
      expect(mockKV.get).toHaveBeenCalledWith('_max_processed_id', 'text');
    });

    it('should return 0 when no max ID is stored', async () => {
      mockKV.get.mockResolvedValue(null);

      const result = await getMaxProcessedId(mockEnv);

      expect(result).toBe(0);
      expect(mockKV.get).toHaveBeenCalledWith('_max_processed_id', 'text');
    });

    it('should return 0 when max ID is undefined', async () => {
      mockKV.get.mockResolvedValue(undefined);

      const result = await getMaxProcessedId(mockEnv);

      expect(result).toBe(0);
    });

    it('should parse large ID values correctly', async () => {
      mockKV.get.mockResolvedValue('999999999');

      const result = await getMaxProcessedId(mockEnv);

      expect(result).toBe(999999999);
    });

    it('should return 0 when stored value is not a number', async () => {
      mockKV.get.mockResolvedValue('not-a-number');

      const result = await getMaxProcessedId(mockEnv);

      expect(result).toBe(0);
    });
  });

  describe('updateMaxProcessedId', () => {
    it('should update max ID when new ID is larger', async () => {
      mockKV.get.mockResolvedValue('5000');
      mockKV.put.mockResolvedValue(undefined);

      await updateMaxProcessedId(mockEnv, '5100');

      expect(mockKV.put).toHaveBeenCalledWith('_max_processed_id', '5100');
    });

    it('should not update when new ID is smaller than current max', async () => {
      mockKV.get.mockResolvedValue('5000');
      mockKV.put.mockResolvedValue(undefined);

      await updateMaxProcessedId(mockEnv, '4999');

      expect(mockKV.put).not.toHaveBeenCalled();
    });

    it('should update when current max is 0 (first time)', async () => {
      mockKV.get.mockResolvedValue(null);
      mockKV.put.mockResolvedValue(undefined);

      await updateMaxProcessedId(mockEnv, '100');

      expect(mockKV.put).toHaveBeenCalledWith('_max_processed_id', '100');
    });

    it('should handle equal IDs correctly (not update)', async () => {
      mockKV.get.mockResolvedValue('5000');
      mockKV.put.mockResolvedValue(undefined);

      await updateMaxProcessedId(mockEnv, '5000');

      expect(mockKV.put).not.toHaveBeenCalled();
    });

    it('should update max ID for large values', async () => {
      mockKV.get.mockResolvedValue('999999998');
      mockKV.put.mockResolvedValue(undefined);

      await updateMaxProcessedId(mockEnv, '999999999');

      expect(mockKV.put).toHaveBeenCalledWith('_max_processed_id', '999999999');
    });

    it('should not update and not throw when new ID is not a number', async () => {
      mockKV.get.mockResolvedValue('5000');
      mockKV.put.mockResolvedValue(undefined);

      await updateMaxProcessedId(mockEnv, 'not-a-number');

      expect(mockKV.put).not.toHaveBeenCalled();
    });
  });
});
