import type { Course, Group, ScheduleSlot } from "./model/course.js";
import { parseHHmm, type DateRange, type Weekday } from "./model/time.js";

const DEFAULT_VALIDITY: DateRange = { start: "2026-01-01", end: "2026-06-01" };

export function slot(
  day: Weekday,
  start: string,
  end: string,
  overrides: Partial<Omit<ScheduleSlot, "day" | "time">> = {},
): ScheduleSlot {
  return {
    day,
    time: { start: parseHHmm(start), end: parseHHmm(end) },
    validity: overrides.validity ?? DEFAULT_VALIDITY,
    ...(overrides.classroom !== undefined ? { classroom: overrides.classroom } : {}),
  };
}

export function group(
  id: string,
  parentCourseId: string,
  slots: ScheduleSlot[],
  overrides: Partial<Omit<Group, "id" | "parentCourseId" | "slots">> = {},
): Group {
  return {
    id,
    parentCourseId,
    quota: overrides.quota ?? 30,
    disabled: overrides.disabled ?? false,
    slots,
    ...(overrides.teacher !== undefined ? { teacher: overrides.teacher } : {}),
    ...(overrides.isLab !== undefined ? { isLab: overrides.isLab } : {}),
  };
}

export function course(
  id: string,
  name: string,
  groups: Group[],
  overrides: Partial<Omit<Course, "id" | "name" | "groups">> = {},
): Course {
  return {
    id,
    name,
    credits: overrides.credits ?? 3,
    color: overrides.color ?? "#5B8CFF",
    groups,
    requirements: overrides.requirements ?? [],
  };
}
