import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseUnal } from "./unal.js";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(fixtureDir, "__fixtures__", "unal.fixture.txt"), "utf-8");

describe("parseUnal", () => {
  const { courses, warnings } = parseUnal(fixture, {
    defaultValidity: { start: "2026-01-01", end: "2026-06-01" },
  });

  it("parses without warnings against the reference fixture", () => {
    expect(warnings).toEqual([]);
  });

  it("reads course name, id and credits", () => {
    const calculo = courses.find((c) => c.id === "1000003");
    expect(calculo?.name).toBe("Cálculo Diferencial");
    expect(calculo?.credits).toBe(4);
  });

  it("reads group teacher, quota, and both weekly slots with classrooms", () => {
    const calculo = courses.find((c) => c.id === "1000003");
    const g1 = calculo?.groups.find((g) => g.id === "1");
    expect(g1?.teacher).toBe("Ana Ruiz");
    expect(g1?.quota).toBe(15);
    expect(g1?.slots).toHaveLength(2);
    expect(g1?.slots[0]).toMatchObject({
      day: "monday",
      time: { start: 7 * 60, end: 9 * 60 },
      classroom: "Bl 411 - 214",
    });
    expect(g1?.slots[0]?.validity).toEqual({ start: "2026-02-01", end: "2026-05-30" });
  });

  it("correctly converts 12h a.m./p.m. times, including the noon edge case", () => {
    const calculo = courses.find((c) => c.id === "1000003");
    const g2 = calculo?.groups.find((g) => g.id === "2");
    expect(g2?.slots[0]?.time).toEqual({ start: 10 * 60, end: 12 * 60 });
  });

  it("falls back to the provided default validity when no Fecha: line is present", () => {
    const calculo = courses.find((c) => c.id === "1000003");
    const g2 = calculo?.groups.find((g) => g.id === "2");
    expect(g2?.slots[0]?.validity).toEqual({ start: "2026-01-01", end: "2026-06-01" });
  });

  it("splits a course into lecture + lab when it has more than 3 lab groups", () => {
    const lecture = courses.find((c) => c.id === "2016000");
    const lab = courses.find((c) => c.id === "2016000-lab");
    expect(lecture?.groups).toHaveLength(1);
    expect(lab?.name).toBe("Bases de Datos - Laboratorio");
    expect(lab?.groups).toHaveLength(4);
    expect(lab?.groups.every((g) => g.parentCourseId === "2016000-lab")).toBe(true);
  });

  it("reads the prerequisite block", () => {
    const lecture = courses.find((c) => c.id === "2016000");
    expect(lecture?.requirements).toEqual([{ courseId: "8", courseName: "Cálculo Diferencial" }]);
  });
});
