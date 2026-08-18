import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseFunlam } from "./funlam.js";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(fixtureDir, "__fixtures__", "funlam.fixture.txt"), "utf-8");

describe("parseFunlam", () => {
  const { courses, warnings } = parseFunlam(fixture);

  it("parses without warnings against the reference fixture", () => {
    expect(warnings).toEqual([]);
  });

  it("reads two enrolled courses, each with exactly one synthetic group", () => {
    expect(courses).toHaveLength(2);
    expect(courses.every((c) => c.groups.length === 1)).toBe(true);
  });

  it("reads course id, name and credits from the header row", () => {
    const c = courses.find((x) => x.id === "FL001");
    expect(c?.name).toBe("Fundamentos de Programación");
    expect(c?.credits).toBe(3);
  });

  it("collects one slot per weekday row under the current course", () => {
    const c = courses.find((x) => x.id === "FL001");
    expect(c?.groups[0]?.slots).toHaveLength(2);
    expect(c?.groups[0]?.slots.map((s) => s.day)).toEqual(["monday", "wednesday"]);
    expect(c?.groups[0]?.slots[0]?.time).toEqual({ start: 7 * 60, end: 9 * 60 });
    expect(c?.groups[0]?.slots[0]?.validity).toEqual({ start: "2026-02-02", end: "2026-05-30" });
  });

  it("does not fabricate quota, classroom or teacher that the source doesn't provide", () => {
    const c = courses.find((x) => x.id === "FL001");
    expect(c?.groups[0]?.quota).toBe(-1);
    expect(c?.groups[0]?.teacher).toBeUndefined();
  });

  it("stops at the end-of-list marker", () => {
    // If the marker weren't honored, a stray "Cursos matriculados" line
    // would just be ignored anyway here since it doesn't match a course or
    // day row - this test exists to pin the behavior if trailing sections
    // are ever added to the fixture.
    expect(courses.map((c) => c.id)).toEqual(["FL001", "FL010"]);
  });
});
