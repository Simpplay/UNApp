import type { ScheduleSlot } from "../model/course.js";
import { rangesOverlap } from "../model/time.js";

/**
 * Two slots conflict if they fall on the same day, their time ranges overlap,
 * AND their validity windows overlap (a lab that only runs weeks 1-8 does not
 * conflict with a lecture that only runs weeks 9-16, even at the same hour).
 */
export function slotsConflict(a: ScheduleSlot, b: ScheduleSlot): boolean {
  if (a.day !== b.day) return false;
  if (!rangesOverlap(a.time, b.time)) return false;
  return a.validity.start <= b.validity.end && b.validity.start <= a.validity.end;
}

/** Does `candidate` conflict with any slot already committed to the combination? */
export function findConflict(
  committed: readonly ScheduleSlot[],
  candidate: readonly ScheduleSlot[],
): { a: ScheduleSlot; b: ScheduleSlot } | null {
  for (const c of candidate) {
    for (const existing of committed) {
      if (slotsConflict(existing, c)) {
        return { a: existing, b: c };
      }
    }
  }
  return null;
}
