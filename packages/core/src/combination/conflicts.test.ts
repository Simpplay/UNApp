import { describe, expect, it } from "vitest";
import { slot } from "../test-utils.js";
import { findConflict, slotsConflict } from "./conflicts.js";

describe("slotsConflict", () => {
  it("does not conflict on different days", () => {
    expect(slotsConflict(slot("monday", "08:00", "09:00"), slot("tuesday", "08:00", "09:00"))).toBe(false);
  });

  it("conflicts on overlapping times the same day", () => {
    expect(slotsConflict(slot("monday", "08:00", "09:30"), slot("monday", "09:00", "10:00"))).toBe(true);
  });

  it("does not conflict on back-to-back times (half-open interval)", () => {
    expect(slotsConflict(slot("monday", "08:00", "09:00"), slot("monday", "09:00", "10:00"))).toBe(false);
  });

  it("does not conflict when validity windows never overlap (e.g. two lab cycles)", () => {
    const a = slot("monday", "08:00", "09:00", { validity: { start: "2026-01-01", end: "2026-02-01" } });
    const b = slot("monday", "08:00", "09:00", { validity: { start: "2026-03-01", end: "2026-04-01" } });
    expect(slotsConflict(a, b)).toBe(false);
  });
});

describe("findConflict", () => {
  it("returns null when nothing conflicts", () => {
    const committed = [slot("monday", "08:00", "09:00")];
    const candidate = [slot("tuesday", "08:00", "09:00")];
    expect(findConflict(committed, candidate)).toBeNull();
  });

  it("returns the conflicting pair", () => {
    const committed = [slot("monday", "08:00", "09:00")];
    const candidate = [slot("monday", "08:30", "10:00")];
    const conflict = findConflict(committed, candidate);
    expect(conflict).not.toBeNull();
  });
});
