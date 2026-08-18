import type { CombinationConfig, Group, MinutesOfDay, Weekday } from "@unapp/core";

export const ROW_MINUTES = 30;
export const ROW_HEIGHT_PX = 24;

export interface HourRange {
  startHour: number;
  endHour: number;
}

/** The visible hour window: widened to fit every scheduled slot and the configured range. */
export function computeHourRange(groups: readonly Group[], config: CombinationConfig): HourRange {
  let min = Math.floor(config.range.start / 60);
  let max = Math.ceil(config.range.end / 60);

  for (const group of groups) {
    for (const slot of group.slots) {
      min = Math.min(min, Math.floor(slot.time.start / 60));
      max = Math.max(max, Math.ceil(slot.time.end / 60));
    }
  }
  for (const block of config.freeTime) {
    min = Math.min(min, Math.floor(block.time.start / 60));
    max = Math.max(max, Math.ceil(block.time.end / 60));
  }

  if (max <= min) max = min + 1;
  return { startHour: min, endHour: max };
}

export function rowCount(range: HourRange): number {
  return ((range.endHour - range.startHour) * 60) / ROW_MINUTES;
}

/** 1-indexed CSS grid row for a given minutes-of-day value, relative to the visible range. */
export function minutesToRow(minutes: MinutesOfDay, range: HourRange): number {
  return Math.round((minutes - range.startHour * 60) / ROW_MINUTES) + 1;
}

export const WEEK_ORDER: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/** Monday-Saturday always shown; Sunday only added when something is actually scheduled on it. */
export function computeVisibleDays(groups: readonly Group[], config: CombinationConfig): Weekday[] {
  const usesSunday =
    groups.some((g) => g.slots.some((s) => s.day === "sunday")) ||
    config.freeTime.some((b) => b.day === "sunday");
  return usesSunday ? WEEK_ORDER : WEEK_ORDER.slice(0, 6);
}
