import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseUdea } from "./udea.js";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(fixtureDir, "__fixtures__", "udea.fixture.txt"), "utf-8");

describe("parseUdea", () => {
  const { courses, warnings } = parseUdea(fixture, {
    defaultValidity: { start: "2026-01-01", end: "2026-06-01" },
  });

  it("reads two courses keyed by their bracketed id", () => {
    expect(courses.map((c) => c.id)).toEqual(["1503123", "1503200"]);
    expect(courses[0]?.name).toBe("Cálculo Vectorial y Series");
  });

  it("expands a single-day HORARIO segment into one slot per letter", () => {
    const calculo = courses.find((c) => c.id === "1503123");
    const g3 = calculo?.groups.find((g) => g.id === "3");
    expect(g3?.slots).toHaveLength(3); // L, M, V
    expect(g3?.slots.map((s) => s.day)).toEqual(["monday", "tuesday", "friday"]);
    expect(g3?.slots[0]?.time).toEqual({ start: 7 * 60, end: 9 * 60 });
  });

  it("expands a two-segment HORARIO (e.g. lecture ; lab) into slots for both", () => {
    const calculo = courses.find((c) => c.id === "1503123");
    const g4 = calculo?.groups.find((g) => g.id === "4");
    expect(g4?.slots).toEqual([
      { day: "thursday", time: { start: 14 * 60, end: 16 * 60 }, validity: { start: "2026-01-01", end: "2026-06-01" } },
      { day: "saturday", time: { start: 8 * 60, end: 10 * 60 }, validity: { start: "2026-01-01", end: "2026-06-01" } },
    ]);
  });

  it("assigns the teacher directly to the group (fixes the legacy group_teacher naming bug)", () => {
    const calculo = courses.find((c) => c.id === "1503123");
    expect(calculo?.groups.find((g) => g.id === "3")?.teacher).toBe("Julian Restrepo");
  });

  it("reads quota, including zero (which the UI treats as a disabled group)", () => {
    const calculo = courses.find((c) => c.id === "1503123");
    expect(calculo?.groups.find((g) => g.id === "4")?.quota).toBe(0);
  });

  it("warns that credits are not present in this export format", () => {
    expect(warnings.some((w) => w.message.includes("créditos"))).toBe(true);
  });
});
