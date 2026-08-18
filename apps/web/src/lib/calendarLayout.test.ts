import { defaultCombinationConfig, parseHHmm, type Group, type Weekday } from "@unapp/core";
import { describe, expect, it } from "vitest";
import { computeHourRange, computeVisibleDays, minutesToRow, rowCount } from "./calendarLayout";

function group(id: string, day: Weekday, start: string, end: string): Group {
  return {
    id,
    parentCourseId: "c1",
    quota: 30,
    disabled: false,
    slots: [
      {
        day,
        time: { start: parseHHmm(start), end: parseHHmm(end) },
        validity: { start: "2026-01-01", end: "2026-06-01" },
      },
    ],
  };
}

describe("computeHourRange", () => {
  it("falls back to the configured range when there is nothing scheduled", () => {
    const config = defaultCombinationConfig();
    expect(computeHourRange([], config)).toEqual({ startHour: 7, endHour: 20 });
  });

  it("widens to fit a slot that starts before or ends after the configured range", () => {
    const config = { ...defaultCombinationConfig(), range: { start: 7 * 60, end: 20 * 60 } };
    const g = group("g1", "monday", "06:00", "21:30");
    expect(computeHourRange([g], config)).toEqual({ startHour: 6, endHour: 22 });
  });
});

describe("minutesToRow", () => {
  it("maps the range start to row 1", () => {
    expect(minutesToRow(7 * 60, { startHour: 7, endHour: 20 })).toBe(1);
  });

  it("maps a half-hour offset to row 2", () => {
    expect(minutesToRow(7 * 60 + 30, { startHour: 7, endHour: 20 })).toBe(2);
  });
});

describe("rowCount", () => {
  it("is two rows (30 min each) per hour of the range", () => {
    expect(rowCount({ startHour: 7, endHour: 9 })).toBe(4);
  });
});

describe("computeVisibleDays", () => {
  it("shows Monday-Saturday by default, without Sunday", () => {
    const config = defaultCombinationConfig();
    const days = computeVisibleDays([], config);
    expect(days).toEqual(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);
  });

  it("adds Sunday only when a group actually meets on it", () => {
    const config = defaultCombinationConfig();
    const g = group("g1", "sunday", "08:00", "09:00");
    const days = computeVisibleDays([g], config);
    expect(days).toContain("sunday");
  });
});
