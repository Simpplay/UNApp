import type { Group } from "../model/course.js";
import { WEEKDAY_INDEX, type MinutesOfDay, type Weekday } from "../model/time.js";

/**
 * Exports a combination to iCalendar (.ics), importable into Google
 * Calendar, Outlook or Apple Calendar - the legacy app could only export a
 * PNG screenshot of the calendar.
 *
 * Each weekly meeting becomes one `VEVENT` with a `RRULE:FREQ=WEEKLY;UNTIL=`
 * bounded by the slot's own validity window (so a lab that only runs half
 * the term doesn't show up on the calendar for the other half). Times are
 * emitted as floating (no timezone/UTC suffix) local time, which every
 * mainstream calendar app imports using the device's current timezone -
 * simple and correct for the common case of "my own university's local
 * time", at the cost of not handling students viewing the ICS from a
 * different timezone than the one they generated it in.
 */
export function combinationToIcs(
  groups: readonly Group[],
  courseNames: ReadonlyMap<string, string>,
  options: { calendarName?: string } = {},
): string {
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//UNApp//Combinacion//ES"];

  if (options.calendarName) {
    lines.push(`X-WR-CALNAME:${escapeText(options.calendarName)}`);
  }

  for (const group of groups) {
    const courseName = courseNames.get(group.parentCourseId) ?? group.parentCourseId;
    for (const slot of group.slots) {
      const firstOccurrence = nextOrSameWeekday(slot.validity.start, slot.day);
      const dtStart = combineDateAndMinutes(firstOccurrence, slot.time.start);
      const dtEnd = combineDateAndMinutes(firstOccurrence, slot.time.end);
      const until = combineDateAndMinutes(slot.validity.end, slot.time.end);

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${group.id}-${slot.day}-${slot.time.start}@unapp`);
      lines.push(`SUMMARY:${escapeText(`${courseName} - ${group.id}`)}`);
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
      lines.push(`RRULE:FREQ=WEEKLY;UNTIL=${until}`);
      if (slot.classroom) lines.push(`LOCATION:${escapeText(slot.classroom)}`);
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function nextOrSameWeekday(isoDate: string, weekday: Weekday): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const diff = (WEEKDAY_INDEX[weekday] - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + diff);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function combineDateAndMinutes(isoDate: string, minutes: MinutesOfDay): string {
  const [y, m, d] = isoDate.split("-") as [string, string, string];
  const hh = pad2(Math.floor(minutes / 60));
  const mm = pad2(minutes % 60);
  return `${y}${m}${d}T${hh}${mm}00`;
}

function escapeText(value: string): string {
  return value.replace(/([,;])/g, "\\$1");
}
