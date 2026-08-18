import { createCourse } from "@unapp/core";
import { describe, expect, it } from "vitest";
import { groupCoursesByLevel } from "./studyPlan";

describe("groupCoursesByLevel", () => {
  it("puts a course with no requirements at level 0", () => {
    const c = createCourse({ id: "c1", name: "Cálculo I" });
    expect(groupCoursesByLevel([c])).toEqual([[c]]);
  });

  it("puts a course one level after its prerequisite", () => {
    const c1 = createCourse({ id: "c1", name: "Cálculo I" });
    const c2 = createCourse({ id: "c2", name: "Cálculo II", requirements: [{ courseId: "c1", courseName: "Cálculo I" }] });
    const levels = groupCoursesByLevel([c1, c2]);
    expect(levels).toEqual([[c1], [c2]]);
  });

  it("resolves a requirement by name when the id doesn't match any course", () => {
    const c1 = createCourse({ id: "c1", name: "Cálculo I" });
    const c2 = createCourse({
      id: "c2",
      name: "Cálculo II",
      requirements: [{ courseId: "unknown-id", courseName: "Cálculo I" }],
    });
    expect(groupCoursesByLevel([c1, c2])).toEqual([[c1], [c2]]);
  });

  it("ignores a requirement that doesn't resolve to any of the given courses (no fabricated placeholder)", () => {
    const c1 = createCourse({
      id: "c1",
      name: "Cálculo II",
      requirements: [{ courseId: "not-in-list", courseName: "Álgebra Lineal" }],
    });
    expect(groupCoursesByLevel([c1])).toEqual([[c1]]);
  });

  it("does not hang on a requirement cycle", () => {
    const c1 = createCourse({ id: "c1", name: "A", requirements: [{ courseId: "c2", courseName: "B" }] });
    const c2 = createCourse({ id: "c2", name: "B", requirements: [{ courseId: "c1", courseName: "A" }] });
    expect(() => groupCoursesByLevel([c1, c2])).not.toThrow();
  });

  it("takes the deepest prerequisite chain when a course has more than one requirement", () => {
    const c1 = createCourse({ id: "c1", name: "A" });
    const c2 = createCourse({ id: "c2", name: "B", requirements: [{ courseId: "c1", courseName: "A" }] });
    const c3 = createCourse({
      id: "c3",
      name: "C",
      requirements: [
        { courseId: "c1", courseName: "A" },
        { courseId: "c2", courseName: "B" },
      ],
    });
    const levels = groupCoursesByLevel([c1, c2, c3]);
    expect(levels).toEqual([[c1], [c2], [c3]]);
  });
});
