import { useMemo, useState } from "react";
import { useAppStore, useSelectedUniversity } from "../store/appStore";
import { AddCourseDialog } from "./AddCourseDialog";
import { CourseCard } from "./CourseCard";
import { ImportTextPanel } from "./ImportTextPanel";
import { UnalLiveSearchDialog } from "./UnalLiveSearchDialog";
import { PlusIcon, SearchIcon, WifiIcon } from "./icons";

export function Sidebar() {
  const university = useSelectedUniversity();
  const generate = useAppStore((s) => s.generate);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [liveSearchOpen, setLiveSearchOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!university) return [];
    const q = query.trim().toLowerCase();
    if (!q) return university.courses;
    return university.courses.filter(
      (c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  }, [university, query]);

  const totalCredits = useMemo(
    () => university?.courses.reduce((sum, c) => sum + c.credits, 0) ?? 0,
    [university],
  );

  if (!university) {
    return (
      <div className="flex w-72 shrink-0 flex-col items-center justify-center gap-2 border-r border-[var(--border)] bg-[var(--panel)] p-6 text-center text-xs text-[var(--text-faint)]">
        Selecciona una universidad arriba para empezar.
      </div>
    );
  }

  return (
    <div className="flex w-72 shrink-0 flex-col gap-3 border-r border-[var(--border)] bg-[var(--panel)] p-3.5">
      <div className="flex items-center justify-between">
        <div className="font-display text-[15px] font-semibold text-[var(--text)]">Cursos</div>
        <div className="flex items-center gap-1.5">
          {university.id === "unal" && (
            <button
              type="button"
              onClick={() => setLiveSearchOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-semibold text-[var(--accent)] hover:border-[var(--accent)]"
              aria-label="Buscar oferta en vivo de la UNAL"
              title="Buscar y agregar cursos con cupos en tiempo real"
            >
              <WifiIcon width={12} height={12} />
              Buscar en vivo
            </button>
          )}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent)] text-[var(--accent-ink)]"
            aria-label="Agregar curso"
          >
            <PlusIcon width={13} height={13} />
          </button>
        </div>
      </div>

      <ImportTextPanel />

      <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-xs text-[var(--text-faint)]">
        <SearchIcon width={14} height={14} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar curso..."
          className="w-full bg-transparent outline-none placeholder:text-[var(--text-faint)]"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="pt-6 text-center text-[11px] text-[var(--text-faint)]">Ningún curso todavía.</div>
        )}
        {filtered.map((course) => (
          <CourseCard key={course.id} course={course} liveLink={university.liveLinks?.[course.id]} />
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-2.5">
        <div className="font-mono text-[10px] text-[var(--text-faint)]">
          {university.courses.length} curso(s) · {totalCredits} créditos
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={university.courses.length === 0}
          className="flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] py-2.5 text-[13px] font-bold text-[var(--accent-ink)] disabled:opacity-30"
        >
          Generar combinaciones
          <span className="rounded bg-black/15 px-1.5 py-0.5 font-mono text-[10px]">⌘G</span>
        </button>
      </div>

      {addOpen && <AddCourseDialog onClose={() => setAddOpen(false)} />}
      {liveSearchOpen && <UnalLiveSearchDialog onClose={() => setLiveSearchOpen(false)} />}
    </div>
  );
}
