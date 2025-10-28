// GENERATED FROM SPEC-TELEGRAM-NOTIFICATION-001

import { TelegramNotificationPayload } from '../types';

interface Env {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_USER_ID?: string;
}

/**
 * Send Telegram notification when a new calendar event is created
 *
 * Trace: SPEC-TELEGRAM-NOTIFICATION-001
 * - AC-1: Send message with event details
 * - AC-2: Handle missing env vars gracefully
 * - AC-3: Handle API errors without blocking caller
 * - AC-4: Format message with emoji and markdown
 */
export async function sendNotification(
  payload: TelegramNotificationPayload,
  env: Env
): Promise<void> {
  // AC-2: Validate environment variables
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const userId = env.TELEGRAM_USER_ID;

  if (!botToken) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN is not configured');
    return;
  }

  if (!userId) {
    console.warn('[Telegram] TELEGRAM_USER_ID is not configured');
    return;
  }

  try {
    // AC-1, AC-4: Format message with event details
    const message = formatMessage(payload);

    // Build Telegram Bot API URL
    const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    // Send message via Telegram Bot API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: userId,
        text: message,
        parse_mode: 'MarkdownV2',
      }),
    });

    // AC-3: Handle API errors silently
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Telegram] Failed to send message: ${response.status} - ${errorText}`
      );
      return;
    }

    console.log('[Telegram] Notification sent successfully');
  } catch (error) {
    // AC-3: Log network errors and continue
    console.error('[Telegram] Error sending notification:', error);
    return;
  }
}

/**
 * Format notification message with emoji and markdown
 * AC-4: Include event title, RSS link, and calendar link
 */
function formatMessage(payload: TelegramNotificationPayload): string {
  const { eventTitle, rssUrl, eventUrl } = payload;

  const lines: string[] = [
    '🎉 *새로운 캘린더 이벤트가 생성되었습니다*',
    '',
  ];

  // Add title if present
  if (eventTitle) {
    lines.push(`📝 *제목:* ${escapeMarkdown(eventTitle)}`);
    lines.push('');
  }

  // Add RSS link
  lines.push(`🔗 *원문 링크:*`);
  lines.push(`[${escapeMarkdown(extractDomain(rssUrl))}](${rssUrl})`);
  lines.push('');

  // Add calendar link
  lines.push(`📅 *캘린더 링크:*`);
  lines.push(`[Google Calendar](${eventUrl})`);

  return lines.join('\n');
}

/**
 * Escape special markdown characters for MarkdownV2
 * Uses single regex for better performance
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\].()~`>#+\-=|{}.!]/g, '\\$&');
}

/**
 * Extract domain from URL for display
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}
