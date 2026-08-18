import type { MinutesOfDay, TimeRange, Weekday } from "./time.js";

export interface FreeTimeBlock {
  id: string;
  name: string;
  color: string;
  day: Weekday;
  time: TimeRange;
}

/**
 * User-tunable constraints for combination generation.
 *
 * `-1` is the sentinel for "no limit" on the two `max*` fields - both are
 * guarded consistently in the scorer (see combination/score.ts). The old
 * app guarded `max_courses_per_day` but forgot to guard `max_holes_per_day`,
 * which silently penalized every combination by default.
 */
export interface CombinationConfig {
  freeDays: Weekday[];
  lunchTime: TimeRange | null;
  maxCoursesPerDay: number;
  maxHolesPerDay: number;
  range: TimeRange;
  freeTime: FreeTimeBlock[];
  /** New: total credit constraints across the whole combination. -1 = no limit. */
  minCredits: number;
  maxCredits: number;
}

const ALL_DAY: TimeRange = { start: 0 as MinutesOfDay, end: (24 * 60) as MinutesOfDay };

export function defaultCombinationConfig(): CombinationConfig {
  return {
    freeDays: [],
    lunchTime: { start: 12 * 60, end: 13 * 60 },
    maxCoursesPerDay: -1,
    maxHolesPerDay: -1,
    range: { start: 7 * 60, end: 20 * 60 },
    freeTime: [],
    minCredits: -1,
    maxCredits: -1,
  };
}

export { ALL_DAY };
