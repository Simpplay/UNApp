import type { UnalGroup, UnalScheduleEntry, UnalSearchResponse, UnalSubjectFilters } from "@unapp/core";

/**
 * Network layer for the UNAL Course Finder API - the live counterpart to
 * pasting a SIA export into `ImportTextPanel`. This is the only place that
 * knows the actual URLs; `@unapp/core`'s `live/unal.ts` only knows how to map
 * the JSON shapes into domain objects, and never touches the network.
 *
 * CORS was confirmed open (`access-control-allow-origin: *`) directly against
 * the endpoint, so this calls it straight from the browser - no proxy needed
 * even on the static GitHub Pages deploy.
 */

const BASE = "https://d3mq7oen5a8j4f.cloudfront.net/api/course-finder";

export type UnalLiveResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function getJson<T>(url: string): Promise<UnalLiveResult<T>> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { ok: false, error: `Error HTTP ${response.status} al consultar la oferta de la UNAL.` };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, error: "No se pudo conectar con la oferta en vivo de la UNAL." };
  }
}

export interface SearchUnalSubjectsParams {
  q?: string;
  filters?: UnalSubjectFilters;
  page?: number;
  limit?: number;
}

export function searchUnalSubjects(params: SearchUnalSubjectsParams): Promise<UnalLiveResult<UnalSearchResponse>> {
  const search = new URLSearchParams({
    filters: JSON.stringify(params.filters ?? {}),
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
    sort: "relevance",
  });
  if (params.q?.trim()) search.set("q", params.q.trim());
  return getJson<UnalSearchResponse>(`${BASE}/search/subjects?${search.toString()}`);
}

export function fetchUnalGroups(subjectId: string): Promise<UnalLiveResult<UnalGroup[]>> {
  return getJson<UnalGroup[]>(`${BASE}/subjects/${encodeURIComponent(subjectId)}/groups`);
}

export function fetchUnalSchedule(
  groupId: string,
  subjectId: string,
): Promise<UnalLiveResult<UnalScheduleEntry[]>> {
  const search = new URLSearchParams({ subject_id: subjectId });
  return getJson<UnalScheduleEntry[]>(`${BASE}/groups/${encodeURIComponent(groupId)}/schedule?${search.toString()}`);
}

/** Runs `items` through `task` with at most `limit` in flight at once. */
async function mapWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index] as T);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export interface GroupsWithSchedules {
  groups: UnalGroup[];
  schedulesByGroupId: Record<string, UnalScheduleEntry[]>;
  /** Groups whose schedule failed to load - still included in `groups`, just with no slots. */
  failedGroupIds: string[];
}

/**
 * Fetches every group of a subject, then every group's schedule in parallel
 * (capped concurrency - a subject can have 30+ groups, e.g. a large Bogotá
 * "Cálculo Diferencial" section had 36, and firing that many requests at
 * once would hammer both the API and the browser for no benefit).
 */
export async function fetchGroupsWithSchedules(
  subjectId: string,
  concurrency = 5,
): Promise<UnalLiveResult<GroupsWithSchedules>> {
  const groupsResult = await fetchUnalGroups(subjectId);
  if (!groupsResult.ok) return groupsResult;

  const groups = groupsResult.data;
  const schedulesByGroupId: Record<string, UnalScheduleEntry[]> = {};
  const failedGroupIds: string[] = [];

  await mapWithConcurrencyLimit(groups, concurrency, async (g) => {
    const result = await fetchUnalSchedule(g.group_id, subjectId);
    if (result.ok) {
      schedulesByGroupId[g.group_id] = result.data;
    } else {
      failedGroupIds.push(g.group_id);
    }
  });

  return { ok: true, data: { groups, schedulesByGroupId, failedGroupIds } };
}
