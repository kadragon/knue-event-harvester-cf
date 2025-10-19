import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractTextFromImage, generateSummary, type AiEnv } from '../src/lib/ai';
import type { PreviewContent } from '../src/types';

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('AI Module', () => {
  let mockEnv: AiEnv;

  beforeEach(() => {
    mockEnv = {
      OPENAI_API_KEY: 'test-api-key',
      OPENAI_CONTENT_MODEL: 'gpt-4',
      OPENAI_VISION_MODEL: 'gpt-4-vision-preview',
    };

    vi.clearAllMocks();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateSummary', () => {
    it('should generate summary successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: '공지사항 요약',
              highlights: ['중요 포인트 1', '중요 포인트 2'],
              actionItems: ['행동 항목 1'],
              links: ['http://example.com'],
            }),
          },
        }],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await generateSummary(mockEnv, {
        title: '테스트 공지',
        description: '공지 내용',
        previewText: '미리보기 텍스트',
        attachmentText: '첨부 텍스트',
        link: 'http://example.com',
        pubDate: '2023-01-01',
      });

      expect(result).toEqual({
        summary: '공지사항 요약',
        highlights: ['중요 포인트 1', '중요 포인트 2'],
        actionItems: ['행동 항목 1'],
        links: ['http://example.com'],
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[0]).toBe('https://api.openai.com/v1/chat/completions');
      expect(callArgs[1].headers.Authorization).toBe('Bearer test-api-key');
    });

    it('should use Cloudflare AI Gateway when configured', async () => {
      const gatewayEnv = {
        ...mockEnv,
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
        CLOUDFLARE_AI_GATEWAY_NAME: 'test-gateway',
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: '게이트웨이 요약',
                highlights: [],
                actionItems: [],
                links: [],
              }),
            },
          }],
        }),
      });

      await generateSummary(gatewayEnv, {
        title: '테스트',
        description: '내용',
        link: 'http://example.com',
        pubDate: '2023-01-01',
      });

      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[0]).toBe('https://gateway.ai.cloudflare.com/v1/account/test-account/ai-gateway/test-gateway/openai/chat/completions');
    });

    it('should return fallback on API error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const result = await generateSummary(mockEnv, {
        title: '테스트',
        description: '내용',
        link: 'http://example.com',
        pubDate: '2023-01-01',
      });

      expect(result).toEqual({
        summary: '요약 정보를 생성하지 못했습니다.',
        highlights: [],
        actionItems: [],
        links: [],
      });
    });

    it('should handle malformed JSON response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: 'invalid json',
            },
          }],
        }),
      });

      const result = await generateSummary(mockEnv, {
        title: '테스트',
        description: '내용',
        link: 'http://example.com',
        pubDate: '2023-01-01',
      });

      expect(result).toEqual({
        summary: '요약 정보를 생성하지 못했습니다.',
        highlights: [],
        actionItems: [],
        links: [],
      });
    });

    it('should handle partial JSON response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: '요약',
                highlights: 'not an array', // Invalid type
                actionItems: ['valid item'],
              }),
            },
          }],
        }),
      });

      const result = await generateSummary(mockEnv, {
        title: '테스트',
        description: '내용',
        link: 'http://example.com',
        pubDate: '2023-01-01',
      });

      expect(result).toEqual({
        summary: '요약',
        highlights: [], // Should be sanitized to empty array
        actionItems: ['valid item'],
        links: [], // Should default to empty array
      });
    });
  });

  describe('extractTextFromImage', () => {
    it('should extract text from image successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              extractedText: '추출된 텍스트',
            }),
          },
        }],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const preview: PreviewContent = {
        sourceType: 'image',
        imageBase64: 'base64-image-data',
        contentType: 'image/png',
      };

      const result = await extractTextFromImage(mockEnv, preview);

      expect(result).toBe('추출된 텍스트');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.model).toBe('gpt-4-vision-preview'); // Should use vision model
      expect(body.messages[1].content[1].image_url.url).toContain('data:image/png;base64,base64-image-data');
    });

    it('should use content model when vision model not specified', async () => {
      const envWithoutVision = {
        OPENAI_API_KEY: 'test-key',
        OPENAI_CONTENT_MODEL: 'gpt-4',
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({ extractedText: 'text' }),
            },
          }],
        }),
      });

      const preview: PreviewContent = {
        sourceType: 'image',
        imageBase64: 'data',
      };

      await extractTextFromImage(envWithoutVision, preview);

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.model).toBe('gpt-4'); // Should fallback to content model
    });

    it('should return undefined for non-image content', async () => {
      const preview: PreviewContent = {
        sourceType: 'text',
        text: 'some text',
      };

      const result = await extractTextFromImage(mockEnv, preview);
      expect(result).toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should return undefined for image without base64 data', async () => {
      const preview: PreviewContent = {
        sourceType: 'image',
        // No imageBase64
      };

      const result = await extractTextFromImage(mockEnv, preview);
      expect(result).toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should return undefined on API error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limited'),
      });

      const preview: PreviewContent = {
        sourceType: 'image',
        imageBase64: 'data',
      };

      const result = await extractTextFromImage(mockEnv, preview);
      expect(result).toBeUndefined();
    });

    it('should handle malformed OCR JSON response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: 'not json',
            },
          }],
        }),
      });

      const preview: PreviewContent = {
        sourceType: 'image',
        imageBase64: 'data',
      };

      const result = await extractTextFromImage(mockEnv, preview);
      expect(result).toBeUndefined();
    });

    it('should handle OCR response without extractedText', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({ otherField: 'value' }),
            },
          }],
        }),
      });

      const preview: PreviewContent = {
        sourceType: 'image',
        imageBase64: 'data',
      };

      const result = await extractTextFromImage(mockEnv, preview);
      expect(result).toBeUndefined();
    });
  });
});
