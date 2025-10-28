import { describe, expect, it } from "vitest";
import { parseRss } from "../../src/lib/rss";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>KNUE Notices</title>
    <item>
      <title><![CDATA[Sample Event]]></title>
      <link><![CDATA[https://www.knue.ac.kr/www/selectBbsNttView.do?key=809&bbsNo=28&nttNo=12345]]></link>
      <pubDate><![CDATA[2025-10-02]]></pubDate>
      <description><![CDATA[<p>설명 본문</p>]]></description>
      <filename1><![CDATA[test.pdf]]></filename1>
      <url1><![CDATA[https://example.com/test.pdf]]></url1>
      <preview1><![CDATA[https://www.knue.ac.kr/www/previewBbsFile.do?atchmnflNo=99999]]></preview1>
    </item>
  </channel>
</rss>`;

describe("parseRss", () => {
  it("parses basic item structure", () => {
    const result = parseRss(SAMPLE_RSS);
    expect(result).toHaveLength(1);
    const item = result[0];
    expect(item.id).toBe("12345");
    expect(item.attachment?.filename).toBe("test.pdf");
    expect(item.attachment?.preview).toContain("99999");
  });

  it("should extract nttNo from URL correctly", () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[Test]]></title>
      <link><![CDATA[https://www.knue.ac.kr/www/selectBbsNttView.do?key=809&bbsNo=28&nttNo=99999]]></link>
      <pubDate><![CDATA[2025-10-02]]></pubDate>
      <description><![CDATA[Test]]></description>
    </item>
  </channel>
</rss>`;
    const result = parseRss(rss);
    expect(result[0].id).toBe("99999");
  });

  it("should handle missing nttNo in URL using base64url fallback", () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[Test]]></title>
      <link><![CDATA[https://www.knue.ac.kr/www/selectBbsNttView.do?key=809&bbsNo=28]]></link>
      <pubDate><![CDATA[2025-10-02]]></pubDate>
      <description><![CDATA[Test]]></description>
    </item>
  </channel>
</rss>`;
    const result = parseRss(rss);
    // When nttNo is missing, falls back to base64url encoding of URL
    expect(result[0].id).toBeTruthy();
    expect(typeof result[0].id).toBe("string");
  });

  it("should handle multiple items", () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[Item 1]]></title>
      <link><![CDATA[https://example.com?nttNo=111]]></link>
      <pubDate><![CDATA[2025-10-01]]></pubDate>
      <description><![CDATA[Desc 1]]></description>
    </item>
    <item>
      <title><![CDATA[Item 2]]></title>
      <link><![CDATA[https://example.com?nttNo=222]]></link>
      <pubDate><![CDATA[2025-10-02]]></pubDate>
      <description><![CDATA[Desc 2]]></description>
    </item>
  </channel>
</rss>`;
    const result = parseRss(rss);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("111");
    expect(result[1].id).toBe("222");
  });

  it("should handle empty RSS", () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Empty</title>
  </channel>
</rss>`;
    const result = parseRss(rss);
    expect(result).toHaveLength(0);
  });

  it("should parse attachment with all fields", () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[Test]]></title>
      <link><![CDATA[https://example.com?nttNo=123]]></link>
      <pubDate><![CDATA[2025-10-02]]></pubDate>
      <description><![CDATA[Desc]]></description>
      <filename1><![CDATA[document.pdf]]></filename1>
      <url1><![CDATA[https://example.com/file.pdf]]></url1>
      <preview1><![CDATA[https://example.com/preview?id=456]]></preview1>
    </item>
  </channel>
</rss>`;
    const result = parseRss(rss);
    expect(result[0].attachment).toEqual({
      filename: "document.pdf",
      url: "https://example.com/file.pdf",
      preview: "https://example.com/preview?id=456",
    });
  });

  it("should handle item without attachment", () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[Test]]></title>
      <link><![CDATA[https://example.com?nttNo=123]]></link>
      <pubDate><![CDATA[2025-10-02]]></pubDate>
      <description><![CDATA[Desc]]></description>
    </item>
  </channel>
</rss>`;
    const result = parseRss(rss);
    expect(result[0].attachment).toBeUndefined();
  });

  it("should handle partial attachment (only filename)", () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[Test]]></title>
      <link><![CDATA[https://example.com?nttNo=123]]></link>
      <pubDate><![CDATA[2025-10-02]]></pubDate>
      <description><![CDATA[Desc]]></description>
      <filename1><![CDATA[file.txt]]></filename1>
    </item>
  </channel>
</rss>`;
    const result = parseRss(rss);
    expect(result[0].attachment?.filename).toBe("file.txt");
    // Empty string for missing url (not undefined)
    expect(result[0].attachment?.url).toBe("");
  });

  it("should handle CDATA sections correctly", () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[Title with <html> & symbols]]></title>
      <link><![CDATA[https://example.com?nttNo=123]]></link>
      <pubDate><![CDATA[2025-10-02]]></pubDate>
      <description><![CDATA[<p>HTML <strong>content</strong> & entities</p>]]></description>
    </item>
  </channel>
</rss>`;
    const result = parseRss(rss);
    expect(result[0].title).toContain("<html>");
    expect(result[0].descriptionHtml).toContain("<strong>");
  });

  it("should handle missing description", () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[Test]]></title>
      <link><![CDATA[https://example.com?nttNo=123]]></link>
      <pubDate><![CDATA[2025-10-02]]></pubDate>
    </item>
  </channel>
</rss>`;
    const result = parseRss(rss);
    expect(result[0].descriptionHtml).toBe("");
  });

  it("should handle empty pubDate", () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[Test]]></title>
      <link><![CDATA[https://example.com?nttNo=123]]></link>
      <pubDate><![CDATA[]]></pubDate>
      <description><![CDATA[Desc]]></description>
    </item>
  </channel>
</rss>`;
    const result = parseRss(rss);
    expect(result[0].pubDate).toBe("");
  });

  it("should handle malformed XML gracefully", () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[Test]]></title>
      <link><![CDATA[https://example.com?nttNo=123]]></link>
      <description><![CDATA[Desc]]></description>
    </item>
  </channel>
</rss>`;
    // Missing pubDate - should handle gracefully
    expect(() => parseRss(rss)).not.toThrow();
    const result = parseRss(rss);
    expect(result).toHaveLength(1);
  });
});
