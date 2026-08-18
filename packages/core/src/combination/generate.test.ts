import { describe, expect, it } from "vitest";
import { defaultCombinationConfig } from "../model/combination-config.js";
import { course, group, slot } from "../test-utils.js";
import { generateCombinations } from "./generate.js";

describe("generateCombinations", () => {
  // Regression test for legacy bug #4: a combination with `score === -500`
  // (exactly one overlap) passed the old `score >= -500` filter and was
  // shown to the user as "valid". Here overlap is structurally impossible:
  // the generator never builds a branch that conflicts.
  it("never produces a combination with an internal schedule conflict", () => {
    const courses = [
      course("c1", "Cálculo", [group("c1g1", "c1", [slot("monday", "07:00", "09:00")])]),
      course("c2", "Física", [group("c2g1", "c2", [slot("monday", "08:00", "10:00")])]),
    ];
    const result = generateCombinations(courses);
    expect(result.combinations).toHaveLength(0);
    expect(result.blockedCourses).toHaveLength(0); // both courses individually have groups
  });

  it("finds the non-conflicting combination among several conflicting options", () => {
    const courses = [
      course("c1", "Cálculo", [group("c1g1", "c1", [slot("monday", "07:00", "09:00")])]),
      course("c2", "Física", [
        group("c2g1", "c2", [slot("monday", "08:00", "10:00")]), // conflicts
        group("c2g2", "c2", [slot("tuesday", "08:00", "10:00")]), // free
      ]),
    ];
    const result = generateCombinations(courses);
    expect(result.combinations).toHaveLength(1);
    expect(result.combinations[0]?.groups.map((g) => g.id)).toEqual(["c1g1", "c2g2"]);
  });

  it("reports courses with no available groups instead of silently returning nothing", () => {
    const courses = [
      course("c1", "Cálculo", [group("c1g1", "c1", [], { quota: 0 })]),
      course("c2", "Física", [group("c2g1", "c2", [slot("tuesday", "08:00", "10:00")])]),
    ];
    const result = generateCombinations(courses);
    expect(result.blockedCourses.map((c) => c.id)).toEqual(["c1"]);
    expect(result.combinations).toHaveLength(0);
  });

  it("excludes fully-disabled courses from the requirement entirely", () => {
    const courses = [
      course("c1", "Electiva", [group("c1g1", "c1", [slot("monday", "07:00", "09:00")], { disabled: true })]),
      course("c2", "Física", [group("c2g1", "c2", [slot("tuesday", "08:00", "10:00")])]),
    ];
    const result = generateCombinations(courses);
    expect(result.blockedCourses).toHaveLength(0);
    expect(result.combinations).toHaveLength(1);
    expect(result.combinations[0]?.groups.map((g) => g.parentCourseId)).toEqual(["c2"]);
  });

  it("ranks combinations best score first", () => {
    const config = { ...defaultCombinationConfig(), freeDays: ["saturday" as const] };
    const courses = [
      course("c1", "Curso", [
        group("good", "c1", [slot("monday", "08:00", "09:00")]),
        group("bad", "c1", [slot("saturday", "08:00", "09:00")]),
      ]),
    ];
    const result = generateCombinations(courses, { config });
    expect(result.combinations).toHaveLength(2);
    expect(result.combinations[0]?.groups[0]?.id).toBe("good");
    expect(result.combinations[0]?.score).toBeGreaterThan(result.combinations[1]?.score as number);
  });

  it("reports whether the fixed course selection fits the configured credit limits", () => {
    const courses = [
      course("c1", "Curso A", [group("g1", "c1", [slot("monday", "08:00", "09:00")])], { credits: 4 }),
      course("c2", "Curso B", [group("g2", "c2", [slot("tuesday", "08:00", "09:00")])], { credits: 5 }),
    ];
    const withinLimits = generateCombinations(courses, {
      config: { ...defaultCombinationConfig(), minCredits: -1, maxCredits: 10 },
    });
    expect(withinLimits.totalCredits).toBe(9);
    expect(withinLimits.creditsWithinLimits).toBe(true);

    const overLimit = generateCombinations(courses, {
      config: { ...defaultCombinationConfig(), minCredits: -1, maxCredits: 8 },
    });
    expect(overLimit.creditsWithinLimits).toBe(false);
  });

  it("stays fast and bounded for a realistic course load (no cartesian blow-up)", () => {
    // 8 courses x 6 groups = 6^8 ≈ 1.7M raw combinations if generated naively.
    // With conflict pruning this should resolve near-instantly.
    const courses = Array.from({ length: 8 }, (_, ci) =>
      course(
        `c${ci}`,
        `Curso ${ci}`,
        Array.from({ length: 6 }, (_, gi) => {
          const day = (["monday", "tuesday", "wednesday", "thursday", "friday"] as const)[gi % 5] as
            | "monday"
            | "tuesday"
            | "wednesday"
            | "thursday"
            | "friday";
          const startHour = 7 + ((ci + gi) % 10);
          return group(`c${ci}g${gi}`, `c${ci}`, [
            slot(day, `${String(startHour).padStart(2, "0")}:00`, `${String(startHour + 1).padStart(2, "0")}:00`),
          ]);
        }),
      ),
    );

    const start = performance.now();
    const result = generateCombinations(courses, { maxResults: 2000 });
    const elapsedMs = performance.now() - start;

    expect(elapsedMs).toBeLessThan(2000);
    expect(result.combinations.every((combo) => combo.groups.length === 8)).toBe(true);
  });
});
