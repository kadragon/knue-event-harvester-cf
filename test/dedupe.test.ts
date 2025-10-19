import { describe, expect, it } from "vitest";
import { isDuplicate, normalizedLevenshtein } from "../src/lib/dedupe";

const existing = [
  {
    id: "1",
    summary: "Sample Event",
    description: "참가 신청 기간: 2025-10-02",
    start: { date: "2025-10-02" },
    end: { date: "2025-10-03" },
    extendedProperties: {
      private: {
        nttNo: "12345",
      },
    },
  },
];

describe("normalizedLevenshtein", () => {
  it("returns 1 for identical strings", () => {
    expect(normalizedLevenshtein("abc", "abc")).toBe(1);
  });

  it("returns value between 0 and 1", () => {
    const score = normalizedLevenshtein("abc", "def");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe("isDuplicate", () => {
  it("matches by extended property", async () => {
    const candidate = {
      title: "Sample Event",
      description: "참가 신청 기간: 2025-10-02",
      startDate: "2025-10-02",
      endDate: "2025-10-02",
    };
    const result = await isDuplicate(existing as any, candidate, {
      threshold: 0.8,
      meta: { eventId: "", nttNo: "12345", processedAt: "", hash: "" },
    });
    expect(result).toBe(true);
  });
});
