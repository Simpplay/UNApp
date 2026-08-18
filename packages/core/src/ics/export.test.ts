import { describe, expect, it } from "vitest";
import { group, slot } from "../test-utils.js";
import { combinationToIcs } from "./export.js";

describe("combinationToIcs", () => {
  it("emits one VEVENT per weekly slot with a bounded RRULE", () => {
    const g = group("g1", "c1", [
      slot("monday", "07:00", "09:00", { validity: { start: "2026-02-02", end: "2026-05-29" } }),
    ]);
    const ics = combinationToIcs([g], new Map([["c1", "Cálculo Diferencial"]]));

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:Cálculo Diferencial - g1");
    // 2026-02-02 is itself a Monday, so the first occurrence is that date.
    expect(ics).toContain("DTSTART:20260202T070000");
    expect(ics).toContain("DTEND:20260202T090000");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;UNTIL=20260529T090000");
  });

  it("advances to the correct weekday when the validity start isn't already on it", () => {
    const g = group("g1", "c1", [
      // 2026-02-02 is a Monday; first Wednesday on/after that is 2026-02-04.
      slot("wednesday", "10:00", "12:00", { validity: { start: "2026-02-02", end: "2026-05-29" } }),
    ]);
    const ics = combinationToIcs([g], new Map());
    expect(ics).toContain("DTSTART:20260204T100000");
  });

  it("includes classroom as LOCATION when present", () => {
    const g = group("g1", "c1", [slot("monday", "07:00", "09:00", { classroom: "Bl 411 - 214" })]);
    const ics = combinationToIcs([g], new Map());
    expect(ics).toContain("LOCATION:Bl 411 - 214");
  });
});
