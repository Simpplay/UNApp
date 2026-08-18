import {
  builtInAdapters,
  defaultCombinationConfig,
  generateCombinations,
  isGroupManuallyDisabled,
  type CombinationConfig,
  type Course,
  type GenerateResult,
  type ParseWarning,
} from "@unapp/core";
import { create } from "zustand";
import { db, type PinnedCombination, type StoredUniversity } from "../lib/db";
import { newId } from "../lib/download";

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
  removeCourse: (courseId: string) => void;
  toggleGroupDisabled: (courseId: string, groupId: string) => void;
  updateConfig: (patch: Partial<CombinationConfig>) => void;
  generate: () => void;
  clearCombinations: () => void;
  goToCombination: (delta: number) => void;
  pinCurrent: (label: string) => void;
  unpin: (pinId: string) => void;
  toggleSettings: () => void;
  toggleCompare: () => void;
}

function selected(state: AppState): StoredUniversity | undefined {
  return state.universities.find((u) => u.id === state.selectedUniversityId);
}

async function persist(u: StoredUniversity): Promise<void> {
  await db.universities.put(u);
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
      return { warnings: [{ message: "Esta universidad no tiene un formato de importación automática; agrega los cursos manualmente." }], added: 0 };
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
      warnings: skipped > 0 ? [...warnings, { message: `${skipped} curso(s) ya existían y no se duplicaron.` }] : warnings,
      added: toAdd.length,
    };
  },

  addManualCourse: (course) => {
    const state = get();
    const uni = selected(state);
    if (!uni) return;
    if (uni.courses.some((c) => c.id === course.id)) return;
    const nextUni: StoredUniversity = { ...uni, courses: [...uni.courses, course] };
    set((s) => ({ universities: s.universities.map((u) => (u.id === uni.id ? nextUni : u)) }));
    void persist(nextUni);
  },

  removeCourse: (courseId) => {
    const state = get();
    const uni = selected(state);
    if (!uni) return;
    const nextUni: StoredUniversity = { ...uni, courses: uni.courses.filter((c) => c.id !== courseId) };
    set((s) => ({
      universities: s.universities.map((u) => (u.id === uni.id ? nextUni : u)),
      generateResult: null,
      currentIndex: 0,
    }));
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
    const next = ((currentIndex + delta) % total + total) % total;
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

  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen, compareOpen: s.settingsOpen ? s.compareOpen : false })),
  toggleCompare: () => set((s) => ({ compareOpen: !s.compareOpen })),
}));

export function useSelectedUniversity(): StoredUniversity | undefined {
  return useAppStore((s) => s.universities.find((u) => u.id === s.selectedUniversityId));
}

export { isGroupManuallyDisabled };
