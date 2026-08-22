import { describe, expect, it } from "vitest";
import { mapUnalGroup, mapUnalSubjectToCourse, type UnalGroup, type UnalScheduleEntry, type UnalSubjectResult } from "./unal.js";

const VALIDITY = { start: "2026-01-01", end: "2026-06-01" };

function subject(overrides: Partial<UnalSubjectResult> = {}): UnalSubjectResult {
  return {
    subject_id: "16706",
    code: "1000004-B",
    name: "Cálculo diferencial",
    credits: 4,
    typologies: ["Fund. Obligatoria"],
    plans: [],
    is_libre_eleccion: false,
    groups_count: 1,
    available_seats: 50,
    updated_at: "2026-08-21T20:48:22.641Z",
    ...overrides,
  };
}

function apiGroup(overrides: Partial<UnalGroup> = {}): UnalGroup {
  return {
    group_id: "166055",
    group_identifier: "1",
    group_name: "Grupo 1",
    activity_type: "Clase Teórica",
    offered_by: "Sin dato - Bogotá",
    offered_places: 50,
    places_taken: 0,
    available_places: 50,
    updated_at: "2026-08-21T20:48:22.641Z",
    ...overrides,
  };
}

function scheduleEntry(overrides: Partial<UnalScheduleEntry> = {}): UnalScheduleEntry {
  return {
    group_id: "166055",
    professor: "Diana Serrano",
    location: "500-130",
    day: 1,
    start_hour: 7,
    end_hour: 9,
    updated_at: "2026-08-21T20:48:22.641Z",
    ...overrides,
  };
}

describe("mapUnalGroup", () => {
  it("maps day/hour straight through WEEKDAYS, no lookup table needed", () => {
    const { group, warnings } = mapUnalGroup(
      "1000004-B",
      apiGroup(),
      [scheduleEntry({ day: 1 }), scheduleEntry({ day: 3 })],
      VALIDITY,
    );
    expect(warnings).toEqual([]);
    expect(group.slots).toEqual([
      { day: "monday", time: { start: 7 * 60, end: 9 * 60 }, validity: VALIDITY, classroom: "500-130" },
      { day: "wednesday", time: { start: 7 * 60, end: 9 * 60 }, validity: VALIDITY, classroom: "500-130" },
    ]);
  });

  it("takes quota straight from available_places, including the real 0-seats case", () => {
    const { group } = mapUnalGroup("1000004-B", apiGroup({ available_places: 0 }), [scheduleEntry()], VALIDITY);
    expect(group.quota).toBe(0);
  });

  it("skips a slot with an out-of-range day and reports a warning instead of guessing", () => {
    const { group, warnings } = mapUnalGroup(
      "1000004-B",
      apiGroup(),
      [scheduleEntry({ day: 9 })],
      VALIDITY,
    );
    expect(group.slots).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toMatch(/día de horario desconocido/);
  });

  it("flags a group as lab from activity_type", () => {
    const { group } = mapUnalGroup(
      "1000004-B",
      apiGroup({ activity_type: "Clase de Laboratorio" }),
      [scheduleEntry()],
      VALIDITY,
    );
    expect(group.isLab).toBe(true);
  });

  it("omits teacher when every schedule entry has an empty professor", () => {
    const { group } = mapUnalGroup("1000004-B", apiGroup(), [scheduleEntry({ professor: "" })], VALIDITY);
    expect(group.teacher).toBeUndefined();
  });
});

describe("mapUnalSubjectToCourse", () => {
  it("maps subject id/name/credits from the API code, not the internal subject_id", () => {
    const { courses } = mapUnalSubjectToCourse(subject(), [apiGroup()], { "166055": [scheduleEntry()] }, {
      defaultValidity: VALIDITY,
    });
    expect(courses).toHaveLength(1);
    expect(courses[0]).toMatchObject({ id: "1000004-B", name: "Cálculo diferencial", credits: 4 });
    expect(courses[0]?.groups).toHaveLength(1);
    expect(courses[0]?.groups[0]?.id).toBe("1");
  });

  it("splits into lecture + lab when more than 3 groups are labs, same rule as the pasted-text adapter", () => {
    const labGroups = [1, 2, 3, 4].map((n) =>
      apiGroup({ group_id: `lab-${n}`, group_identifier: `L${n}`, activity_type: "Clase de Laboratorio" }),
    );
    const groups = [apiGroup({ group_id: "lec-1", group_identifier: "1" }), ...labGroups];
    const schedules = Object.fromEntries(
      groups.map((g) => [g.group_id, [scheduleEntry({ group_id: g.group_id })]]),
    );

    const { courses } = mapUnalSubjectToCourse(subject(), groups, schedules, { defaultValidity: VALIDITY });

    const lecture = courses.find((c) => c.id === "1000004-B");
    const lab = courses.find((c) => c.id === "1000004-B-lab");
    expect(lecture?.groups).toHaveLength(1);
    expect(lab?.name).toBe("Cálculo diferencial - Laboratorio");
    expect(lab?.groups).toHaveLength(4);
  });

  it("collects warnings from every group instead of dropping them", () => {
    const { warnings } = mapUnalSubjectToCourse(
      subject(),
      [apiGroup()],
      { "166055": [scheduleEntry({ day: 9 })] },
      { defaultValidity: VALIDITY },
    );
    expect(warnings).toHaveLength(1);
  });
});
