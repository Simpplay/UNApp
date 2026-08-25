import { randomCourseColor, type Group, type ScheduleSlot } from "../model/course.js";
import type { DateRange, Weekday } from "../model/time.js";
import { ddmmyyyyToIso, defaultTermValidity, parseUnalDayTimeRange, splitLabGroups } from "./shared.js";
import type { ParseResult, ParseWarning, UniversityAdapter } from "./types.js";

/**
 * Universidad Nacional de Colombia (SIA "oferta de asignaturas" export).
 *
 * Originally ported from the legacy `unal.unapp` instruction set as a
 * reconstruction (see `unal.fixture.txt`/`unal.test.ts`), before any real
 * export had been checked against it. That reconstruction assumed 12h
 * "a.m./p.m." day lines and a "CLASE TEORICA"/"CLASE LABORATORIO" marker
 * placed after the group line - both wrong. A real "Información de la
 * asignatura" page (`unal-real.fixture.txt`) instead looks like:
 *
 *   Volver
 *   INTRODUCCIÓN A LA TEORÍA DE GRAFOS (3006900)
 *   Créditos:4
 *   CLASE TEORICA 3006900 (3006900)
 *   (1) Grupo 1
 *   Profesor: Nombre Apellido.
 *   Fecha:27/08/2026 - 17/12/2026
 *   MIÉRCOLES de 08:00 a 10:00.
 *   AULA GENERAL. 43-305. BLOQUE 43. SALON.
 *   Cupos disponibles: 12
 *   Prerrequisitos
 *   Condición 1Tipo M¿Todas? [N]Número asignaturas [1]
 *   3006822CONJUNTOS Y COMBINATORIA
 *
 * i.e. 24h day lines ("de HH:MM a HH:MM."), the class-type marker ahead of
 * the group it applies to, the "¿Todas?"/"Número asignaturas" markers packed
 * onto one line, and unseparated "<id><name>" prerequisite lines. The parser
 * below handles both shapes; keep testing new real exports against
 * `unal-real.fixture.txt` as more course layouts turn up (labs, multiple
 * groups, zero quota, etc. haven't been observed there yet).
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
  let pendingIsLab = false;
  let excludedProgram = false;
  let inRequirements = false;

  const flushCourse = () => {
    if (current) drafts.push(current);
    current = null;
    currentGroup = null;
    currentGroupValidity = null;
    pendingClassroomSlot = null;
    pendingIsLab = false;
    excludedProgram = false;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;
    if (line === "") continue;

    if (line === "Volver") {
      flushCourse();
      const nameLine = (lines[i + 1] ?? "").trim();
      if (nameLine === "") {
        // Trailing/standalone "Volver" nav button (e.g. page footer) - not a course boundary.
        continue;
      }
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

    // Checked before "¿Todas?" because real SIA exports pack both onto one line:
    // "Condición 1Tipo M¿Todas? [N]Número asignaturas [1]".
    if (/N[uú]mero asignaturas/i.test(line)) {
      inRequirements = true;
      continue;
    }
    if (/Tipo de prerrequisito implica/i.test(line)) {
      inRequirements = false;
      continue;
    }
    if (/¿Todas\?/.test(line)) {
      inRequirements = false;
      continue;
    }

    if (inRequirements) {
      // Accepts both "8 - Cálculo Diferencial" and the real export's
      // unseparated "3006822CONJUNTOS Y COMBINATORIA".
      const reqMatch = /^(\d+)\s*[-–]?\s*(.+)$/.exec(line);
      if (reqMatch) {
        current.requirements.push({ courseId: reqMatch[1] as string, courseName: (reqMatch[2] as string).trim() });
        continue;
      }
    }

    if (/^CLASE LABORATORIO\b/.test(line)) {
      pendingIsLab = true;
      if (currentGroup) currentGroup.isLab = true;
      continue;
    }
    if (/^CLASE TEORICA\b/.test(line)) {
      pendingIsLab = false;
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
        isLab: pendingIsLab,
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
      const time = parseUnalDayTimeRange(dayMatch[2] as string);
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
