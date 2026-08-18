import type { CombinationConfig } from "../model/combination-config.js";
import type { Group, ScheduleSlot } from "../model/course.js";
import { rangesOverlap, WEEKDAYS, type Weekday } from "../model/time.js";

/**
 * Soft-constraint penalty weights. Overlap is deliberately NOT scored here:
 * the generator (see generate.ts) refuses to build a combination with a
 * schedule conflict in the first place, so a "valid" combination can never
 * have one. This is a structural fix for a real bug in the legacy app,
 * where a combination with exactly one overlap scored -500 and a `score >=
 * -500` filter let it through as "valid" anyway.
 */
export const PENALTY = {
  lunchOverlap: 1,
  freeDay: 2,
  outOfRange: 3,
  freeTime: 5,
  maxHolesPerDay: 10,
  maxCoursesPerDay: 20,
} as const;

export interface ScoreDetails {
  lunchOverlaps: number;
  freeDayHits: number;
  outOfRangeHits: number;
  freeTimeHits: number;
  /** Days that exceeded maxHolesPerDay. */
  excessHoleDays: Weekday[];
  /** Days that exceeded maxCoursesPerDay, with how many slots over the limit. */
  excessCourseDays: { day: Weekday; over: number }[];
}

export interface ScoreResult {
  score: number;
  details: ScoreDetails;
}

function emptyDetails(): ScoreDetails {
  return {
    lunchOverlaps: 0,
    freeDayHits: 0,
    outOfRangeHits: 0,
    freeTimeHits: 0,
    excessHoleDays: [],
    excessCourseDays: [],
  };
}

/** A slot is "in range" only when fully contained by the allowed range, not merely overlapping it. */
function isWithinRange(slot: ScheduleSlot, range: { start: number; end: number }): boolean {
  return slot.time.start >= range.start && slot.time.end <= range.end;
}

/**
 * Scores a set of already conflict-free groups against the user's soft
 * constraints. Lower (more negative) is worse; 0 is a perfect fit.
 */
export function scoreCombination(groups: readonly Group[], config: CombinationConfig): ScoreResult {
  const details = emptyDetails();
  let score = 0;

  const slotsByDay: Record<Weekday, ScheduleSlot[]> = {
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
  };

  for (const group of groups) {
    for (const slot of group.slots) {
      slotsByDay[slot.day].push(slot);

      if (config.freeDays.includes(slot.day)) {
        score -= PENALTY.freeDay;
        details.freeDayHits += 1;
      }

      if (!isWithinRange(slot, config.range)) {
        score -= PENALTY.outOfRange;
        details.outOfRangeHits += 1;
      }

      if (config.lunchTime && rangesOverlap(slot.time, config.lunchTime)) {
        score -= PENALTY.lunchOverlap;
        details.lunchOverlaps += 1;
      }

      for (const freeTime of config.freeTime) {
        if (freeTime.day === slot.day && rangesOverlap(slot.time, freeTime.time)) {
          score -= PENALTY.freeTime;
          details.freeTimeHits += 1;
        }
      }
    }
  }

  for (const day of WEEKDAYS) {
    const daySlots = [...slotsByDay[day]].sort((a, b) => a.time.start - b.time.start);

    if (config.maxCoursesPerDay !== -1 && daySlots.length > config.maxCoursesPerDay) {
      const over = daySlots.length - config.maxCoursesPerDay;
      score -= PENALTY.maxCoursesPerDay * over;
      details.excessCourseDays.push({ day, over });
    }

    if (config.maxHolesPerDay !== -1 && daySlots.length > 1) {
      let holes = 0;
      for (let i = 1; i < daySlots.length; i += 1) {
        const prev = daySlots[i - 1] as ScheduleSlot;
        const curr = daySlots[i] as ScheduleSlot;
        if (curr.time.start > prev.time.end) holes += 1;
      }
      if (holes > config.maxHolesPerDay) {
        score -= PENALTY.maxHolesPerDay;
        details.excessHoleDays.push(day);
      }
    }
  }

  return { score, details };
}
