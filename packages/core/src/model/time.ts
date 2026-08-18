/**
 * Time handling for the scheduling engine.
 *
 * The old app juggled moment.js instances and "HH:mm" strings everywhere,
 * including inside the hot path of combination scoring. Here every schedule
 * time is normalized once (at adapter/parse time) into minutes-since-midnight,
 * a plain number that is cheap to compare and impossible to misparse deep
 * inside a scoring loop.
 */

export const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_INDEX: Record<Weekday, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export const WEEKDAY_LABEL_ES: Record<Weekday, string> = {
  sunday: "Domingo",
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
};

/** Minutes since midnight, e.g. "09:30" -> 570. Always in [0, 1440). */
export type MinutesOfDay = number;

const HHMM = /^(\d{1,2}):(\d{2})$/;

export function parseHHmm(value: string): MinutesOfDay {
  const match = HHMM.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid HH:mm time: "${value}"`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new Error(`Invalid HH:mm time: "${value}"`);
  }
  return hours * 60 + minutes;
}

export function formatHHmm(minutes: MinutesOfDay): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export interface TimeRange {
  start: MinutesOfDay;
  end: MinutesOfDay;
}

/** Half-open interval overlap: [start, end). No off-by-one games with moment(). */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/** ISO calendar date, "YYYY-MM-DD". Kept as a plain string; no Date/moment churn. */
export type IsoDate = string;

export interface DateRange {
  start: IsoDate;
  end: IsoDate;
}
