import { describe, expect, it } from "vitest";
import { isLegacyV1Backup, migrateLegacyV1Backup } from "./fromLegacyV1.js";

const legacyBackup = {
  id: "unal",
  name: "Universidad Nacional de Colombia",
  configuration: {
    free_days: ["saturday"],
    lunch_time: { start: "12:00", end: "13:00" },
    max_courses_per_day: -1,
    max_holes_per_day: -1,
    range: { start: "07:00", end: "20:00" },
    free_time: [{ start: "08:00", end: "09:00", day: "1", name: "Gimnasio", color: "#ff0000", id: "ft-1" }],
  },
  courses: [
    {
      course_name: "Cálculo Diferencial",
      course_id: "1000003",
      course_credits: "4", // v1 often stored this as a string from a text input
      color: "#4C6FFF",
      course_groups: [
        {
          parent_course_id: "1000003",
          group_id: "1",
          course_teacher: "Ana Ruiz",
          group_quota: "15", // also a string
          classroom: "Bl 411",
          disabled: false,
          schedule: [
            {
              schedule_day: "monday",
              schedule_time: { start: "07:00", end: "09:00" },
              date: { start: "01/02/2026", end: "30/05/2026" }, // DD/MM/YYYY, from parsed .unapp text
            },
          ],
        },
        {
          parent_course_id: "1000003",
          group_id: "2",
          course_teacher: "Carlos Gil",
          group_quota: 20, // manually-added groups store a real number
          schedule: [
            {
              schedule_day: "wednesday",
              schedule_time: { start: "10:00", end: "12:00" },
              date: { start: "2026-02-01", end: "2026-05-30" }, // ISO, from the v1 manual "add schedule" dialog
            },
          ],
        },
        {
          parent_course_id: "1000003",
          group_id: "3",
          group_quota: -1,
          schedule: [
            {
              // unparseable time - should be skipped with a warning, not crash the import
              schedule_day: "friday",
              schedule_time: { start: "not-a-time", end: "09:00" },
              date: { start: "01/02/2026", end: "30/05/2026" },
            },
          ],
        },
      ],
    },
  ],
};

describe("isLegacyV1Backup", () => {
  it("recognizes a v1 backup by its course_id field", () => {
    expect(isLegacyV1Backup(legacyBackup)).toBe(true);
  });

  it("does not misidentify a v2 backup (which uses `id`, not `course_id`)", () => {
    expect(isLegacyV1Backup({ courses: [{ id: "c1", name: "x" }] })).toBe(false);
  });

  it("rejects anything without a courses array", () => {
    expect(isLegacyV1Backup({ hello: "world" })).toBe(false);
  });
});

describe("migrateLegacyV1Backup", () => {
  const result = migrateLegacyV1Backup(legacyBackup);

  it("migrates course id/name/credits, coercing a numeric string", () => {
    const course = result.courses[0];
    expect(course?.id).toBe("1000003");
    expect(course?.name).toBe("Cálculo Diferencial");
    expect(course?.credits).toBe(4);
  });

  it("migrates a group with a string quota and a DD/MM/YYYY schedule date", () => {
    const group = result.courses[0]?.groups.find((g) => g.id === "1");
    expect(group?.teacher).toBe("Ana Ruiz");
    expect(group?.quota).toBe(15);
    expect(group?.slots).toEqual([
      { day: "monday", time: { start: 420, end: 540 }, validity: { start: "2026-02-01", end: "2026-05-30" } },
    ]);
  });

  it("accepts an already-ISO schedule date (from the v1 manual add-schedule dialog)", () => {
    const group = result.courses[0]?.groups.find((g) => g.id === "2");
    expect(group?.slots[0]?.validity).toEqual({ start: "2026-02-01", end: "2026-05-30" });
  });

  it("skips an unparseable schedule entry with a warning instead of failing the whole import", () => {
    const group = result.courses[0]?.groups.find((g) => g.id === "3");
    expect(group?.slots).toEqual([]);
    expect(result.warnings.some((w) => w.message.includes('Grupo "3"'))).toBe(true);
  });

  it("migrates free days and the available range", () => {
    expect(result.config.freeDays).toEqual(["saturday"]);
    expect(result.config.range).toEqual({ start: 7 * 60, end: 20 * 60 });
    expect(result.config.lunchTime).toEqual({ start: 12 * 60, end: 13 * 60 });
  });

  it("converts a free-time block's numeric day index to a weekday name", () => {
    expect(result.config.freeTime).toEqual([
      { id: "ft-1", name: "Gimnasio", color: "#ff0000", day: "monday", time: { start: 8 * 60, end: 9 * 60 } },
    ]);
  });

  it("treats a 00:00-00:00 lunch time as disabled (null), matching v1's convention", () => {
    const noLunch = migrateLegacyV1Backup({
      ...legacyBackup,
      configuration: { ...legacyBackup.configuration, lunch_time: { start: "00:00", end: "00:00" } },
    });
    expect(noLunch.config.lunchTime).toBeNull();
  });
});
