import { describe, expect, it } from "vitest";
import {
  isDuplicate,
  normalizedLevenshtein,
  parseDateTime,
  getEventTimeRange,
  getInputTimeRange,
  timeRangesOverlap,
} from "../../src/lib/dedupe";

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

describe("parseDateTime", () => {
  it("parses ISO 8601 datetime with timezone", () => {
    const date = parseDateTime("2025-10-22T09:00:00+09:00");
    expect(date).toBeInstanceOf(Date);
    expect(date.getUTCHours()).toBe(0); // 09:00 KST = 00:00 UTC
  });

  it("parses ISO 8601 datetime without timezone", () => {
    const date = parseDateTime("2025-10-22T09:00:00");
    expect(date).toBeInstanceOf(Date);
  });

  it("throws error for invalid datetime", () => {
    expect(() => parseDateTime("invalid-date")).toThrow();
  });
});

describe("getEventTimeRange", () => {
  it("returns null for all-day event", () => {
    const event = {
      id: "1",
      start: { date: "2025-10-22" },
      end: { date: "2025-10-23" },
    };
    const result = getEventTimeRange(event as any);
    expect(result).toBeNull();
  });

  it("returns time range for timed event", () => {
    const event = {
      id: "1",
      start: { dateTime: "2025-10-22T09:00:00+09:00" },
      end: { dateTime: "2025-10-22T10:00:00+09:00" },
    };
    const result = getEventTimeRange(event as any);
    expect(result).not.toBeNull();
    expect(result?.start).toBeInstanceOf(Date);
    expect(result?.end).toBeInstanceOf(Date);
  });

  it("returns null when missing dateTime property", () => {
    const event = {
      id: "1",
      start: {},
      end: {},
    };
    const result = getEventTimeRange(event as any);
    expect(result).toBeNull();
  });
});

describe("getInputTimeRange", () => {
  it("returns null for all-day event (no startTime)", () => {
    const input = {
      title: "All Day Event",
      description: "",
      startDate: "2025-10-22",
      endDate: "2025-10-22",
    };
    const result = getInputTimeRange(input as any, "2025-10-22");
    expect(result).toBeNull();
  });

  it("returns time range for timed event", () => {
    const input = {
      title: "Timed Event",
      description: "",
      startDate: "2025-10-22",
      endDate: "2025-10-22",
      startTime: "09:00",
      endTime: "10:00",
    };
    const result = getInputTimeRange(input as any, "2025-10-22");
    expect(result).not.toBeNull();
    expect(result?.start).toBeInstanceOf(Date);
    expect(result?.end).toBeInstanceOf(Date);
  });

  it("uses endTime 23:59 as default when missing", () => {
    const input = {
      title: "Event",
      description: "",
      startDate: "2025-10-22",
      endDate: "2025-10-22",
      startTime: "09:00",
    };
    const result = getInputTimeRange(input as any, "2025-10-22");
    expect(result?.end.getUTCHours()).toBe(14); // 23:59 KST = 14:59 UTC
  });
});

describe("timeRangesOverlap", () => {
  it("returns true for complete overlap", () => {
    const range1 = {
      start: new Date("2025-10-22T09:00:00+09:00"),
      end: new Date("2025-10-22T11:00:00+09:00"),
    };
    const range2 = {
      start: new Date("2025-10-22T09:30:00+09:00"),
      end: new Date("2025-10-22T10:30:00+09:00"),
    };
    expect(timeRangesOverlap(range1, range2)).toBe(true);
  });

  it("returns true for partial overlap", () => {
    const range1 = {
      start: new Date("2025-10-22T09:00:00+09:00"),
      end: new Date("2025-10-22T10:00:00+09:00"),
    };
    const range2 = {
      start: new Date("2025-10-22T09:30:00+09:00"),
      end: new Date("2025-10-22T11:00:00+09:00"),
    };
    expect(timeRangesOverlap(range1, range2)).toBe(true);
  });

  it("returns false for adjacent ranges (no overlap)", () => {
    const range1 = {
      start: new Date("2025-10-22T09:00:00+09:00"),
      end: new Date("2025-10-22T10:00:00+09:00"),
    };
    const range2 = {
      start: new Date("2025-10-22T10:00:00+09:00"),
      end: new Date("2025-10-22T11:00:00+09:00"),
    };
    expect(timeRangesOverlap(range1, range2)).toBe(false);
  });

  it("returns false for sequential ranges (no overlap)", () => {
    const range1 = {
      start: new Date("2025-10-22T09:00:00+09:00"),
      end: new Date("2025-10-22T10:00:00+09:00"),
    };
    const range2 = {
      start: new Date("2025-10-22T14:00:00+09:00"),
      end: new Date("2025-10-22T15:00:00+09:00"),
    };
    expect(timeRangesOverlap(range1, range2)).toBe(false);
  });

  it("returns true for one-minute overlap at boundary", () => {
    const range1 = {
      start: new Date("2025-10-22T09:00:00+09:00"),
      end: new Date("2025-10-22T10:01:00+09:00"),
    };
    const range2 = {
      start: new Date("2025-10-22T10:00:00+09:00"),
      end: new Date("2025-10-22T11:00:00+09:00"),
    };
    expect(timeRangesOverlap(range1, range2)).toBe(true);
  });

  it("returns false for reverse ranges (one ends before other starts)", () => {
    const range1 = {
      start: new Date("2025-10-22T14:00:00+09:00"),
      end: new Date("2025-10-22T15:00:00+09:00"),
    };
    const range2 = {
      start: new Date("2025-10-22T09:00:00+09:00"),
      end: new Date("2025-10-22T10:00:00+09:00"),
    };
    expect(timeRangesOverlap(range1, range2)).toBe(false);
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

  it("does not match events without nttNo meta", async () => {
    // Use different event to avoid high similarity match
    const existingEvents = [
      {
        id: "1",
        summary: "Different Event",
        description: "Different description",
        start: { date: "2025-10-02" },
        end: { date: "2025-10-03" },
        extendedProperties: {
          private: {
            nttNo: "99999",
          },
        },
      },
    ];
    const candidate = {
      title: "Sample Event",
      description: "참가 신청 기간: 2025-10-02",
      startDate: "2025-10-02",
      endDate: "2025-10-02",
    };
    const result = await isDuplicate(existingEvents as any, candidate, {
      threshold: 0.8,
    });
    expect(result).toBe(false);
  });
});

describe("isDuplicate - Time-based scenarios", () => {
  it("does not match same-day events with non-overlapping times", async () => {
    const existingEvents = [
      {
        id: "1",
        summary: "Morning Event",
        description: "학술제",
        start: { dateTime: "2025-10-22T09:00:00+09:00" },
        end: { dateTime: "2025-10-22T10:00:00+09:00" },
      },
    ];

    const candidate = {
      title: "Afternoon Event",
      description: "가요제",
      startDate: "2025-10-22",
      endDate: "2025-10-22",
      startTime: "14:00",
      endTime: "15:00",
    };

    const result = await isDuplicate(existingEvents as any, candidate, {
      threshold: 0.85,
    });
    expect(result).toBe(false);
  });

  it("matches same-day events with overlapping times and high similarity", async () => {
    const existingEvents = [
      {
        id: "1",
        summary: "Conference Day",
        description: "학술회의",
        start: { dateTime: "2025-10-22T09:00:00+09:00" },
        end: { dateTime: "2025-10-22T11:00:00+09:00" },
      },
    ];

    const candidate = {
      title: "Conference Day",
      description: "학술회의",
      startDate: "2025-10-22",
      endDate: "2025-10-22",
      startTime: "10:00",
      endTime: "12:00",
    };

    const result = await isDuplicate(existingEvents as any, candidate, {
      threshold: 0.85,
    });
    expect(result).toBe(true);
  });

  it("does not match timed event with all-day event", async () => {
    const existingEvents = [
      {
        id: "1",
        summary: "All Day Event",
        description: "공휴일",
        start: { date: "2025-10-22" },
        end: { date: "2025-10-23" },
      },
    ];

    const candidate = {
      title: "All Day Event",
      description: "공휴일",
      startDate: "2025-10-22",
      endDate: "2025-10-22",
      startTime: "09:00",
      endTime: "10:00",
    };

    const result = await isDuplicate(existingEvents as any, candidate, {
      threshold: 0.85,
    });
    expect(result).toBe(false);
  });

  it("matches all-day events on same day with high title similarity", async () => {
    const existingEvents = [
      {
        id: "1",
        summary: "School Foundation Day",
        description: "",
        start: { date: "2025-10-22" },
        end: { date: "2025-10-23" },
      },
    ];

    const candidate = {
      title: "School Foundation Day",
      description: "",
      startDate: "2025-10-22",
      endDate: "2025-10-22",
    };

    const result = await isDuplicate(existingEvents as any, candidate, {
      threshold: 0.85,
    });
    expect(result).toBe(true);
  });

  it("does not match events at exact boundary time (10:00 → 10:00)", async () => {
    const existingEvents = [
      {
        id: "1",
        summary: "Morning Session",
        description: "",
        start: { dateTime: "2025-10-22T09:00:00+09:00" },
        end: { dateTime: "2025-10-22T10:00:00+09:00" },
      },
    ];

    const candidate = {
      title: "Afternoon Session",
      description: "",
      startDate: "2025-10-22",
      endDate: "2025-10-22",
      startTime: "10:00",
      endTime: "11:00",
    };

    const result = await isDuplicate(existingEvents as any, candidate, {
      threshold: 0.85,
    });
    expect(result).toBe(false);
  });

  it("matches low-similarity titles only if time overlaps", async () => {
    const existingEvents = [
      {
        id: "1",
        summary: "Morning Meeting",
        description: "",
        start: { dateTime: "2025-10-22T09:00:00+09:00" },
        end: { dateTime: "2025-10-22T10:00:00+09:00" },
      },
    ];

    const candidate = {
      title: "Afternoon Gathering", // Different title
      description: "",
      startDate: "2025-10-22",
      endDate: "2025-10-22",
      startTime: "14:00",
      endTime: "15:00",
    };

    const result = await isDuplicate(existingEvents as any, candidate, {
      threshold: 0.85,
    });
    expect(result).toBe(false); // No time overlap, should not match
  });
});
