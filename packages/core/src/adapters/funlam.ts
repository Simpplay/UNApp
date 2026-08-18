import { randomCourseColor, type Group, type ScheduleSlot } from "../model/course.js";
import type { DateRange, Weekday } from "../model/time.js";
import { ddmmyyyyToIso, defaultTermValidity } from "./shared.js";
import type { ParseResult, ParseWarning, UniversityAdapter } from "./types.js";

/**
 * Fundación Universitaria Luis Amigó ("mis cursos matriculados" export).
 *
 * Unlike UNAL/UdeA (a catalog of every offered group to choose from),
 * FUNLAM's export is a TAB-separated table of the courses the student is
 * ALREADY enrolled in - there is only ever one fixed section per course, so
 * this source has no group choice to make. It is still routed through the
 * same Course/Group/ScheduleSlot model (each course gets exactly one
 * synthetic group) so the rest of the app - the calendar, PNG/ICS export -
 * works unmodified; the combination generator simply has nothing to choose
 * between for a FUNLAM course.
 *
 * Expected row shapes (columns are TAB-separated):
 *
 *   <seq>\t<course_id>\t<course_name>\t<col2>\t<credits>\t...   (course header row)
 *   ...\tLUN\t<start_date>\t<end_date>\t<start_time>\t<end_time>\t...   (one row per weekday met)
 *
 * Quota, classroom and teacher are not present in this export in the legacy
 * DSL (they were hardcoded to placeholder values); left unset here rather
 * than faked. Column 2 of the course row is unidentified in the legacy DSL
 * (skipped there too) - flagged for validation against a fresh real export,
 * same as the other two adapters.
 */

const DAY_TOKEN: Record<string, Weekday> = {
  LUN: "monday",
  MAR: "tuesday",
  MIE: "wednesday",
  JUE: "thursday",
  VIE: "friday",
  SAB: "saturday",
  DOM: "sunday",
};

const COURSE_ROW = /^\d+\t(.+)$/;
const END_MARKER = "Cursos matriculados";

function safeParseHHmm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

interface DraftCourse {
  id: string;
  name: string;
  credits: number;
  group: Group;
}

export function parseFunlam(rawText: string, options: { defaultValidity?: DateRange } = {}): ParseResult {
  const fallbackValidity = options.defaultValidity ?? defaultTermValidity();
  const warnings: ParseWarning[] = [];
  const drafts: DraftCourse[] = [];

  const lines = rawText.split(/\r?\n/);
  let current: DraftCourse | null = null;
  let sequence = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;
    if (!line.trim()) continue;
    if (line.trim() === END_MARKER) break;

    const courseMatch = COURSE_ROW.exec(line);
    if (courseMatch) {
      const fields = (courseMatch[1] as string).split("\t");
      const id = (fields[0] ?? "").trim();
      const name = (fields[1] ?? "").trim();
      const credits = Number(fields[3] ?? 0) || 0;
      if (!id || !name) {
        warnings.push({ message: `Fila de curso incompleta: "${line}"`, line: i });
        continue;
      }
      sequence += 1;
      current = {
        id,
        name,
        credits,
        group: {
          id: `${id}-${sequence}`,
          parentCourseId: id,
          quota: -1,
          disabled: false,
          slots: [],
        },
      };
      drafts.push(current);
      continue;
    }

    if (!current) continue;

    const dayEntry = Object.entries(DAY_TOKEN).find(([token]) => line.includes(`\t${token}\t`));
    if (dayEntry) {
      const [token, day] = dayEntry;
      const after = line.split(`\t${token}\t`).slice(-1)[0] ?? "";
      const fields = after.split("\t");
      const dateStart = ddmmyyyyToIso((fields[0] ?? "").trim());
      const dateEnd = ddmmyyyyToIso((fields[1] ?? "").trim());
      const timeStart = safeParseHHmm(fields[2] ?? "");
      const timeEnd = safeParseHHmm(fields[3] ?? "");

      if (timeStart === null || timeEnd === null) {
        warnings.push({ message: `No se pudo leer horario de "${current.name}" (${day}): "${line}"`, line: i });
        continue;
      }

      const slot: ScheduleSlot = {
        day,
        time: { start: timeStart, end: timeEnd },
        validity: dateStart && dateEnd ? { start: dateStart, end: dateEnd } : fallbackValidity,
      };
      current.group.slots.push(slot);
    }
  }

  const courses = drafts.map((draft) => ({
    id: draft.id,
    name: draft.name,
    credits: draft.credits,
    color: randomCourseColor(),
    groups: [draft.group],
    requirements: [],
  }));

  return { courses, warnings };
}

export const funlamAdapter: UniversityAdapter = {
  id: "funlam",
  name: "Fundación Universitaria Luis Amigó",
  parse: (text) => parseFunlam(text),
};
