import { ddmmyyyyToIso } from "../adapters/shared.js";
import { randomCourseColor, type Course, type Group, type ScheduleSlot } from "../model/course.js";
import { defaultCombinationConfig, type CombinationConfig, type FreeTimeBlock } from "../model/combination-config.js";
import { WEEKDAY_INDEX, parseHHmm, type DateRange, type TimeRange, type Weekday } from "../model/time.js";
import type { ParseWarning } from "../adapters/types.js";

/**
 * Converts a UNApp v1 backup (`university.getAsJSON()` from `unapp-old`,
 * one JSON object per university, downloaded via the old app's "save"
 * button) into the v2 domain model.
 *
 * The v1 shape is untyped JS serialized straight from live class instances,
 * so several fields are looser than the v2 model and are normalized here
 * rather than assumed:
 * - `course_credits` / `group_quota` could be numbers or numeric strings
 *   (manual-entry forms in v1 read them from text inputs).
 * - Schedule dates could be `DD/MM/YYYY` (from parsed `.unapp` text) or
 *   already `YYYY-MM-DD` (from the v1 manual "add schedule" dialog, which
 *   mislabeled its own date format but actually emitted ISO dates from an
 *   `<input type="date">`) - both are accepted.
 * - `free_time` blocks store `day` as a numeric weekday index
 *   (0 = Sunday, matching `moment().format('d')`, which is what the v1
 *   calendar UI used), not a weekday name - converted via `WEEKDAY_INDEX`.
 *
 * A field that doesn't match either expected shape produces a warning and
 * is skipped (the surrounding course/group is still imported) rather than
 * failing the whole import or guessing.
 */

const INDEX_TO_WEEKDAY = Object.fromEntries(
  Object.entries(WEEKDAY_INDEX).map(([day, index]) => [index, day as Weekday]),
) as Record<number, Weekday>;

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

/** Accepts `DD/MM/YYYY` or an already-ISO `YYYY-MM-DD`. */
function normalizeLegacyDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return ddmmyyyyToIso(value);
}

function migrateTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  try {
    return parseHHmm(value);
  } catch {
    return null;
  }
}

interface LegacySchedule {
  schedule_day?: unknown;
  schedule_time?: { start?: unknown; end?: unknown };
  date?: { start?: unknown; end?: unknown };
}

interface LegacyGroup {
  group_id?: unknown;
  parent_course_id?: unknown;
  course_teacher?: unknown;
  group_quota?: unknown;
  classroom?: unknown;
  schedule?: LegacySchedule[];
  disabled?: unknown;
}

interface LegacyCourse {
  course_id?: unknown;
  course_name?: unknown;
  course_credits?: unknown;
  course_groups?: LegacyGroup[];
  color?: unknown;
  requirements?: unknown;
}

interface LegacyBackup {
  id?: unknown;
  name?: unknown;
  courses?: LegacyCourse[];
  configuration?: {
    free_days?: unknown;
    lunch_time?: { start?: unknown; end?: unknown };
    max_courses_per_day?: unknown;
    max_holes_per_day?: unknown;
    range?: { start?: unknown; end?: unknown };
    free_time?: { start?: unknown; end?: unknown; day?: unknown; name?: unknown; color?: unknown; id?: unknown }[];
  };
}

/** Distinguishes a v1 backup (this module's input) from a v2 one (`store/appStore.ts`'s `BackupShape`). */
export function isLegacyV1Backup(value: unknown): value is LegacyBackup {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.courses)) return false;
  return v.courses.length === 0 || v.courses.some((c) => c && typeof c === "object" && "course_id" in c);
}

export interface MigrationResult {
  courses: Course[];
  config: CombinationConfig;
  warnings: ParseWarning[];
}

export function migrateLegacyV1Backup(legacy: LegacyBackup): MigrationResult {
  const warnings: ParseWarning[] = [];

  const courses: Course[] = (legacy.courses ?? []).map((lc) => migrateCourse(lc, warnings));
  const config = migrateConfig(legacy.configuration ?? {}, warnings);

  return { courses, config, warnings };
}

function migrateCourse(lc: LegacyCourse, warnings: ParseWarning[]): Course {
  const id = typeof lc.course_id === "string" ? lc.course_id : String(lc.course_id ?? "");
  const name = typeof lc.course_name === "string" ? lc.course_name : String(lc.course_name ?? "");
  const groups = (lc.course_groups ?? []).map((lg) => migrateGroup(lg, id, warnings));

  return {
    id,
    name,
    credits: toNumber(lc.course_credits, 0),
    color: typeof lc.color === "string" ? lc.color : randomCourseColor(),
    groups,
    requirements: [],
  };
}

function migrateGroup(lg: LegacyGroup, courseId: string, warnings: ParseWarning[]): Group {
  const id = typeof lg.group_id === "string" ? lg.group_id : String(lg.group_id ?? "");
  const slots: ScheduleSlot[] = [];

  for (const s of lg.schedule ?? []) {
    const day = typeof s.schedule_day === "string" ? (s.schedule_day as Weekday) : null;
    const start = migrateTime(s.schedule_time?.start);
    const end = migrateTime(s.schedule_time?.end);
    const validityStart = normalizeLegacyDate(s.date?.start);
    const validityEnd = normalizeLegacyDate(s.date?.end);

    if (!day || start === null || end === null || !validityStart || !validityEnd) {
      warnings.push({
        message: `Grupo "${id}" del curso "${courseId}": se omitió un horario que no se pudo migrar (${JSON.stringify(s)}).`,
      });
      continue;
    }

    const time: TimeRange = { start, end };
    const validity: DateRange = { start: validityStart, end: validityEnd };
    slots.push({ day, time, validity });
  }

  return {
    id,
    parentCourseId: courseId,
    quota: toNumber(lg.group_quota, -1),
    disabled: Boolean(lg.disabled),
    slots,
    ...(typeof lg.course_teacher === "string" && lg.course_teacher ? { teacher: lg.course_teacher } : {}),
  };
}

function migrateConfig(raw: NonNullable<LegacyBackup["configuration"]>, warnings: ParseWarning[]): CombinationConfig {
  const base = defaultCombinationConfig();

  const freeDays = Array.isArray(raw.free_days) ? raw.free_days.filter((d): d is Weekday => typeof d === "string") : base.freeDays;

  const lunchStart = migrateTime(raw.lunch_time?.start);
  const lunchEnd = migrateTime(raw.lunch_time?.end);
  const lunchTime = lunchStart !== null && lunchEnd !== null && !(lunchStart === 0 && lunchEnd === 0) ? { start: lunchStart, end: lunchEnd } : null;

  const rangeStart = migrateTime(raw.range?.start);
  const rangeEnd = migrateTime(raw.range?.end);
  const range = rangeStart !== null && rangeEnd !== null ? { start: rangeStart, end: rangeEnd } : base.range;

  const freeTime: FreeTimeBlock[] = (raw.free_time ?? []).flatMap((f) => {
    const start = migrateTime(f.start);
    const end = migrateTime(f.end);
    const dayIndex = toNumber(f.day, -1);
    const day = INDEX_TO_WEEKDAY[dayIndex];
    if (start === null || end === null || !day) {
      warnings.push({ message: `Se omitió un bloque de tiempo libre que no se pudo migrar (${JSON.stringify(f)}).` });
      return [];
    }
    return [
      {
        id: typeof f.id === "string" ? f.id : crypto.randomUUID(),
        name: typeof f.name === "string" ? f.name : "Tiempo libre",
        color: typeof f.color === "string" ? f.color : "#8B98A5",
        day,
        time: { start, end },
      },
    ];
  });

  return {
    freeDays,
    lunchTime,
    maxCoursesPerDay: toNumber(raw.max_courses_per_day, base.maxCoursesPerDay),
    maxHolesPerDay: toNumber(raw.max_holes_per_day, base.maxHolesPerDay),
    range,
    freeTime,
    minCredits: -1,
    maxCredits: -1,
  };
}
