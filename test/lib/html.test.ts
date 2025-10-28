import { describe, it, expect } from 'vitest';
import { htmlToText } from '../../src/lib/html';

describe('HTML Module', () => {
  describe('htmlToText', () => {
    it('should convert basic HTML to text', () => {
      const html = '<p>Hello <strong>world</strong>!</p>';
      expect(htmlToText(html)).toBe('Hello world!');
    });

    it('should handle line breaks and paragraphs', () => {
      const html = '<p>First paragraph</p><p>Second paragraph</p>';
      expect(htmlToText(html)).toBe('First paragraph\nSecond paragraph');
    });

    it('should handle br tags', () => {
      const html = 'Line 1<br>Line 2<br/>Line 3';
      expect(htmlToText(html)).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should handle div tags as line breaks', () => {
      const html = '<div>First</div><div>Second</div>';
      expect(htmlToText(html)).toBe('First\nSecond');
    });

    it('should handle list items', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      expect(htmlToText(html)).toBe('- Item 1\n- Item 2');
    });

    it('should decode HTML entities', () => {
      const html = 'Tom &amp; Jerry &lt;3 &quot;Hello&quot; &apos;World&apos;';
      expect(htmlToText(html)).toBe('Tom & Jerry <3 "Hello" \'World\'');
    });

    it('should decode numeric entities', () => {
      const html = 'Caf&#233; &amp; r&#233;sum&#233;'; // é is &#233;
      expect(htmlToText(html)).toBe('Café & résumé');
    });

    it('should decode hexadecimal entities', () => {
      const html = 'Greek: &#x3A9; &#x3C0;'; // Ω π
      expect(htmlToText(html)).toBe('Greek: Ω π');
    });

    it('should handle nbsp entity', () => {
      const html = 'Word&nbsp;with&nbsp;spaces';
      expect(htmlToText(html)).toBe('Word with spaces');
    });

    it('should remove script and style tags', () => {
      const html = '<p>Content</p><script>alert("bad");</script><style>body{color:red}</style><p>More content</p>';
      expect(htmlToText(html)).toBe('Content\nMore content');
    });

    it('should remove all HTML tags', () => {
      const html = '<html><head><title>Test</title></head><body><h1>Title</h1><p>Paragraph with <a href="#">link</a></p></body></html>';
      expect(htmlToText(html)).toBe('TestTitleParagraph with link');
    });

    it('should trim whitespace and remove empty lines', () => {
      const html = '<p>  First line  </p>\n\n<p>   </p><p>Second line</p>';
      expect(htmlToText(html)).toBe('First line\nSecond line');
    });

    it('should handle carriage returns', () => {
      const html = 'Line 1\r\nLine 2';
      expect(htmlToText(html)).toBe('Line 1\nLine 2');
    });

    it('should handle empty input', () => {
      expect(htmlToText('')).toBe('');
      expect(htmlToText(null as any)).toBe('');
      expect(htmlToText(undefined as any)).toBe('');
    });

    it('should handle complex real-world HTML', () => {
      const html = `
        <div class="content">
          <h2>공지사항 제목</h2>
          <p>안녕하세요. 다음과 같이 공지합니다.</p>
          <ul>
            <li>첫 번째 항목</li>
            <li>두 번째 항목 &amp; 설명</li>
          </ul>
          <p>문의사항이 있으시면 연락주세요.<br>감사합니다.</p>
        </div>
      `;
      const expected = '공지사항 제목\n안녕하세요. 다음과 같이 공지합니다.\n- 첫 번째 항목\n- 두 번째 항목 & 설명\n문의사항이 있으시면 연락주세요.\n감사합니다.';
      expect(htmlToText(html)).toBe(expected);
    });

    it('should preserve unknown entities', () => {
      const html = 'Text with &unknown; entity';
      expect(htmlToText(html)).toBe('Text with &unknown; entity');
    });

    it('should handle malformed entities', () => {
      const html = 'Text with &amp & &amp; malformed &; entities';
      expect(htmlToText(html)).toBe('Text with &amp & & malformed &; entities');
    });
  });
});
