import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendNotification } from '../../src/lib/telegram';
import { TelegramNotificationPayload } from '../../src/types';

// Trace: SPEC-TELEGRAM-NOTIFICATION-001, SPEC-TELEGRAM-IMPROVEMENTS-001

describe('telegram', () => {
  let mockFetch: any;
  let env: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    env = {
      TELEGRAM_BOT_TOKEN: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      TELEGRAM_USER_ID: '987654321',
    };
  });

  describe('sendNotification', () => {
    // AC-1: Successful notification
    it('AC-1: Should send Telegram message with event details when called with valid payload', async () => {
      const payload: TelegramNotificationPayload = {
        eventTitle: 'KNUE 개교기념일',
        rssUrl: 'https://knue.ac.kr/rssBbsNtt.do?nttNo=123',
        eventUrl: 'https://calendar.google.com/calendar/u/0/r/eventedit/abc123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      await sendNotification(payload, env);

      expect(mockFetch).toHaveBeenCalledOnce();
      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain('sendMessage');
      expect(call[0]).toContain('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');

      // Verify message body contains key information
      const body = JSON.parse(call[1].body);
      expect(body.chat_id).toBe('987654321');
      expect(body.text).toContain('KNUE 개교기념일');
      expect(body.text).toContain('https://knue.ac.kr/rssBbsNtt.do?nttNo=123');
      expect(body.text).toContain('https://calendar.google.com/calendar/u/0/r/eventedit/abc123');
    });

    // AC-2: Missing environment variables
    it('AC-2: Should log warning and return silently when TELEGRAM_BOT_TOKEN is missing', async () => {
      const payload: TelegramNotificationPayload = {
        eventTitle: 'Test Event',
        rssUrl: 'https://example.com/news/1',
        eventUrl: 'https://calendar.google.com/calendar/u/0/r/eventedit/abc123',
      };

      env.TELEGRAM_BOT_TOKEN = undefined;

      const consoleSpy = vi.spyOn(console, 'warn');

      await sendNotification(payload, env);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('TELEGRAM_BOT_TOKEN')
      );
      expect(mockFetch).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('AC-2: Should log warning and return silently when TELEGRAM_USER_ID is missing', async () => {
      const payload: TelegramNotificationPayload = {
        eventTitle: 'Test Event',
        rssUrl: 'https://example.com/news/1',
        eventUrl: 'https://calendar.google.com/calendar/u/0/r/eventedit/abc123',
      };

      env.TELEGRAM_USER_ID = undefined;

      const consoleSpy = vi.spyOn(console, 'warn');

      await sendNotification(payload, env);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('TELEGRAM_USER_ID')
      );
      expect(mockFetch).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    // AC-3: API failure handling
    it('AC-3: Should log error and return silently when Telegram API fails', async () => {
      const payload: TelegramNotificationPayload = {
        eventTitle: 'Test Event',
        rssUrl: 'https://example.com/news/1',
        eventUrl: 'https://calendar.google.com/calendar/u/0/r/eventedit/abc123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const consoleErrorSpy = vi.spyOn(console, 'error');

      await sendNotification(payload, env);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledOnce();

      consoleErrorSpy.mockRestore();
    });

    it('AC-3: Should log error and return silently when network request fails', async () => {
      const payload: TelegramNotificationPayload = {
        eventTitle: 'Test Event',
        rssUrl: 'https://example.com/news/1',
        eventUrl: 'https://calendar.google.com/calendar/u/0/r/eventedit/abc123',
      };

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const consoleErrorSpy = vi.spyOn(console, 'error');

      await sendNotification(payload, env);

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    // AC-4: Message format validation
    it('AC-4: Should format message with markdown and emoji', async () => {
      const payload: TelegramNotificationPayload = {
        eventTitle: 'KNUE 개교기념일',
        rssUrl: 'https://knue.ac.kr/rssBbsNtt.do?nttNo=123',
        eventUrl: 'https://calendar.google.com/calendar/u/0/r/eventedit/abc123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      await sendNotification(payload, env);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const message = body.text;

      // Check for emoji and markdown formatting
      expect(message).toMatch(/[🎉📝🔗📅]/); // Contains emoji
      expect(message).toContain('*'); // Contains markdown bold or list
    });

    it('AC-4: Should handle empty title gracefully', async () => {
      const payload: TelegramNotificationPayload = {
        eventTitle: '',
        rssUrl: 'https://knue.ac.kr/rssBbsNtt.do?nttNo=123',
        eventUrl: 'https://calendar.google.com/calendar/u/0/r/eventedit/abc123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      await sendNotification(payload, env);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toContain('https://knue.ac.kr/rssBbsNtt.do?nttNo=123');
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    // SPEC-TELEGRAM-IMPROVEMENTS-001 tests
    // AC-1: Link preview disabled
    it('IMPROVEMENTS-AC-1: Should disable web page preview in Telegram message', async () => {
      const payload: TelegramNotificationPayload = {
        eventTitle: 'Test Event',
        rssUrl: 'https://knue.ac.kr/rssBbsNtt.do?nttNo=123',
        eventUrl: 'https://calendar.google.com/calendar/u/0/r/event?eid=abc123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      await sendNotification(payload, env);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.disable_web_page_preview).toBe(true);
    });

    // AC-3: Link text should be [바로가기]
    it('IMPROVEMENTS-AC-3: Should format links with [바로가기] text instead of URL or domain', async () => {
      const payload: TelegramNotificationPayload = {
        eventTitle: 'Test Event',
        rssUrl: 'https://knue.ac.kr/rssBbsNtt.do?nttNo=123',
        eventUrl: 'https://calendar.google.com/calendar/u/0/r/event?eid=abc123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      await sendNotification(payload, env);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const message = body.text;

      // Should contain [바로가기] as link text
      expect(message).toContain('[바로가기]');
      // Should NOT contain domain name as link text
      expect(message).not.toContain('[knue\\.ac\\.kr]');
      expect(message).not.toContain('[Google Calendar]');
    });
  });
});
