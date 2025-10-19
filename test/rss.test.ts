import { describe, expect, it } from "vitest";
import { parseRss } from "../src/lib/rss";

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
});
