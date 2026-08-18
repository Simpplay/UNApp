import type { Course, Group } from "../model/course.js";
import type { DateRange, MinutesOfDay, TimeRange } from "../model/time.js";

/** Fallback validity window when a source doesn't report explicit start/end dates for a group. */
export function defaultTermValidity(): DateRange {
  const year = new Date().getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-15` };
}

export function ddmmyyyyToIso(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, d, m, y] = match;
  return `${y}-${(m as string).padStart(2, "0")}-${(d as string).padStart(2, "0")}`;
}

const MERIDIEM_TIME = /(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?/i;

/** Parses a single "H:MM a.m./p.m." token into minutes-since-midnight. */
export function parseMeridiemTime(value: string): MinutesOfDay | null {
  const match = MERIDIEM_TIME.exec(value);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = (match[3] as string).toLowerCase();
  if (hours === 12) hours = 0;
  if (meridiem === "p") hours += 12;
  return hours * 60 + minutes;
}

/** Parses "7:00 a.m. a 9:00 a.m." (UNAL's "<start> a <end>" time range format). */
export function parseSpanishTimeRange(value: string): TimeRange | null {
  const parts = value.split(/\sa\s/i);
  if (parts.length !== 2) return null;
  const start = parseMeridiemTime(parts[0] as string);
  const end = parseMeridiemTime(parts[1] as string);
  if (start === null || end === null) return null;
  return { start, end };
}

/** Parses "7:00-9:00" (24h, hyphen-separated - UdeA's schedule format after normalization). */
export function parse24hTimeRange(value: string): TimeRange | null {
  const [startRaw, endRaw] = value.split("-");
  if (!startRaw || !endRaw) return null;
  const startMatch = /^(\d{1,2}):(\d{2})$/.exec(startRaw.trim());
  const endMatch = /^(\d{1,2}):(\d{2})$/.exec(endRaw.trim());
  if (!startMatch || !endMatch) return null;
  return {
    start: Number(startMatch[1]) * 60 + Number(startMatch[2]),
    end: Number(endMatch[1]) * 60 + Number(endMatch[2]),
  };
}

/**
 * Legacy behavior ported from `text_parser.js`: when a course reports more
 * than 3 lab-flagged groups, the lecture and the lab are administratively
 * separate enough (different room, different capacity, sometimes a
 * different teacher) that the old app split them into a synthetic sibling
 * course named "<course> - Laboratorio" / "<id>-lab" instead of merging lab
 * sections into the same course as the lecture sections. Kept here as an
 * explicit, testable step instead of being buried in a stateful global
 * variable list built while parsing.
 */
export function splitLabGroups(source: Course): Course[] {
  const labGroups = source.groups.filter((g) => g.isLab);
  const lectureGroups = source.groups.filter((g) => !g.isLab);

  if (labGroups.length <= 3 || lectureGroups.length === 0) {
    return [source];
  }

  const lab: Course = {
    ...source,
    id: `${source.id}-lab`,
    name: `${source.name} - Laboratorio`,
    groups: labGroups.map((g): Group => ({ ...g, parentCourseId: `${source.id}-lab` })),
  };

  return [{ ...source, groups: lectureGroups }, lab];
}
