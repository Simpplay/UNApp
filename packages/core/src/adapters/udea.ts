import { randomCourseColor, type Group, type ScheduleSlot } from "../model/course.js";
import type { DateRange, Weekday } from "../model/time.js";
import { defaultTermValidity } from "./shared.js";
import type { ParseResult, ParseWarning, UniversityAdapter } from "./types.js";

/**
 * Universidad de Antioquia (SIA "consulta de horarios" export).
 *
 * Ported from the legacy `udea.unapp` instruction set. Expected shape:
 *
 *   Materia: [1503123] Cálculo Vectorial y Series
 *   GRUPO: 3
 *   HORARIO: LMV 7-9
 *   CUPO DISPONIBLE: 18
 *   PROFESOR(ES): Julian Restrepo
 *
 * `HORARIO:` may carry a second, semicolon-separated segment for a group
 * that meets at two different day/time combinations (e.g. lecture + lab
 * inside the same group), such as `HORARIO: LMV 7-9;S 8-10`.
 *
 * Two things fixed relative to the legacy DSL:
 * - The old rule captured the teacher into a variable literally named
 *   `group_teacher`, which does not match any recognized field name in the
 *   old app's variable table - the teacher was silently dropped for every
 *   UdeA group. This adapter assigns it to `Group.teacher` directly.
 * - UdeA's course credits were never scraped by the legacy DSL either
 *   (no instruction targets `course_credits`); that gap is preserved
 *   honestly here (`credits: 0`) rather than guessed, and surfaced as a
 *   warning so the UI can prompt the user to fill it in.
 *
 * Assumption flagged for validation: reconstructed from the DSL's regex
 * patterns, not a captured real export. Validate against a fresh paste
 * before trusting in production (see `unal.ts` for the same note).
 */

const DAY_LETTER: Record<string, Weekday> = {
  L: "monday",
  M: "tuesday",
  W: "wednesday",
  J: "thursday",
  V: "friday",
  S: "saturday",
  D: "sunday",
};

interface ScheduleSegment {
  days: Weekday[];
  time: { start: number; end: number };
}

function parseScheduleSegment(segment: string): ScheduleSegment | null {
  const match = /^\s*([LMWJVSD]+)\s*(\d{1,2})-(\d{1,2})\s*$/i.exec(segment);
  if (!match) return null;
  const letters = (match[1] as string).toUpperCase().split("");
  const days = letters.map((l) => DAY_LETTER[l]).filter((d): d is Weekday => Boolean(d));
  if (days.length === 0) return null;
  const startHour = Number(match[2]);
  const endHour = Number(match[3]);
  return { days, time: { start: startHour * 60, end: endHour * 60 } };
}

interface DraftCourse {
  id: string;
  name: string;
  credits: number;
  groups: Group[];
}

export function parseUdea(rawText: string, options: { defaultValidity?: DateRange } = {}): ParseResult {
  const defaultValidity = options.defaultValidity ?? defaultTermValidity();
  const warnings: ParseWarning[] = [];
  const drafts: DraftCourse[] = [];

  const lines = rawText.split(/\r?\n/).map((l) => l.trim());

  let current: DraftCourse | null = null;
  let currentGroup: Group | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;
    if (!line) continue;

    const materiaMatch = /^Materia:\s*\[([^\]]+)\]\s*(.+)$/i.exec(line);
    if (materiaMatch) {
      if (current) drafts.push(current);
      current = { id: (materiaMatch[1] as string).trim(), name: (materiaMatch[2] as string).trim(), credits: 0, groups: [] };
      currentGroup = null;
      warnings.push({
        message: `"${current.name}": UdeA no reporta créditos en este formato de exportación; complétalos manualmente.`,
        line: i,
      });
      continue;
    }
    if (!current) continue;

    const grupoMatch = /^GRUPO:\s*(\S+)/i.exec(line);
    if (grupoMatch) {
      currentGroup = {
        id: grupoMatch[1] as string,
        parentCourseId: current.id,
        quota: -1,
        disabled: false,
        slots: [],
      };
      current.groups.push(currentGroup);
      continue;
    }
    if (!currentGroup) continue;

    const horarioMatch = /^HORARIO:\s*(.+)$/i.exec(line);
    if (horarioMatch) {
      const segments = (horarioMatch[1] as string).split(";");
      for (const rawSegment of segments) {
        if (!rawSegment.trim()) continue;
        const parsed = parseScheduleSegment(rawSegment);
        if (!parsed) {
          warnings.push({ message: `No se pudo leer horario: "${rawSegment}"`, line: i });
          continue;
        }
        for (const day of parsed.days) {
          const slot: ScheduleSlot = { day, time: parsed.time, validity: defaultValidity };
          currentGroup.slots.push(slot);
        }
      }
      continue;
    }

    const quotaMatch = /CUPO DISPONIBLE:\s*(-?\d+)/i.exec(line);
    if (quotaMatch) {
      currentGroup.quota = Number(quotaMatch[1]);
      continue;
    }

    const teacherMatch = /PROFESOR\(ES\):\s*(.+)$/i.exec(line);
    if (teacherMatch) {
      currentGroup.teacher = (teacherMatch[1] as string).trim();
      continue;
    }
  }
  if (current) drafts.push(current);

  const courses = drafts.map((draft) => ({
    id: draft.id,
    name: draft.name,
    credits: draft.credits,
    color: randomCourseColor(),
    groups: draft.groups,
    requirements: [],
  }));

  return { courses, warnings };
}

export const udeaAdapter: UniversityAdapter = {
  id: "udea",
  name: "Universidad de Antioquia",
  parse: (text) => parseUdea(text),
};
