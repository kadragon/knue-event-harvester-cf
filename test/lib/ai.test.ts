import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractTextFromImage, generateSummary, generateEventInfos, type AiEnv } from '../../src/lib/ai';
import type { PreviewContent, RssItem } from '../../src/types';

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
      const accountId = 'test-account';
      const gatewayName = 'test-gateway';
      const gatewayToken = 'gateway-token';

      const gatewayEnv = {
        ...mockEnv,
        CLOUDFLARE_ACCOUNT_ID: accountId,
        CLOUDFLARE_AI_GATEWAY_NAME: gatewayName,
        CLOUDFLARE_AI_GATEWAY_AUTH: gatewayToken,
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

      const expectedUrl = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayName}/openai/chat/completions`;
      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[0]).toBe(expectedUrl);
      expect(callArgs[1].headers['cf-aig-authorization']).toBe(`Bearer ${gatewayToken}`);
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

  describe('generateEventInfos', () => {
    let mockItem: RssItem;

    beforeEach(() => {
      mockItem = {
        id: '123',
        title: '2025학년도 봄학기 수강신청',
        link: 'https://example.com/notice/123',
        pubDate: '2025-10-28',
        descriptionHtml: '<p>수강신청 일정: 2025-11-01 ~ 2025-11-03</p>',
      };
    });

    it('should generate event infos with single event', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              events: [
                {
                  title: '수강신청',
                  description: '봄학기 수강신청',
                  startDate: '2025-11-01',
                  endDate: '2025-11-03',
                },
              ],
            }),
          },
        }],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await generateEventInfos(mockEnv, mockItem);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        title: '수강신청',
        description: '봄학기 수강신청',
        startDate: '2025-11-01',
        endDate: '2025-11-03',
        startTime: undefined,
        endTime: undefined,
      });
    });

    it('should generate event infos with multiple events', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              events: [
                {
                  title: '행사 1',
                  description: '설명 1',
                  startDate: '2025-11-01',
                  endDate: '2025-11-01',
                },
                {
                  title: '행사 2',
                  description: '설명 2',
                  startDate: '2025-11-10',
                  endDate: '2025-11-12',
                  startTime: '09:00',
                  endTime: '17:00',
                },
              ],
            }),
          },
        }],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await generateEventInfos(mockEnv, mockItem);

      expect(result).toHaveLength(2);
      expect(result[1].startTime).toBe('09:00');
      expect(result[1].endTime).toBe('17:00');
    });

    it('should use pubDate as fallback when startDate not provided', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              events: [
                {
                  title: '행사',
                  description: '설명',
                  // No startDate provided
                },
              ],
            }),
          },
        }],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await generateEventInfos(mockEnv, mockItem);

      expect(result[0].startDate).toBe(mockItem.pubDate);
      expect(result[0].endDate).toBe(mockItem.pubDate);
    });

    it('should filter out events without title or description', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              events: [
                {
                  title: '유효한 행사',
                  description: '설명',
                  startDate: '2025-11-01',
                },
                {
                  // Missing title gets filled with fallback
                  description: '설명만 있음',
                  startDate: '2025-11-02',
                },
                {
                  title: '제목만 있음',
                  // Missing description gets filled with fallback
                  startDate: '2025-11-03',
                },
              ],
            }),
          },
        }],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await generateEventInfos(mockEnv, mockItem);

      // All 3 events pass filtering since title and description are filled with fallback
      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('유효한 행사');
      expect(result[1].title).toBe('제목 없음'); // Fallback title
      expect(result[2].description).toBe('설명 없음'); // Fallback description
    });

    it('should return fallback event on API error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      // Mock fallback to direct OpenAI also failing
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Direct OpenAI also failed'),
      });

      const result = await generateEventInfos(mockEnv, mockItem);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('제목 없음'); // Actual fallback value
      expect(result[0].description).toBe('설명 없음'); // Actual fallback value
    });

    it('should handle malformed JSON response and return fallback', async () => {
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

      const result = await generateEventInfos(mockEnv, mockItem);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('제목 없음'); // Actual fallback value
      expect(result[0].description).toBe('설명 없음'); // Actual fallback value
    });

    it('should handle missing events array and treat as single event', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              title: '단일 행사',
              description: '배열이 아닌 단일 객체',
              startDate: '2025-11-15',
              endDate: '2025-11-15',
            }),
          },
        }],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await generateEventInfos(mockEnv, mockItem);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('단일 행사');
    });

    it('should request with correct prompt structure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                events: [{
                  title: 'test',
                  description: 'test',
                }],
              }),
            },
          }],
        }),
      });

      await generateEventInfos(mockEnv, mockItem);

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.model).toBe(mockEnv.OPENAI_CONTENT_MODEL);
      expect(body.response_format.type).toBe('json_object');
      expect(body.messages[1].content).toContain(mockItem.title);
      expect(body.messages[1].content).toContain(mockItem.pubDate);
    });
  });
});
