import { describe, it, expect } from 'vitest';
import { deduplicateLinks, isImageFile, buildAttachmentFromFile } from '../../src/lib/utils';
import type { RssItem } from '../../src/types';

describe('deduplicateLinks', () => {
  it('should remove duplicate links and prioritize primary link', () => {
    const primary = 'https://example.com/notice/123';
    const secondary = [
      'https://example.com/notice/123',  // 중복
      'https://forms.google.com/d/ABC',
      'https://www.youtube.com/watch?v=XYZ',
    ];

    const result = deduplicateLinks(primary, secondary);

    expect(result).toEqual([
      'https://example.com/notice/123',
      'https://forms.google.com/d/ABC',
      'https://www.youtube.com/watch?v=XYZ',
    ]);
  });

  it('should ignore query parameters when comparing URLs', () => {
    const primary = 'https://forms.google.com/d/ABC';
    const secondary = [
      'https://forms.google.com/d/ABC?utm=campaign',
      'https://forms.google.com/d/ABC?edit=usp',
    ];

    const result = deduplicateLinks(primary, secondary);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe('https://forms.google.com/d/ABC');
  });

  it('should handle undefined primary link', () => {
    const secondary = [
      'https://example.com/notice/123',
      'https://forms.google.com/d/ABC',
    ];

    const result = deduplicateLinks(undefined, secondary);

    expect(result).toEqual([
      'https://example.com/notice/123',
      'https://forms.google.com/d/ABC',
    ]);
  });

  it('should handle empty secondary links', () => {
    const primary = 'https://example.com/notice/123';
    const secondary: string[] = [];

    const result = deduplicateLinks(primary, secondary);

    expect(result).toEqual(['https://example.com/notice/123']);
  });

  it('should handle empty primary and secondary links', () => {
    const result = deduplicateLinks(undefined, []);

    expect(result).toEqual([]);
  });

  it('should preserve URL case sensitivity for hostname', () => {
    const primary = 'https://Example.Com/path';
    const secondary = ['https://example.com/path'];

    const result = deduplicateLinks(primary, secondary);

    // 호스트명은 case-insensitive
    expect(result).toHaveLength(1);
  });

  it('should handle URLs with different protocols as different', () => {
    const primary = 'https://example.com/path';
    const secondary = ['http://example.com/path'];

    const result = deduplicateLinks(primary, secondary);

    expect(result).toHaveLength(2);
  });

  it('should handle URLs with trailing slashes', () => {
    const primary = 'https://example.com/path/';
    const secondary = ['https://example.com/path'];

    const result = deduplicateLinks(primary, secondary);

    // 경로는 엄격하게 비교
    expect(result).toHaveLength(2);
  });
});

describe('isImageFile', () => {
  it('should return true for jpeg extensions', () => {
    expect(isImageFile('photo.jpg')).toBe(true);
    expect(isImageFile('photo.jpeg')).toBe(true);
  });

  it('should return true for png extensions', () => {
    expect(isImageFile('image.png')).toBe(true);
  });

  it('should return true for gif extensions', () => {
    expect(isImageFile('animation.gif')).toBe(true);
  });

  it('should return true for bmp extensions', () => {
    expect(isImageFile('bitmap.bmp')).toBe(true);
  });

  it('should return true for webp extensions', () => {
    expect(isImageFile('modern.webp')).toBe(true);
  });

  it('should return false for pdf extensions', () => {
    expect(isImageFile('document.pdf')).toBe(false);
  });

  it('should return false for hwp extensions', () => {
    expect(isImageFile('document.hwp')).toBe(false);
    expect(isImageFile('document.hwpx')).toBe(false);
  });

  it('should return false for doc extensions', () => {
    expect(isImageFile('document.doc')).toBe(false);
    expect(isImageFile('document.docx')).toBe(false);
  });

  it('should return false for undefined filename', () => {
    expect(isImageFile(undefined)).toBe(false);
  });

  it('should be case insensitive', () => {
    expect(isImageFile('photo.JPG')).toBe(true);
    expect(isImageFile('photo.Jpeg')).toBe(true);
    expect(isImageFile('image.PNG')).toBe(true);
  });

  it('should handle filenames without extension', () => {
    expect(isImageFile('noextension')).toBe(false);
  });

  it('should handle filenames with multiple dots', () => {
    expect(isImageFile('photo.backup.jpg')).toBe(true);
  });
});

describe('buildAttachmentFromFile', () => {
  it('should build attachment from url for image file', () => {
    const item: RssItem = {
      id: '123',
      title: 'Test',
      link: 'https://example.com',
      pubDate: '2025-10-28',
      descriptionHtml: 'Test',
      attachment: {
        filename: 'poster.jpg',
        url: 'https://example.com/download/123',
      },
    };

    const result = buildAttachmentFromFile(item);

    expect(result).toEqual({
      fileUrl: 'https://example.com/download/123',
      mimeType: 'image/jpeg',
      title: 'poster.jpg',
    });
  });

  it('should handle png image', () => {
    const item: RssItem = {
      id: '123',
      title: 'Test',
      link: 'https://example.com',
      pubDate: '2025-10-28',
      descriptionHtml: 'Test',
      attachment: {
        filename: 'image.png',
        url: 'https://example.com/download/456',
      },
    };

    const result = buildAttachmentFromFile(item);

    expect(result?.mimeType).toBe('image/png');
  });

  it('should return undefined if no attachment', () => {
    const item: RssItem = {
      id: '123',
      title: 'Test',
      link: 'https://example.com',
      pubDate: '2025-10-28',
      descriptionHtml: 'Test',
    };

    const result = buildAttachmentFromFile(item);

    expect(result).toBeUndefined();
  });

  it('should return undefined if no url or preview', () => {
    const item: RssItem = {
      id: '123',
      title: 'Test',
      link: 'https://example.com',
      pubDate: '2025-10-28',
      descriptionHtml: 'Test',
      attachment: {
        filename: 'file.pdf',
      },
    };

    const result = buildAttachmentFromFile(item);

    expect(result).toBeUndefined();
  });

  it('should prefer url over preview', () => {
    const item: RssItem = {
      id: '123',
      title: 'Test',
      link: 'https://example.com',
      pubDate: '2025-10-28',
      descriptionHtml: 'Test',
      attachment: {
        filename: 'poster.jpg',
        url: 'https://example.com/download/123',
        preview: 'https://example.com/preview/456',
      },
    };

    const result = buildAttachmentFromFile(item);

    expect(result?.fileUrl).toBe('https://example.com/download/123');
  });

  it('should fallback to preview url if no download url', () => {
    const item: RssItem = {
      id: '123',
      title: 'Test',
      link: 'https://example.com',
      pubDate: '2025-10-28',
      descriptionHtml: 'Test',
      attachment: {
        filename: 'poster.jpg',
        preview: 'https://example.com/preview/456',
      },
    };

    const result = buildAttachmentFromFile(item);

    expect(result?.fileUrl).toBe('https://example.com/preview/456');
  });

  it('should handle pdf file', () => {
    const item: RssItem = {
      id: '123',
      title: 'Test',
      link: 'https://example.com',
      pubDate: '2025-10-28',
      descriptionHtml: 'Test',
      attachment: {
        filename: 'document.pdf',
        url: 'https://example.com/download/pdf',
      },
    };

    const result = buildAttachmentFromFile(item);

    expect(result?.mimeType).toBe('application/pdf');
  });

  it('should handle hwp file', () => {
    const item: RssItem = {
      id: '123',
      title: 'Test',
      link: 'https://example.com',
      pubDate: '2025-10-28',
      descriptionHtml: 'Test',
      attachment: {
        filename: 'document.hwp',
        url: 'https://example.com/download/hwp',
      },
    };

    const result = buildAttachmentFromFile(item);

    expect(result?.mimeType).toBe('application/x-hwp');
  });

  it('should use filename in title field', () => {
    const item: RssItem = {
      id: '123',
      title: 'Test',
      link: 'https://example.com',
      pubDate: '2025-10-28',
      descriptionHtml: 'Test',
      attachment: {
        filename: 'very_long_filename_that_describes_the_file.jpg',
        url: 'https://example.com/download/123',
      },
    };

    const result = buildAttachmentFromFile(item);

    expect(result?.title).toBe('very_long_filename_that_describes_the_file.jpg');
  });
});
