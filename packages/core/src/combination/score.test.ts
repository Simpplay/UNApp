import { describe, expect, it } from "vitest";
import { defaultCombinationConfig } from "../model/combination-config.js";
import { group, slot } from "../test-utils.js";
import { PENALTY, scoreCombination } from "./score.js";

describe("scoreCombination", () => {
  it("scores a perfectly compliant schedule as 0", () => {
    const g = group("g1", "c1", [slot("monday", "08:00", "10:00")]);
    const { score, details } = scoreCombination([g], defaultCombinationConfig());
    expect(score).toBe(0);
    expect(details.freeDayHits).toBe(0);
    expect(details.outOfRangeHits).toBe(0);
    expect(details.lunchOverlaps).toBe(0);
  });

  // Regression test for legacy bug #1: `day in freeDaysArray` (an `in`
  // operator misuse checking array indices, not values) meant "free days"
  // never actually excluded anything. Here freeDays is checked with
  // `.includes()`, so it must fire.
  it("penalizes a class scheduled on a declared free day", () => {
    const config = { ...defaultCombinationConfig(), freeDays: ["monday" as const] };
    const g = group("g1", "c1", [slot("monday", "08:00", "10:00")]);
    const { score, details } = scoreCombination([g], config);
    expect(details.freeDayHits).toBe(1);
    expect(score).toBe(-PENALTY.freeDay);
  });

  // Regression test for legacy bug #2: `pointsPerError.free_time` did not
  // exist on the weights table, so `score -= undefined` produced NaN and
  // silently dropped every combination that touched a free-time block.
  it("penalizes overlap with a manual free-time block with a real, finite number", () => {
    const config = {
      ...defaultCombinationConfig(),
      freeTime: [
        {
          id: "ft1",
          name: "Gimnasio",
          color: "#000",
          day: "monday" as const,
          time: { start: 8 * 60, end: 9 * 60 },
        },
      ],
    };
    const g = group("g1", "c1", [slot("monday", "08:30", "10:00")]);
    const { score, details } = scoreCombination([g], config);
    expect(Number.isFinite(score)).toBe(true);
    expect(details.freeTimeHits).toBe(1);
    expect(score).toBe(-PENALTY.freeTime);
  });

  // Regression test for legacy bug #3: `max_holes_per_day` never checked the
  // `-1` ("disabled") sentinel the way `max_courses_per_day` did, so a day
  // with any gap was penalized even when the user never enabled the setting.
  it("does not penalize holes when maxHolesPerDay is -1 (disabled)", () => {
    const config = { ...defaultCombinationConfig(), maxHolesPerDay: -1 };
    const g = group("g1", "c1", [
      slot("monday", "07:00", "08:00"),
      slot("monday", "10:00", "11:00"), // 2h gap
    ]);
    const { score, details } = scoreCombination([g], config);
    expect(details.excessHoleDays).toEqual([]);
    expect(score).toBe(0);
  });

  it("penalizes holes once maxHolesPerDay is enabled and exceeded", () => {
    const config = { ...defaultCombinationConfig(), maxHolesPerDay: 0 };
    const g = group("g1", "c1", [
      slot("monday", "07:00", "08:00"),
      slot("monday", "10:00", "11:00"),
    ]);
    const { score, details } = scoreCombination([g], config);
    expect(details.excessHoleDays).toEqual(["monday"]);
    expect(score).toBe(-PENALTY.maxHolesPerDay);
  });

  it("requires a slot to be fully contained in the available range, not merely overlapping it", () => {
    const config = { ...defaultCombinationConfig(), range: { start: 7 * 60, end: 20 * 60 } };
    // starts before range opens, ends inside it
    const g = group("g1", "c1", [slot("monday", "06:00", "08:00")]);
    const { details } = scoreCombination([g], config);
    expect(details.outOfRangeHits).toBe(1);
  });

  it("scales the max-courses-per-day penalty by how far over the limit the day is", () => {
    const config = { ...defaultCombinationConfig(), maxCoursesPerDay: 1 };
    const g = group("g1", "c1", [
      slot("monday", "07:00", "08:00"),
      slot("monday", "09:00", "10:00"),
      slot("monday", "11:00", "12:00"),
    ]);
    const { score, details } = scoreCombination([g], config);
    expect(details.excessCourseDays).toEqual([{ day: "monday", over: 2 }]);
    expect(score).toBe(-PENALTY.maxCoursesPerDay * 2);
  });
});
