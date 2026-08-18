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
 * Deliberately does NOT consider `quota === 0`: a course whose groups are
 * merely full (not disabled by the user) is a different, worth-surfacing
 * situation - see `GenerateResult.blockedCourses` in combination/generate.ts.
 */
export function isCourseFullyDisabled(course: Course): boolean {
  return course.groups.length > 0 && course.groups.every(isGroupManuallyDisabled);
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
