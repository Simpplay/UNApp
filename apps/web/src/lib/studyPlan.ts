import type { Course } from "@unapp/core";

/**
 * Groups courses into levels by prerequisite depth, using only the
 * requirements that resolve to another course already in the same list.
 *
 * This is a deliberately narrower port of the legacy
 * `topologicalSortCoursesBySemester` (`planner.js` in the v1): that version
 * (a) mutated the array it was iterating over by pushing synthetic
 * placeholder courses for unresolved prerequisites mid-loop, and (b) had no
 * cycle guard, so a bad requirements graph (A requires B, B requires A)
 * would recurse forever. Here, a prerequisite that isn't one of the
 * caller's own courses is simply not counted towards the level (the level
 * means "how many of my own selected courses come before this one", not
 * the true official semester number - there's no full curriculum to check
 * against), and a cycle just stops recursing instead of fabricating data
 * or hanging.
 */
export function groupCoursesByLevel(courses: readonly Course[]): Course[][] {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const byNameLower = new Map(courses.map((c) => [c.name.toLowerCase(), c]));
  const level = new Map<string, number>();
  const visiting = new Set<string>();

  function resolve(courseId: string, courseName: string): Course | undefined {
    return byId.get(courseId) ?? byNameLower.get(courseName.toLowerCase());
  }

  function levelOf(course: Course): number {
    const cached = level.get(course.id);
    if (cached !== undefined) return cached;
    if (visiting.has(course.id)) return 0; // cycle: don't recurse further, treat as a root for this branch

    visiting.add(course.id);
    let max = -1;
    for (const req of course.requirements) {
      const prereq = resolve(req.courseId, req.courseName);
      if (prereq && prereq.id !== course.id) {
        max = Math.max(max, levelOf(prereq));
      }
    }
    visiting.delete(course.id);

    const result = max + 1;
    level.set(course.id, result);
    return result;
  }

  const groups: Course[][] = [];
  for (const course of courses) {
    const l = levelOf(course);
    const bucket = groups[l] ?? [];
    bucket.push(course);
    groups[l] = bucket;
  }
  return groups.filter((g): g is Course[] => Boolean(g));
}
