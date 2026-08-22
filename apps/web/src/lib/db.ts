import Dexie, { type Table } from "dexie";
import type { CombinationConfig, Course, Group } from "@unapp/core";

export interface PinnedCombination {
  id: string;
  label: string;
  score: number;
  groups: Group[];
}

/**
 * What actually gets persisted per university. Unlike the legacy app (which
 * serialized live class instances into `localStorage` strings and had to be
 * carefully reconstructed field-by-field on load), everything here is plain,
 * already-JSON-safe data straight from `@unapp/core` - IndexedDB via Dexie
 * stores it directly, with no 5MB `localStorage` ceiling and no manual
 * (de)serialization glue.
 */
/** Tracks a course that came from the UNAL live search, so it can be refreshed later. */
export interface LiveCourseLink {
  subjectId: string;
  /** The API's `code` for the subject - the id of the lecture course (a lab sibling gets a `-lab` suffix locally). */
  subjectCode: string;
  subjectUpdatedAt: string;
  /** group id -> `updated_at` reported by the API for that group's last fetch. */
  groupUpdatedAt: Record<string, string>;
}

export interface StoredUniversity {
  id: string;
  name: string;
  isManual: boolean;
  courses: Course[];
  config: CombinationConfig;
  pinned: PinnedCombination[];
  /** course id -> live source link, only set for courses added via the UNAL live search. */
  liveLinks?: Record<string, LiveCourseLink>;
}

class UnappDatabase extends Dexie {
  universities!: Table<StoredUniversity, string>;

  constructor() {
    super("unapp");
    this.version(1).stores({
      universities: "id",
    });
  }
}

export const db = new UnappDatabase();
