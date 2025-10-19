import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  obtainAccessToken,
  listEvents,
  createEvent,
  type CalendarEnv,
  type GoogleCalendarEvent,
} from '../src/lib/calendar';
import type { CalendarEventInput, ProcessedRecord } from '../src/types';

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Mock crypto.subtle
const mockSign = vi.fn();
const mockImportKey = vi.fn();

Object.defineProperty(global.crypto, 'subtle', {
  value: {
    sign: mockSign,
    importKey: mockImportKey,
  },
  writable: true,
});

describe('Calendar Module', () => {
  let mockEnv: CalendarEnv;

  beforeEach(() => {
    mockEnv = {
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
        client_email: 'test@example.com',
        private_key: '-----BEGIN PRIVATE KEY-----\ndGVzdC1rZXk=\n-----END PRIVATE KEY-----',
      }),
      GOOGLE_CALENDAR_ID: 'test-calendar-id',
    };

    // Reset mocks
    vi.clearAllMocks();
    fetchMock.mockReset();
    mockSign.mockReset();
    mockImportKey.mockReset();

    // Default mock implementations
    mockImportKey.mockResolvedValue('mock-crypto-key');
    mockSign.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });



  describe('obtainAccessToken', () => {
    it('should obtain access token successfully', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      const token = await obtainAccessToken(mockEnv);
      expect(token).toBe('test-token');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should throw error on API failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      });

      await expect(obtainAccessToken(mockEnv)).rejects.toThrow('Google OAuth error: 400');
    });
  });

  describe('listEvents', () => {
    it('should list events successfully', async () => {
      const mockEvents: GoogleCalendarEvent[] = [
        { id: 'event1', summary: 'Test Event' },
      ];

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: mockEvents }),
      });

      const events = await listEvents(mockEnv, 'test-token', {
        timeMin: '2023-01-01T00:00:00Z',
        timeMax: '2023-12-31T23:59:59Z',
      });

      expect(events).toEqual(mockEvents);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no events', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const events = await listEvents(mockEnv, 'test-token', {
        timeMin: '2023-01-01T00:00:00Z',
        timeMax: '2023-12-31T23:59:59Z',
      });

      expect(events).toEqual([]);
    });

    it('should throw error on API failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      });

      await expect(listEvents(mockEnv, 'test-token', {
        timeMin: '2023-01-01T00:00:00Z',
        timeMax: '2023-12-31T23:59:59Z',
      })).rejects.toThrow('Google Calendar list error 403');
    });
  });

  describe('createEvent', () => {
    it('should create event successfully', async () => {
      const mockEvent: GoogleCalendarEvent = {
        id: 'new-event-id',
        summary: 'Test Event',
        description: 'Test Description',
        start: { date: '2023-01-01' },
        end: { date: '2023-01-02' },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvent),
      });

      const input: CalendarEventInput = {
        title: 'Test Event',
        description: 'Test Description',
        startDate: '2023-01-01',
        endDate: '2023-01-01',
      };

      const meta: ProcessedRecord = {
        eventId: 'test-event-id',
        nttNo: '123',
        processedAt: '2023-01-01T00:00:00Z',
        hash: 'test-hash',
      };

      const result = await createEvent(mockEnv, 'test-token', input, meta);

      expect(result).toEqual(mockEvent);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.summary).toBe('Test Event');
      expect(body.description).toBe('Test Description');
      expect(body.start.date).toBe('2023-01-01');
      expect(body.end.date).toBe('2023-01-02'); // endDate + 1 day
      expect(body.extendedProperties.private.nttNo).toBe('123');
      expect(body.extendedProperties.private.hash).toBe('test-hash');
    });

    it('should include description extras', async () => {
      const mockEvent: GoogleCalendarEvent = { id: 'new-event-id' };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvent),
      });

      const input: CalendarEventInput = {
        title: 'Test Event',
        description: 'Test Description',
        startDate: '2023-01-01',
        endDate: '2023-01-01',
      };

      const meta: ProcessedRecord = {
        eventId: 'test-event-id',
        nttNo: '123',
        processedAt: '2023-01-01T00:00:00Z',
        hash: 'test-hash',
      };

      await createEvent(mockEnv, 'test-token', input, meta, { extraField: 'extraValue' });

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.extendedProperties.private.extraField).toBe('extraValue');
    });

    it('should throw error on API failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: () => Promise.resolve('Conflict'),
      });

      const input: CalendarEventInput = {
        title: 'Test Event',
        description: 'Test Description',
        startDate: '2023-01-01',
        endDate: '2023-01-01',
      };

      const meta: ProcessedRecord = {
        eventId: 'test-event-id',
        nttNo: '123',
        processedAt: '2023-01-01T00:00:00Z',
        hash: 'test-hash',
      };

      await expect(createEvent(mockEnv, 'test-token', input, meta))
        .rejects.toThrow('Google Calendar create error 409');
    });
  });
});
