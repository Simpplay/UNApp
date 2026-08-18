import type { CombinationConfig } from "./combination-config.js";
import type { Course } from "./course.js";

export interface University {
  id: string;
  name: string;
  courses: Course[];
  config: CombinationConfig;
}

export function createUniversity(id: string, name: string, config: CombinationConfig): University {
  return { id, name, courses: [], config };
}
