import { randomCourseColor, type Group, type ScheduleSlot } from "../model/course.js";
import type { DateRange, Weekday } from "../model/time.js";
import { ddmmyyyyToIso, defaultTermValidity, parseSpanishTimeRange, splitLabGroups } from "./shared.js";
import type { ParseResult, ParseWarning, UniversityAdapter } from "./types.js";

/**
 * Universidad Nacional de Colombia (SIA "oferta de asignaturas" export).
 *
 * Ported from the legacy `unal.unapp` instruction set. The source text is a
 * repeating block per course, per group, of the shape:
 *
 *   Volver
 *   Cálculo Diferencial (1000003)
 *   Créditos: 4
 *   (1000003) Grupo 1 (Requiere aprobar 0 creditos)
 *   Profesor: Juan Perez
 *   CLASE TEORICA
 *   LUNES 7:00 a.m. a 9:00 a.m.
 *   Bl 411 - 214
 *   Fecha: 01/02/2026 - 30/05/2026
 *   Cupos disponibles: 12
 *
 * Assumption flagged for validation: this shape is reconstructed from the
 * regex patterns in `unal.unapp`, not from a captured real export (which
 * would contain another student's registration data). Before trusting this
 * in production, paste one real, fresh export into
 * `unal.fixture.txt` and confirm every course/group/schedule field lands
 * where expected - the fixture test below is the harness for that check.
 */
const DAY_LINE = /^(LUNES|MARTES|MI[ÉE]RCOLES|JUEVES|VIERNES|S[ÁA]BADO|DOMINGO)\s+(.+)$/i;

const DAY_MAP: Record<string, Weekday> = {
  LUNES: "monday",
  MARTES: "tuesday",
  MIERCOLES: "wednesday",
  MIÉRCOLES: "wednesday",
  JUEVES: "thursday",
  VIERNES: "friday",
  SABADO: "saturday",
  SÁBADO: "saturday",
  DOMINGO: "sunday",
};

interface DraftCourse {
  id: string;
  name: string;
  credits: number;
  groups: Group[];
  requirements: { courseId: string; courseName: string }[];
}

export function parseUnal(rawText: string, options: { defaultValidity?: DateRange } = {}): ParseResult {
  const defaultValidity = options.defaultValidity ?? defaultTermValidity();
  const warnings: ParseWarning[] = [];
  const drafts: DraftCourse[] = [];

  const lines = rawText.split(/\r?\n/).map((l) => l.trim());

  let current: DraftCourse | null = null;
  let currentGroup: Group | null = null;
  let currentGroupValidity: DateRange | null = null;
  let pendingClassroomSlot: ScheduleSlot | null = null;
  let excludedProgram = false;
  let inRequirements = false;

  const flushCourse = () => {
    if (current) drafts.push(current);
    current = null;
    currentGroup = null;
    currentGroupValidity = null;
    pendingClassroomSlot = null;
    excludedProgram = false;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;
    if (line === "") continue;

    if (line === "Volver") {
      flushCourse();
      const nameLine = (lines[i + 1] ?? "").trim();
      const match = /^(.*)\s\(([^)]+)\)$/.exec(nameLine);
      if (match) {
        current = { id: match[2] as string, name: (match[1] as string).trim(), credits: 0, groups: [], requirements: [] };
      } else {
        warnings.push({ message: `No se pudo leer nombre/código de curso en: "${nameLine}"`, line: i + 1 });
      }
      continue;
    }

    if (!current) continue;

    const creditsMatch = /^Cr[ée]ditos:\s*(\d+)/i.exec(line);
    if (creditsMatch) {
      current.credits = Number(creditsMatch[1]);
      continue;
    }

    if (/PAET|Peama|PAES/i.test(line)) {
      excludedProgram = true;
      continue;
    }

    if (/¿Todas\?/.test(line)) {
      inRequirements = false;
      continue;
    }

    if (inRequirements) {
      const reqMatch = /^(\d+)\s*[-–]\s*(.+)$/.exec(line);
      if (reqMatch) {
        current.requirements.push({ courseId: reqMatch[1] as string, courseName: (reqMatch[2] as string).trim() });
        continue;
      }
    }

    if (/N[uú]mero asignaturas/i.test(line)) {
      inRequirements = true;
      continue;
    }
    if (/Tipo de prerrequisito implica/i.test(line)) {
      inRequirements = false;
      continue;
    }

    if (line === "CLASE LABORATORIO") {
      if (currentGroup) currentGroup.isLab = true;
      continue;
    }
    if (line === "CLASE TEORICA") {
      if (currentGroup) currentGroup.isLab = false;
      continue;
    }

    const groupMatch = /^\(([^)]+)\)\s*(?:Grupo|L)\s*(\S+)/.exec(line);
    if (groupMatch) {
      excludedProgram = false;
      currentGroupValidity = null;
      currentGroup = {
        id: groupMatch[2] as string,
        parentCourseId: current.id,
        quota: -1,
        disabled: false,
        slots: [],
      };
      current.groups.push(currentGroup);
      continue;
    }

    if (excludedProgram || !currentGroup) continue;

    const teacherMatch = /^Profesor:\s*(.+)$/.exec(line);
    if (teacherMatch) {
      currentGroup.teacher = (teacherMatch[1] as string).trim();
      continue;
    }

    const dateMatch = /^Fecha:\s*(\S+)\s*[-–]\s*(\S+)/.exec(line);
    if (dateMatch) {
      const start = ddmmyyyyToIso(dateMatch[1] as string);
      const end = ddmmyyyyToIso(dateMatch[2] as string);
      if (start && end) {
        currentGroupValidity = { start, end };
      } else {
        warnings.push({ message: `No se pudo leer fecha de vigencia: "${line}"`, line: i });
      }
      continue;
    }

    const quotaMatch = /^Cupos disponibles:\s*(-?\d+)/i.exec(line);
    if (quotaMatch) {
      currentGroup.quota = Number(quotaMatch[1]);
      continue;
    }

    const dayMatch = DAY_LINE.exec(line);
    if (dayMatch) {
      const day = DAY_MAP[(dayMatch[1] as string).toUpperCase()];
      const time = parseSpanishTimeRange(dayMatch[2] as string);
      if (day && time) {
        const slot: ScheduleSlot = {
          day,
          time,
          validity: currentGroupValidity ?? defaultValidity,
        };
        currentGroup.slots.push(slot);
        pendingClassroomSlot = slot;
      } else {
        warnings.push({ message: `No se pudo leer horario: "${line}"`, line: i });
      }
      continue;
    }

    if (pendingClassroomSlot) {
      pendingClassroomSlot.classroom = line;
      pendingClassroomSlot = null;
      continue;
    }
  }
  flushCourse();

  const courses = drafts.flatMap((draft) =>
    splitLabGroups({
      id: draft.id,
      name: draft.name,
      credits: draft.credits,
      color: randomCourseColor(),
      groups: draft.groups,
      requirements: draft.requirements,
    }),
  );

  return { courses, warnings };
}

export const unalAdapter: UniversityAdapter = {
  id: "unal",
  name: "Universidad Nacional de Colombia",
  parse: (text) => parseUnal(text),
};
