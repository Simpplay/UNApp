import { createCourse } from "@unapp/core";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "./appStore";

const initialState = useAppStore.getState();

beforeEach(() => {
  useAppStore.setState(initialState, true);
});

describe("addManualUniversity", () => {
  it("rejects an empty name or id", () => {
    const result = useAppStore.getState().addManualUniversity("", "");
    expect(result.ok).toBe(false);
  });

  it("rejects an id with characters other than letters/numbers/dashes", () => {
    const result = useAppStore.getState().addManualUniversity("Mi Universidad", "mi universidad!");
    expect(result.ok).toBe(false);
  });

  it("rejects a duplicate id (built-in or manual)", () => {
    const result = useAppStore.getState().addManualUniversity("Otra UNAL", "unal");
    expect(result.ok).toBe(false);
  });

  it("adds a valid manual university and selects it for further actions", () => {
    const result = useAppStore.getState().addManualUniversity("Mi Universidad", "mi-uni");
    expect(result.ok).toBe(true);
    expect(useAppStore.getState().universities.some((u) => u.id === "mi-uni")).toBe(true);
  });
});

describe("addManualCourse / removeCourse / toggleGroupDisabled", () => {
  beforeEach(() => {
    useAppStore.getState().addManualUniversity("Mi Universidad", "mi-uni");
    useAppStore.getState().selectUniversity("mi-uni");
  });

  it("adds a course to the selected university only", () => {
    useAppStore.getState().addManualCourse(createCourse({ id: "c1", name: "Cálculo" }));
    const uni = useAppStore.getState().universities.find((u) => u.id === "mi-uni");
    expect(uni?.courses.map((c) => c.id)).toEqual(["c1"]);
  });

  it("overwrites name/credits of a course with a duplicate id, keeping its groups", () => {
    const first = createCourse({ id: "c1", name: "Cálculo", credits: 3 });
    useAppStore.getState().addManualCourse(first);
    useAppStore.getState().addManualGroup("c1", {
      id: "g1",
      parentCourseId: "c1",
      quota: 5,
      slots: [],
      disabled: false,
    });
    useAppStore.getState().addManualCourse(createCourse({ id: "c1", name: "Cálculo Diferencial", credits: 4 }));
    const uni = useAppStore.getState().universities.find((u) => u.id === "mi-uni");
    expect(uni?.courses).toHaveLength(1);
    expect(uni?.courses[0]?.name).toBe("Cálculo Diferencial");
    expect(uni?.courses[0]?.credits).toBe(4);
    expect(uni?.courses[0]?.groups.map((g) => g.id)).toEqual(["g1"]);
  });

  it("removes a course and clears any generated result", () => {
    useAppStore.getState().addManualCourse(createCourse({ id: "c1", name: "Cálculo" }));
    useAppStore.setState({ generateResult: { combinations: [], blockedCourses: [], truncated: false, totalCredits: 0, creditsWithinLimits: true } });
    useAppStore.getState().removeCourse("c1");
    const uni = useAppStore.getState().universities.find((u) => u.id === "mi-uni");
    expect(uni?.courses).toHaveLength(0);
    expect(useAppStore.getState().generateResult).toBeNull();
  });

  it("toggles a group's disabled flag without touching other groups", () => {
    const course = createCourse({
      id: "c1",
      name: "Cálculo",
      groups: [
        { id: "g1", parentCourseId: "c1", quota: 10, disabled: false, slots: [] },
        { id: "g2", parentCourseId: "c1", quota: 10, disabled: false, slots: [] },
      ],
    });
    useAppStore.getState().addManualCourse(course);
    useAppStore.getState().toggleGroupDisabled("c1", "g1");
    const uni = useAppStore.getState().universities.find((u) => u.id === "mi-uni");
    const groups = uni?.courses[0]?.groups;
    expect(groups?.find((g) => g.id === "g1")?.disabled).toBe(true);
    expect(groups?.find((g) => g.id === "g2")?.disabled).toBe(false);
  });
});

describe("addManualGroup", () => {
  beforeEach(() => {
    useAppStore.getState().addManualUniversity("Mi Universidad", "mi-uni");
    useAppStore.getState().selectUniversity("mi-uni");
    useAppStore.getState().addManualCourse(createCourse({ id: "c1", name: "Cálculo" }));
  });

  it("adds a group with its schedule to the right course", () => {
    const result = useAppStore.getState().addManualGroup("c1", {
      id: "g1",
      parentCourseId: "c1",
      quota: 20,
      disabled: false,
      slots: [{ day: "monday", time: { start: 420, end: 540 }, validity: { start: "2026-01-01", end: "2026-06-01" } }],
    });
    expect(result.ok).toBe(true);
    const course = useAppStore.getState().universities.find((u) => u.id === "mi-uni")?.courses[0];
    expect(course?.groups).toHaveLength(1);
    expect(course?.groups[0]?.slots).toHaveLength(1);
  });

  it("rejects a duplicate group id within the same course", () => {
    useAppStore.getState().addManualGroup("c1", { id: "g1", parentCourseId: "c1", quota: 20, disabled: false, slots: [] });
    const result = useAppStore.getState().addManualGroup("c1", { id: "g1", parentCourseId: "c1", quota: 5, disabled: false, slots: [] });
    expect(result.ok).toBe(false);
  });

  it("rejects when the course does not exist", () => {
    const result = useAppStore.getState().addManualGroup("nope", { id: "g1", parentCourseId: "nope", quota: 20, disabled: false, slots: [] });
    expect(result.ok).toBe(false);
  });
});

describe("exportBackup / importBackup", () => {
  beforeEach(() => {
    useAppStore.getState().addManualUniversity("Mi Universidad", "mi-uni");
    useAppStore.getState().selectUniversity("mi-uni");
  });

  it("returns null when nothing is selected", () => {
    useAppStore.getState().selectUniversity("");
    useAppStore.setState({ selectedUniversityId: null });
    expect(useAppStore.getState().exportBackup()).toBeNull();
  });

  it("round-trips courses through export -> import into a different university", () => {
    useAppStore.getState().addManualCourse(createCourse({ id: "c1", name: "Cálculo", credits: 4 }));
    const json = useAppStore.getState().exportBackup();
    expect(json).not.toBeNull();

    useAppStore.getState().addManualUniversity("Otra", "otra-uni");
    useAppStore.getState().selectUniversity("otra-uni");
    const result = useAppStore.getState().importBackup(json as string);
    expect(result.ok).toBe(true);
    const otra = useAppStore.getState().universities.find((u) => u.id === "otra-uni");
    expect(otra?.courses.map((c) => c.id)).toEqual(["c1"]);
  });

  it("does not duplicate a course that already exists by id", () => {
    useAppStore.getState().addManualCourse(createCourse({ id: "c1", name: "Cálculo" }));
    const json = useAppStore.getState().exportBackup() as string;
    useAppStore.getState().importBackup(json);
    const uni = useAppStore.getState().universities.find((u) => u.id === "mi-uni");
    expect(uni?.courses).toHaveLength(1);
  });

  it("rejects invalid JSON", () => {
    const result = useAppStore.getState().importBackup("not json");
    expect(result.ok).toBe(false);
  });

  it("rejects a JSON document that isn't a backup shape", () => {
    const result = useAppStore.getState().importBackup(JSON.stringify({ hello: "world" }));
    expect(result.ok).toBe(false);
  });

  it("migrates a legacy unapp-old (v1) export instead of rejecting it", () => {
    const legacy = {
      id: "unal",
      name: "UNAL",
      configuration: { free_days: [], lunch_time: { start: "12:00", end: "13:00" }, range: { start: "07:00", end: "20:00" } },
      courses: [
        {
          course_id: "c1",
          course_name: "Cálculo",
          course_credits: "4",
          course_groups: [
            {
              group_id: "1",
              group_quota: "10",
              schedule: [
                {
                  schedule_day: "monday",
                  schedule_time: { start: "07:00", end: "09:00" },
                  date: { start: "01/02/2026", end: "30/05/2026" },
                },
              ],
            },
          ],
        },
      ],
    };
    const result = useAppStore.getState().importBackup(JSON.stringify(legacy));
    expect(result.ok).toBe(true);
    const uni = useAppStore.getState().universities.find((u) => u.id === "mi-uni");
    expect(uni?.courses[0]?.id).toBe("c1");
    expect(uni?.courses[0]?.groups[0]?.quota).toBe(10);
  });
});

describe("goToCombination", () => {
  it("wraps around in both directions", () => {
    useAppStore.setState({
      generateResult: {
        combinations: [
          { groups: [], score: 0, details: { lunchOverlaps: 0, freeDayHits: 0, outOfRangeHits: 0, freeTimeHits: 0, excessHoleDays: [], excessCourseDays: [] } },
          { groups: [], score: 0, details: { lunchOverlaps: 0, freeDayHits: 0, outOfRangeHits: 0, freeTimeHits: 0, excessHoleDays: [], excessCourseDays: [] } },
        ],
        blockedCourses: [],
        truncated: false,
        totalCredits: 0,
        creditsWithinLimits: true,
      },
      currentIndex: 0,
    });
    useAppStore.getState().goToCombination(-1);
    expect(useAppStore.getState().currentIndex).toBe(1);
    useAppStore.getState().goToCombination(1);
    expect(useAppStore.getState().currentIndex).toBe(0);
  });
});
