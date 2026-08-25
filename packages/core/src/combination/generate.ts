import { defaultCombinationConfig, type CombinationConfig } from "../model/combination-config.js";
import {
  isCourseEffectivelyDisabled,
  isGroupEffectivelyDisabled,
  type Course,
  type Group,
  type ScheduleSlot,
} from "../model/course.js";
import { findConflict } from "./conflicts.js";
import { scoreCombination, type ScoreDetails } from "./score.js";

export interface Combination {
  groups: Group[];
  score: number;
  details: ScoreDetails;
}

export interface GenerateOptions {
  config?: CombinationConfig;
  /**
   * Safety valve against combinatorial blow-up: the old app generated the
   * FULL cartesian product of every group of every course before filtering
   * anything, which could produce tens of thousands of throwaway
   * combinations for a normal course load. This generator prunes
   * schedule-conflicting branches as it builds them (so it never even
   * constructs most of what the old app generated and discarded), but this
   * cap is kept as a hard backstop for pathological inputs.
   */
  maxResults?: number;
}

export interface GenerateResult {
  combinations: Combination[];
  /**
   * Selected courses with zero groups defined at all - no combination can
   * include them. Courses that ran out of seats no longer land here: they're
   * auto-excluded up front, same as a manually fully-disabled course.
   */
  blockedCourses: Course[];
  /** True if generation stopped early because maxResults was reached. */
  truncated: boolean;
  totalCredits: number;
  creditsWithinLimits: boolean;
}

/**
 * Generates every schedule-conflict-free combination of one group per
 * eligible course, ranked by score (best first).
 *
 * This fixes the structural bug in the legacy generator where overlap was a
 * *soft* penalty (-500 points) checked against a `score >= -500` threshold,
 * which let single-overlap combinations through as "valid". Here a
 * conflicting group is never added to a branch in the first place - overlap
 * is impossible in the output, not just discouraged.
 */
export function generateCombinations(courses: Course[], options: GenerateOptions = {}): GenerateResult {
  const config = options.config ?? defaultCombinationConfig();
  const maxResults = options.maxResults ?? 5000;

  const eligibleCourses = courses.filter((c) => !isCourseEffectivelyDisabled(c));
  const totalCredits = eligibleCourses.reduce((sum, c) => sum + c.credits, 0);
  const creditsWithinLimits =
    (config.minCredits === -1 || totalCredits >= config.minCredits) &&
    (config.maxCredits === -1 || totalCredits <= config.maxCredits);

  const perCourse = eligibleCourses.map((course) => ({
    course,
    groups: course.groups.filter((g) => !isGroupEffectivelyDisabled(g)),
  }));

  const blockedCourses = perCourse.filter((pc) => pc.groups.length === 0).map((pc) => pc.course);
  if (blockedCourses.length > 0) {
    return { combinations: [], blockedCourses, truncated: false, totalCredits, creditsWithinLimits };
  }

  const results: Combination[] = [];
  let truncated = false;

  const chosen: Group[] = [];
  const committedSlots: ScheduleSlot[] = [];

  function backtrack(index: number): void {
    if (truncated) return;

    if (index === perCourse.length) {
      const { score, details } = scoreCombination(chosen, config);
      results.push({ groups: [...chosen], score, details });
      if (results.length >= maxResults) truncated = true;
      return;
    }

    const candidates = perCourse[index]?.groups ?? [];
    for (const group of candidates) {
      if (findConflict(committedSlots, group.slots)) continue;

      chosen.push(group);
      committedSlots.push(...group.slots);

      backtrack(index + 1);

      committedSlots.length -= group.slots.length;
      chosen.pop();

      if (truncated) return;
    }
  }

  backtrack(0);
  results.sort((a, b) => b.score - a.score);

  return { combinations: results, blockedCourses: [], truncated, totalCredits, creditsWithinLimits };
}
