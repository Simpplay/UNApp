import { randomCourseColor, type Course, type Group, type ScheduleSlot } from "../model/course.js";
import type { DateRange } from "../model/time.js";
import { WEEKDAYS } from "../model/time.js";
import { defaultTermValidity, splitLabGroups } from "../adapters/shared.js";
import type { ParseResult, ParseWarning } from "../adapters/types.js";

/**
 * Universidad Nacional de Colombia - Course Finder API (SIA en vivo).
 *
 * A second, live source for UNAL courses, alongside the pasted-text adapter
 * in `adapters/unal.ts`. Instead of a static export a student pastes by hand,
 * this reads the same offering from `https://d3mq7oen5a8j4f.cloudfront.net/api/course-finder/*`
 * with live seat counts.
 *
 * These are the *wire* shapes returned by the real endpoint, confirmed with
 * live requests during development - not the reference Python client shown
 * to build this (`test_unal_fetch.py`), which has two mismatches against the
 * real API: it reads `total_pages` (the real field is `pagination.totalPages`)
 * and `offering_limits` (the real field is `offering_units`, unused here).
 *
 * `day` here already lines up 1:1 with `WEEKDAY_INDEX` in `model/time.ts`
 * (`sunday: 0 ... saturday: 6`), confirmed against a real group with a
 * Monday/Wednesday schedule (`day: 1` / `day: 3`) - no separate mapping table
 * needed, just `WEEKDAYS[day]`. `start_hour`/`end_hour` are whole hours (no
 * minutes) in every sample seen.
 */

export interface UnalPlan {
  division: string | null;
  typology: string | null;
  level: string | null;
  sede: string | null;
  program: string | null;
  plan_id: string | null;
  plan_name: string | null;
  faculty: string | null;
}

export interface UnalSubjectResult {
  subject_id: string;
  code: string;
  name: string;
  description?: string | null;
  credits: number;
  typologies: string[];
  plans: UnalPlan[];
  is_libre_eleccion: boolean;
  groups_count: number;
  available_seats: number;
  updated_at: string;
  /** Only present when the search was made with `q`: the match with `<mark>` tags. */
  highlight?: string;
}

export interface UnalFacetValue {
  key: string | number;
  count: number;
}

export interface UnalFacets {
  typologies: UnalFacetValue[];
  level: UnalFacetValue[];
  faculty: UnalFacetValue[];
  sede: UnalFacetValue[];
  plan: UnalFacetValue[];
  credits: UnalFacetValue[];
  has_available: UnalFacetValue[];
}

export interface UnalPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UnalSearchResponse {
  results: UnalSubjectResult[];
  facets: UnalFacets;
  pagination: UnalPagination;
}

export interface UnalGroup {
  group_id: string;
  group_identifier: string;
  group_name: string;
  activity_type?: string | null;
  offered_by?: string | null;
  offered_places: number;
  places_taken: number;
  available_places: number;
  updated_at: string;
}

export interface UnalScheduleEntry {
  group_id: string;
  professor?: string | null;
  location?: string | null;
  day: number;
  start_hour: number;
  end_hour: number;
  updated_at: string;
}

export interface UnalSubjectFilters {
  typologies?: string[];
  level?: string[];
  faculty?: string[];
  sede?: string[];
  plan?: string[];
  credits?: number[];
  has_available?: boolean;
}

function isLabActivity(activityType: string | null | undefined): boolean {
  return Boolean(activityType && /laborator/i.test(activityType));
}

/** Maps one live UNAL group + its schedule entries into a domain `Group`. */
export function mapUnalGroup(
  parentCourseId: string,
  group: UnalGroup,
  schedule: UnalScheduleEntry[],
  defaultValidity: DateRange,
): { group: Group; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = [];
  const slots: ScheduleSlot[] = [];

  for (const entry of schedule) {
    const day = WEEKDAYS[entry.day];
    if (!day) {
      warnings.push({
        message: `Grupo ${group.group_identifier}: día de horario desconocido (${entry.day}).`,
      });
      continue;
    }
    const slot: ScheduleSlot = {
      day,
      time: { start: entry.start_hour * 60, end: entry.end_hour * 60 },
      validity: defaultValidity,
    };
    if (entry.location) slot.classroom = entry.location;
    slots.push(slot);
  }

  const professor = schedule.find((s) => s.professor && s.professor.trim())?.professor?.trim();

  const mapped: Group = {
    id: group.group_identifier,
    parentCourseId,
    quota: group.available_places,
    disabled: false,
    slots,
    isLab: isLabActivity(group.activity_type),
  };
  if (professor) mapped.teacher = professor;

  return { group: mapped, warnings };
}

/**
 * Maps one subject search result + its live groups/schedules into
 * `Course[]` - a plural result because, same as the pasted-text adapter,
 * a subject with more than 3 lab groups gets split into a lecture course and
 * a synthetic "- Laboratorio" sibling by `splitLabGroups`.
 *
 * `groups` should already be filtered to whatever the caller wants included
 * (e.g. the groups the user left checked in the search UI) - this function
 * has no concept of group selection, only of mapping.
 */
export function mapUnalSubjectToCourse(
  subject: UnalSubjectResult,
  groups: UnalGroup[],
  schedulesByGroupId: Record<string, UnalScheduleEntry[]>,
  options: { defaultValidity?: DateRange } = {},
): ParseResult {
  const defaultValidity = options.defaultValidity ?? defaultTermValidity();
  const warnings: ParseWarning[] = [];

  const mappedGroups: Group[] = [];
  for (const g of groups) {
    const { group, warnings: groupWarnings } = mapUnalGroup(
      subject.code,
      g,
      schedulesByGroupId[g.group_id] ?? [],
      defaultValidity,
    );
    mappedGroups.push(group);
    warnings.push(...groupWarnings);
  }

  const draft: Course = {
    id: subject.code,
    name: subject.name,
    credits: subject.credits,
    color: randomCourseColor(),
    groups: mappedGroups,
    requirements: [],
  };

  return { courses: splitLabGroups(draft), warnings };
}
