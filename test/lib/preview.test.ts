import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getFileType,
  extractPreviewId,
  fetchPreviewContent,
  resolveAttachmentText,
  type EnvBindings,
} from '../../src/lib/preview';
import type { RssItem } from '../../src/types';

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('Preview Module', () => {
  let mockEnv: EnvBindings;

  beforeEach(() => {
    mockEnv = {
      PREVIEW_PARSER_BASE: 'https://api.example.com/preview/',
      BEARER_TOKEN: 'test-token',
    };

    vi.clearAllMocks();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getFileType', () => {
    it('should identify image files', () => {
      expect(getFileType('photo.jpg')).toBe('image');
      expect(getFileType('image.PNG')).toBe('image');
      expect(getFileType('pic.gif')).toBe('image');
      expect(getFileType('file.jpeg')).toBe('image');
      expect(getFileType('test.webp')).toBe('image');
      expect(getFileType('image.bmp')).toBe('image');
    });

    it('should identify pdf files', () => {
      expect(getFileType('document.pdf')).toBe('pdf');
    });

    it('should identify hwp files', () => {
      expect(getFileType('doc.hwp')).toBe('hwp');
      expect(getFileType('file.hwpx')).toBe('hwp');
    });

    it('should identify doc files', () => {
      expect(getFileType('word.doc')).toBe('doc');
      expect(getFileType('document.docx')).toBe('doc');
    });

    it('should return other for unknown extensions', () => {
      expect(getFileType('file.txt')).toBe('other');
      expect(getFileType('data.json')).toBe('other');
      expect(getFileType('script.js')).toBe('other');
    });

    it('should return other for no filename', () => {
      expect(getFileType(undefined)).toBe('other');
      expect(getFileType(null as any)).toBe('other');
    });

    it('should return other for files without extension', () => {
      expect(getFileType('filename')).toBe('other');
    });
  });

  describe('extractPreviewId', () => {
    it('should extract ID from valid URL', () => {
      const url = 'https://example.com/preview?atchmnflNo=12345&other=param';
      expect(extractPreviewId(url)).toBe('12345');
    });

    it('should return null for URL without atchmnflNo', () => {
      const url = 'https://example.com/preview?other=param';
      expect(extractPreviewId(url)).toBeNull();
    });

    it('should return null for invalid URL', () => {
      expect(extractPreviewId('not-a-url')).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(extractPreviewId(undefined)).toBeNull();
    });
  });

  describe('fetchPreviewContent', () => {
    it('should return none when no preview URL', async () => {
      const result = await fetchPreviewContent(undefined, mockEnv);
      expect(result).toEqual({ sourceType: 'none' });
    });

    it('should return none when URL has no ID', async () => {
      const result = await fetchPreviewContent('https://example.com/no-id', mockEnv);
      expect(result).toEqual({ sourceType: 'none' });
    });

    it('should fetch image content successfully', async () => {
      const mockImageBuffer = new ArrayBuffer(8);
      const mockImageBase64 = Buffer.from(mockImageBuffer).toString('base64');

      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: () => Promise.resolve(mockImageBuffer),
      });

      const result = await fetchPreviewContent('https://example.com?atchmnflNo=123', mockEnv);

      expect(result).toEqual({
        sourceType: 'image',
        imageBase64: mockImageBase64,
        contentType: 'image/png',
      });

      expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/preview/123', {
        headers: { Authorization: 'Bearer test-token' },
      });
    });

    it('should fetch text content successfully', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: () => Promise.resolve('<html>content</html>'),
      });

      const result = await fetchPreviewContent('https://example.com?atchmnflNo=456', mockEnv);

      expect(result).toEqual({
        sourceType: 'text',
        text: '<html>content</html>',
        contentType: 'text/html',
      });
    });

    it('should fetch JSON content as text', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{"key": "value"}'),
      });

      const result = await fetchPreviewContent('https://example.com?atchmnflNo=789', mockEnv);

      expect(result).toEqual({
        sourceType: 'text',
        text: '{"key": "value"}',
        contentType: 'application/json',
      });
    });

    it('should fetch binary content as binary type', async () => {
      const mockBinaryBuffer = new ArrayBuffer(8);
      const mockBinaryBase64 = Buffer.from(mockBinaryBuffer).toString('base64');

      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: () => Promise.resolve(mockBinaryBuffer),
      });

      const result = await fetchPreviewContent('https://example.com?atchmnflNo=999', mockEnv);

      expect(result).toEqual({
        sourceType: 'binary',
        imageBase64: mockBinaryBase64,
        contentType: 'application/pdf',
      });
    });

    it('should return none on API error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await fetchPreviewContent('https://example.com?atchmnflNo=123', mockEnv);
      expect(result).toEqual({ sourceType: 'none' });
    });

    it('should handle trailing slash in base URL', async () => {
      const envWithSlash = { ...mockEnv, PREVIEW_PARSER_BASE: 'https://api.example.com/preview/' };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve('test content'),
      });

      await fetchPreviewContent('https://example.com?atchmnflNo=123', envWithSlash);

      expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/preview/123', expect.any(Object));
    });
  });

  describe('resolveAttachmentText', () => {
    it('should return empty string when no attachment', () => {
      const item: RssItem = {
        id: '1',
        title: 'Test',
        link: 'http://example.com',
        pubDate: '2023-01-01',
        descriptionHtml: 'desc',
      };

      expect(resolveAttachmentText(item)).toBe('');
    });

    it('should format filename only', () => {
      const item: RssItem = {
        id: '1',
        title: 'Test',
        link: 'http://example.com',
        pubDate: '2023-01-01',
        descriptionHtml: 'desc',
        attachment: {
          filename: 'document.pdf',
        },
      };

      expect(resolveAttachmentText(item)).toBe('첨부 파일: document.pdf');
    });

    it('should format URL only', () => {
      const item: RssItem = {
        id: '1',
        title: 'Test',
        link: 'http://example.com',
        pubDate: '2023-01-01',
        descriptionHtml: 'desc',
        attachment: {
          url: 'http://download.example.com/file.pdf',
        },
      };

      expect(resolveAttachmentText(item)).toBe('다운로드: http://download.example.com/file.pdf');
    });

    it('should format preview URL only', () => {
      const item: RssItem = {
        id: '1',
        title: 'Test',
        link: 'http://example.com',
        pubDate: '2023-01-01',
        descriptionHtml: 'desc',
        attachment: {
          preview: 'http://preview.example.com/123',
        },
      };

      expect(resolveAttachmentText(item)).toBe('미리보기: http://preview.example.com/123');
    });

    it('should format all attachment fields', () => {
      const item: RssItem = {
        id: '1',
        title: 'Test',
        link: 'http://example.com',
        pubDate: '2023-01-01',
        descriptionHtml: 'desc',
        attachment: {
          filename: 'document.pdf',
          url: 'http://download.example.com/file.pdf',
          preview: 'http://preview.example.com/123',
        },
      };

      const expected = '첨부 파일: document.pdf\n다운로드: http://download.example.com/file.pdf\n미리보기: http://preview.example.com/123';
      expect(resolveAttachmentText(item)).toBe(expected);
    });
  });
});
