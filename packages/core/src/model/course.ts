import type { DateRange, TimeRange, Weekday } from "./time.js";

/** One weekly meeting of a group: a day of the week + time range, valid within a date range. */
export interface ScheduleSlot {
  day: Weekday;
  time: TimeRange;
  /** Recurrence window (some universities run a group only part of the term, e.g. labs). */
  validity: DateRange;
  classroom?: string;
}

/** A single offering of a course - what the old app called a "group" (grupo/sección). */
export interface Group {
  id: string;
  parentCourseId: string;
  teacher?: string;
  /** Seats available. -1 means "unknown / not reported by the source". */
  quota: number;
  slots: ScheduleSlot[];
  /** User can manually exclude a group from combination generation without deleting it. */
  disabled: boolean;
  isLab?: boolean;
}

/** The user explicitly turned this group off - independent of capacity. */
export function isGroupManuallyDisabled(group: Group): boolean {
  return group.disabled;
}

/** Not usable for a combination for any reason: manually disabled, or no seats left. */
export function isGroupEffectivelyDisabled(group: Group): boolean {
  return group.disabled || group.quota === 0;
}

/** A prerequisite reference, resolved by id when possible and by name otherwise. */
export interface Requirement {
  courseId: string;
  courseName: string;
}

export interface Course {
  id: string;
  name: string;
  credits: number;
  color: string;
  groups: Group[];
  requirements: Requirement[];
}

/**
 * True only when the user manually turned off every group of this course -
 * the "I'm not taking this" case, which is silently excluded from
 * combination generation entirely (same as never selecting the course).
 *
 * Deliberately does NOT consider `quota === 0` - use `isCourseEffectivelyDisabled`
 * for the combined check that also accounts for full groups.
 */
export function isCourseFullyDisabled(course: Course): boolean {
  return course.groups.length > 0 && course.groups.every(isGroupManuallyDisabled);
}

/**
 * Not usable for combination generation for any reason: every group is
 * either manually disabled or full (`quota === 0`). This is the course-level
 * analog of `isGroupEffectivelyDisabled`, and drives auto-exclusion from
 * generation - a course that runs out of seats is silently skipped, same as
 * one the user turned off entirely.
 */
export function isCourseEffectivelyDisabled(course: Course): boolean {
  return course.groups.length > 0 && course.groups.every(isGroupEffectivelyDisabled);
}

/**
 * True when the course is effectively disabled *because it ran out of
 * seats*, not because the user manually disabled every group - drives the
 * "sin cupos" badge, kept distinct from a plain manual disable.
 */
export function isCourseOutOfSeats(course: Course): boolean {
  return isCourseEffectivelyDisabled(course) && !isCourseFullyDisabled(course);
}

export function createCourse(partial: Partial<Course> & Pick<Course, "id" | "name">): Course {
  return {
    id: partial.id,
    name: partial.name,
    credits: partial.credits ?? 0,
    color: partial.color ?? randomCourseColor(),
    groups: partial.groups ?? [],
    requirements: partial.requirements ?? [],
  };
}

const COURSE_PALETTE = [
  "#5B8CFF",
  "#FFB454",
  "#35C7A0",
  "#B98CFF",
  "#FF7FA6",
  "#4C9A63",
  "#E4A64C",
  "#5AA9E6",
];

let paletteCursor = 0;

/** Deterministic-ish palette cycling instead of the old `randomColor()` dependency. */
export function randomCourseColor(): string {
  const color = COURSE_PALETTE[paletteCursor % COURSE_PALETTE.length];
  paletteCursor += 1;
  return color as string;
}
