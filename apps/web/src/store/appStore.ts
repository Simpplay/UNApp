import {
  builtInAdapters,
  defaultCombinationConfig,
  generateCombinations,
  isGroupManuallyDisabled,
  isLegacyV1Backup,
  mapUnalSubjectToCourse,
  migrateLegacyV1Backup,
  type CombinationConfig,
  type Course,
  type GenerateResult,
  type Group,
  type ParseWarning,
  type UnalGroup,
  type UnalScheduleEntry,
  type UnalSubjectResult,
} from "@unapp/core";
import { create } from "zustand";
import { db, type PinnedCombination, type StoredUniversity } from "../lib/db";
import { newId } from "../lib/download";
import { fetchGroupsWithSchedules } from "../lib/unalLiveApi";

function emptyBuiltIns(): StoredUniversity[] {
  return builtInAdapters.map((adapter) => ({
    id: adapter.id,
    name: adapter.name,
    isManual: false,
    courses: [],
    config: defaultCombinationConfig(),
    pinned: [],
  }));
}

interface AppState {
  hydrated: boolean;
  universities: StoredUniversity[];
  selectedUniversityId: string | null;
  generateResult: GenerateResult | null;
  currentIndex: number;
  settingsOpen: boolean;
  compareOpen: boolean;
  lastImportWarnings: ParseWarning[];

  hydrate: () => Promise<void>;
  selectUniversity: (id: string) => void;
  addManualUniversity: (name: string, id: string) => { ok: boolean; error?: string };
  importText: (text: string) => { warnings: ParseWarning[]; added: number };
  addManualCourse: (course: Course) => void;
  addManualGroup: (courseId: string, group: Group) => { ok: boolean; error?: string };
  addLiveCourse: (
    subject: UnalSubjectResult,
    groups: UnalGroup[],
    schedulesByGroupId: Record<string, UnalScheduleEntry[]>,
  ) => { added: number; warnings: ParseWarning[] };
  refreshLiveCourse: (courseId: string) => Promise<{ ok: boolean; error?: string }>;
  refreshAllLiveCourses: () => Promise<void>;
  removeCourse: (courseId: string) => void;
  reorderCourses: (draggedId: string, targetId: string) => void;
  toggleGroupDisabled: (courseId: string, groupId: string) => void;
  updateConfig: (patch: Partial<CombinationConfig>) => void;
  generate: () => void;
  clearCombinations: () => void;
  goToCombination: (delta: number) => void;
  pinCurrent: (label: string) => void;
  unpin: (pinId: string) => void;
  toggleSettings: () => void;
  toggleCompare: () => void;
  exportBackup: () => string | null;
  importBackup: (json: string) => { ok: boolean; error?: string };
}

function selected(state: AppState): StoredUniversity | undefined {
  return state.universities.find((u) => u.id === state.selectedUniversityId);
}

async function persist(u: StoredUniversity): Promise<void> {
  await db.universities.put(u);
}

/** Keeps a group's manual on/off toggle across a live refresh - only its schedule/quota should change. */
function reconcileLiveGroups(existingGroups: Group[], incomingGroups: Group[]): Group[] {
  const existingById = new Map(existingGroups.map((g) => [g.id, g]));
  return incomingGroups.map((g) => {
    const prev = existingById.get(g.id);
    return prev ? { ...g, disabled: prev.disabled } : g;
  });
}

/**
 * Merges freshly-mapped live courses (from `mapUnalSubjectToCourse`) into a
 * university: adds courses that aren't there yet, and for ones that already
 * exist (re-adding the same search result, or refreshing) replaces groups
 * while keeping the course's color/requirements and each group's manual
 * disabled flag. Also records/updates `liveLinks` so the course can be
 * refreshed again later without the caller needing to remember the subject.
 */
function applyLiveCourses(
  uni: StoredUniversity,
  subjectId: string,
  subjectCode: string,
  subjectUpdatedAt: string,
  mappedCourses: Course[],
  groupUpdatedAt: Record<string, string>,
): StoredUniversity {
  let courses = uni.courses;
  const liveLinks = { ...(uni.liveLinks ?? {}) };

  for (const incoming of mappedCourses) {
    const existingIndex = courses.findIndex((c) => c.id === incoming.id);
    if (existingIndex === -1) {
      courses = [...courses, incoming];
    } else {
      const existing = courses[existingIndex] as Course;
      const reconciled: Course = {
        ...incoming,
        color: existing.color,
        requirements:
          existing.requirements.length > 0 ? existing.requirements : incoming.requirements,
        groups: reconcileLiveGroups(existing.groups, incoming.groups),
      };
      courses = courses.map((c, i) => (i === existingIndex ? reconciled : c));
    }

    const prevLink = liveLinks[incoming.id];
    liveLinks[incoming.id] = {
      subjectId,
      subjectCode,
      subjectUpdatedAt,
      groupUpdatedAt: { ...(prevLink?.groupUpdatedAt ?? {}), ...groupUpdatedAt },
    };
  }

  return { ...uni, courses, liveLinks };
}

interface BackupShape {
  courses: Course[];
  config?: CombinationConfig;
  pinned?: PinnedCombination[];
}

function isBackupShape(value: unknown): value is BackupShape {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.courses)) return false;
  return v.courses.every((c) => c && typeof c === "object" && typeof (c as Course).id === "string");
}

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  universities: emptyBuiltIns(),
  selectedUniversityId: null,
  generateResult: null,
  currentIndex: 0,
  settingsOpen: false,
  compareOpen: false,
  lastImportWarnings: [],

  hydrate: async () => {
    const stored = await db.universities.toArray();
    const byId = new Map(stored.map((u) => [u.id, u]));
    const builtIns = emptyBuiltIns().map((u) => byId.get(u.id) ?? u);
    const manual = stored.filter((u) => u.isManual && !builtInAdapters.some((a) => a.id === u.id));
    set({ universities: [...builtIns, ...manual], hydrated: true });
  },

  selectUniversity: (id) => {
    set({ selectedUniversityId: id, generateResult: null, currentIndex: 0 });
  },

  addManualUniversity: (name, id) => {
    const cleanId = id.trim();
    if (!name.trim() || !cleanId) return { ok: false, error: "Nombre e ID son obligatorios." };
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanId)) {
      return { ok: false, error: "El ID solo puede tener letras, números, guiones." };
    }
    if (get().universities.some((u) => u.id === cleanId)) {
      return { ok: false, error: "Ya existe una universidad con ese ID." };
    }
    const university: StoredUniversity = {
      id: cleanId,
      name: name.trim(),
      isManual: true,
      courses: [],
      config: defaultCombinationConfig(),
      pinned: [],
    };
    set((state) => ({ universities: [...state.universities, university] }));
    void persist(university);
    return { ok: true };
  },

  importText: (text) => {
    const state = get();
    const uni = selected(state);
    if (!uni) return { warnings: [], added: 0 };
    const adapter = builtInAdapters.find((a) => a.id === uni.id);
    if (!adapter) {
      return {
        warnings: [
          {
            message:
              "Esta universidad no tiene un formato de importación automática; agrega los cursos manualmente.",
          },
        ],
        added: 0,
      };
    }
    const { courses: parsed, warnings } = adapter.parse(text);
    const existingIds = new Set(uni.courses.map((c) => c.id));
    const toAdd = parsed.filter((c) => !existingIds.has(c.id));
    const skipped = parsed.length - toAdd.length;
    const nextCourses = [...uni.courses, ...toAdd];
    const nextUni: StoredUniversity = { ...uni, courses: nextCourses };
    set((s) => ({
      universities: s.universities.map((u) => (u.id === uni.id ? nextUni : u)),
      lastImportWarnings: warnings,
    }));
    void persist(nextUni);
    return {
      warnings:
        skipped > 0
          ? [...warnings, { message: `${skipped} curso(s) ya existían y no se duplicaron.` }]
          : warnings,
      added: toAdd.length,
    };
  },

  addManualCourse: (course) => {
    const state = get();
    const uni = selected(state);
    if (!uni) return;
    const existingIndex = uni.courses.findIndex((c) => c.id === course.id);
    const nextCourses =
      existingIndex === -1
        ? [...uni.courses, course]
        : uni.courses.map((c, i) =>
            i === existingIndex ? { ...c, name: course.name, credits: course.credits } : c,
          );
    const nextUni: StoredUniversity = { ...uni, courses: nextCourses };
    set((s) => ({ universities: s.universities.map((u) => (u.id === uni.id ? nextUni : u)) }));
    void persist(nextUni);
  },

  addManualGroup: (courseId, group) => {
    const state = get();
    const uni = selected(state);
    if (!uni) return { ok: false, error: "Selecciona una universidad." };
    const course = uni.courses.find((c) => c.id === courseId);
    if (!course) return { ok: false, error: "Curso no encontrado." };
    if (course.groups.some((g) => g.id === group.id)) {
      return { ok: false, error: "Ya existe un grupo con ese ID en este curso." };
    }
    const nextCourses = uni.courses.map((c) =>
      c.id === courseId ? { ...c, groups: [...c.groups, group] } : c,
    );
    const nextUni: StoredUniversity = { ...uni, courses: nextCourses };
    set((s) => ({ universities: s.universities.map((u) => (u.id === uni.id ? nextUni : u)) }));
    void persist(nextUni);
    return { ok: true };
  },

  addLiveCourse: (subject, groups, schedulesByGroupId) => {
    const state = get();
    const uni = selected(state);
    if (!uni) return { added: 0, warnings: [] };

    const { courses: mapped, warnings } = mapUnalSubjectToCourse(
      subject,
      groups,
      schedulesByGroupId,
    );
    const groupUpdatedAt = Object.fromEntries(
      groups.map((g) => [g.group_identifier, g.updated_at]),
    );
    const nextUni = applyLiveCourses(
      uni,
      subject.subject_id,
      subject.code,
      subject.updated_at,
      mapped,
      groupUpdatedAt,
    );

    set((s) => ({ universities: s.universities.map((u) => (u.id === uni.id ? nextUni : u)) }));
    void persist(nextUni);
    return { added: mapped.length, warnings };
  },

  refreshLiveCourse: async (courseId) => {
    const uni = selected(get());
    const link = uni?.liveLinks?.[courseId];
    if (!uni || !link) return { ok: false, error: "Este curso no viene de la búsqueda en vivo." };

    const result = await fetchGroupsWithSchedules(link.subjectId);
    if (!result.ok) return { ok: false, error: result.error };

    const existing = uni.courses.find((c) => c.id === link.subjectCode);
    const subjectUpdatedAt = new Date().toISOString();
    const subject: UnalSubjectResult = {
      subject_id: link.subjectId,
      code: link.subjectCode,
      name: existing?.name ?? courseId,
      credits: existing?.credits ?? 0,
      typologies: [],
      plans: [],
      is_libre_eleccion: false,
      groups_count: result.data.groups.length,
      available_seats: result.data.groups.reduce((sum, g) => sum + g.available_places, 0),
      updated_at: subjectUpdatedAt,
    };
    const { courses: mapped } = mapUnalSubjectToCourse(
      subject,
      result.data.groups,
      result.data.schedulesByGroupId,
    );
    const groupUpdatedAt = Object.fromEntries(
      result.data.groups.map((g) => [g.group_identifier, g.updated_at]),
    );

    const latestUni = selected(get());
    if (!latestUni) return { ok: false, error: "La universidad ya no está seleccionada." };
    const nextUni = applyLiveCourses(
      latestUni,
      link.subjectId,
      link.subjectCode,
      subjectUpdatedAt,
      mapped,
      groupUpdatedAt,
    );

    set((s) => ({
      universities: s.universities.map((u) => (u.id === latestUni.id ? nextUni : u)),
    }));
    void persist(nextUni);
    return result.data.failedGroupIds.length > 0
      ? {
          ok: true,
          error: `${result.data.failedGroupIds.length} grupo(s) no se pudieron actualizar.`,
        }
      : { ok: true };
  },

  refreshAllLiveCourses: async () => {
    const uni = selected(get());
    if (!uni?.liveLinks) return;
    // A lab-split course shares its subjectId with its lecture sibling - refresh once per
    // subject, not once per course, so we don't double-fetch the same groups/schedules.
    const seenSubjectIds = new Set<string>();
    for (const [courseId, link] of Object.entries(uni.liveLinks)) {
      if (seenSubjectIds.has(link.subjectId)) continue;
      seenSubjectIds.add(link.subjectId);
      // Sequential across subjects (each refresh already parallelizes its own groups' fetches internally).
      await get().refreshLiveCourse(courseId);
    }
  },

  removeCourse: (courseId) => {
    const state = get();
    const uni = selected(state);
    if (!uni) return;
    const nextUni: StoredUniversity = {
      ...uni,
      courses: uni.courses.filter((c) => c.id !== courseId),
    };
    if (nextUni.liveLinks && courseId in nextUni.liveLinks) {
      const liveLinks = { ...nextUni.liveLinks };
      delete liveLinks[courseId];
      nextUni.liveLinks = liveLinks;
    }
    set((s) => ({
      universities: s.universities.map((u) => (u.id === uni.id ? nextUni : u)),
      generateResult: null,
      currentIndex: 0,
    }));
    void persist(nextUni);
  },

  reorderCourses: (draggedId, targetId) => {
    if (draggedId === targetId) return;
    const state = get();
    const uni = selected(state);
    if (!uni) return;
    const courses = [...uni.courses];
    const fromIndex = courses.findIndex((c) => c.id === draggedId);
    const toIndex = courses.findIndex((c) => c.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const moved = courses.splice(fromIndex, 1)[0] as Course;
    courses.splice(toIndex, 0, moved);
    const nextUni: StoredUniversity = { ...uni, courses };
    set((s) => ({ universities: s.universities.map((u) => (u.id === uni.id ? nextUni : u)) }));
    void persist(nextUni);
  },

  toggleGroupDisabled: (courseId, groupId) => {
    const state = get();
    const uni = selected(state);
    if (!uni) return;
    const nextCourses = uni.courses.map((c) => {
      if (c.id !== courseId) return c;
      return {
        ...c,
        groups: c.groups.map((g) => (g.id === groupId ? { ...g, disabled: !g.disabled } : g)),
      };
    });
    const nextUni: StoredUniversity = { ...uni, courses: nextCourses };
    set((s) => ({ universities: s.universities.map((u) => (u.id === uni.id ? nextUni : u)) }));
    void persist(nextUni);
  },

  updateConfig: (patch) => {
    const state = get();
    const uni = selected(state);
    if (!uni) return;
    const nextUni: StoredUniversity = { ...uni, config: { ...uni.config, ...patch } };
    set((s) => ({ universities: s.universities.map((u) => (u.id === uni.id ? nextUni : u)) }));
    void persist(nextUni);
  },

  generate: () => {
    const state = get();
    const uni = selected(state);
    if (!uni) return;
    const result = generateCombinations(uni.courses, { config: uni.config });
    set({ generateResult: result, currentIndex: 0 });
  },

  clearCombinations: () => {
    set({ generateResult: null, currentIndex: 0 });
  },

  goToCombination: (delta) => {
    const { generateResult, currentIndex } = get();
    if (!generateResult || generateResult.combinations.length === 0) return;
    const total = generateResult.combinations.length;
    const next = (((currentIndex + delta) % total) + total) % total;
    set({ currentIndex: next });
  },

  pinCurrent: (label) => {
    const state = get();
    const uni = selected(state);
    const combo = state.generateResult?.combinations[state.currentIndex];
    if (!uni || !combo) return;
    const pin: PinnedCombination = { id: newId(), label, score: combo.score, groups: combo.groups };
    const nextUni: StoredUniversity = { ...uni, pinned: [...uni.pinned, pin] };
    set((s) => ({ universities: s.universities.map((u) => (u.id === uni.id ? nextUni : u)) }));
    void persist(nextUni);
  },

  unpin: (pinId) => {
    const state = get();
    const uni = selected(state);
    if (!uni) return;
    const nextUni: StoredUniversity = { ...uni, pinned: uni.pinned.filter((p) => p.id !== pinId) };
    set((s) => ({ universities: s.universities.map((u) => (u.id === uni.id ? nextUni : u)) }));
    void persist(nextUni);
  },

  toggleSettings: () =>
    set((s) => ({
      settingsOpen: !s.settingsOpen,
      compareOpen: s.settingsOpen ? s.compareOpen : false,
    })),
  toggleCompare: () => set((s) => ({ compareOpen: !s.compareOpen })),

  exportBackup: () => {
    const uni = selected(get());
    if (!uni) return null;
    return JSON.stringify(
      { id: uni.id, name: uni.name, courses: uni.courses, config: uni.config, pinned: uni.pinned },
      null,
      2,
    );
  },

  importBackup: (json) => {
    const state = get();
    const uni = selected(state);
    if (!uni) return { ok: false, error: "Selecciona una universidad primero." };

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { ok: false, error: "El archivo no es JSON válido." };
    }

    // A backup from unapp-old (v1) has a different, untyped shape
    // (`course_id`/`course_name`/... instead of `id`/`name`/...) - detect
    // and migrate it instead of rejecting it outright.
    let backup: { courses: Course[]; config?: CombinationConfig; pinned?: PinnedCombination[] };
    if (isLegacyV1Backup(parsed)) {
      const migrated = migrateLegacyV1Backup(parsed);
      if (migrated.warnings.length > 0)
        console.warn("Advertencias al migrar respaldo v1:", migrated.warnings);
      backup = { courses: migrated.courses, config: migrated.config };
    } else if (isBackupShape(parsed)) {
      backup = parsed;
    } else {
      return {
        ok: false,
        error: "El archivo no tiene el formato esperado de un respaldo de UNApp.",
      };
    }

    const existingCourseIds = new Set(uni.courses.map((c) => c.id));
    const newCourses = backup.courses.filter((c) => !existingCourseIds.has(c.id));
    const existingPinIds = new Set(uni.pinned.map((p) => p.id));
    const newPinned = (backup.pinned ?? []).filter((p) => !existingPinIds.has(p.id));

    const nextUni: StoredUniversity = {
      ...uni,
      courses: [...uni.courses, ...newCourses],
      config: backup.config ?? uni.config,
      pinned: [...uni.pinned, ...newPinned],
    };
    set((s) => ({ universities: s.universities.map((u) => (u.id === uni.id ? nextUni : u)) }));
    void persist(nextUni);
    return { ok: true };
  },
}));

export function useSelectedUniversity(): StoredUniversity | undefined {
  return useAppStore((s) => s.universities.find((u) => u.id === s.selectedUniversityId));
}

export { isGroupManuallyDisabled };
