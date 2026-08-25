import { isCourseEffectivelyDisabled, isCourseOutOfSeats, isGroupEffectivelyDisabled, type Course } from "@unapp/core";
import { useState } from "react";
import type { LiveCourseLink } from "../lib/db";
import { formatRelativeTime } from "../lib/format";
import { useAppStore } from "../store/appStore";
import { AddGroupDialog } from "./AddGroupDialog";
import { PlusIcon, RefreshIcon, TrashIcon, WifiIcon } from "./icons";

/** Absolute thresholds - the domain `Group` model only knows available seats, not capacity. */
function quotaColor(quota: number): string {
  if (quota === -1) return "var(--text-faint)";
  if (quota === 0) return "#fb7185";
  if (quota <= 5) return "#fbbf24";
  return "#34d399";
}

export function CourseCard({ course, liveLink }: { course: Course; liveLink?: LiveCourseLink | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const removeCourse = useAppStore((s) => s.removeCourse);
  const toggleGroupDisabled = useAppStore((s) => s.toggleGroupDisabled);
  const refreshLiveCourse = useAppStore((s) => s.refreshLiveCourse);
  const disabled = isCourseEffectivelyDisabled(course);
  const outOfSeats = isCourseOutOfSeats(course);

  async function handleRefresh(e: React.MouseEvent) {
    e.stopPropagation();
    setRefreshing(true);
    setRefreshError(null);
    const result = await refreshLiveCourse(course.id);
    if (!result.ok) setRefreshError(result.error ?? "No se pudo actualizar.");
    setRefreshing(false);
  }

  async function handleCopyId(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(course.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="rounded-lg border p-2.5"
      style={{
        borderColor: "var(--border)",
        background: "var(--panel-alt)",
        opacity: disabled ? 0.55 : 1,
        borderStyle: disabled ? "dashed" : "solid",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 text-left"
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: course.color }} />
        <span className="flex-1 truncate text-xs font-semibold text-[var(--text)]">{course.name}</span>
        {outOfSeats && (
          <span
            className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
            style={{ color: "#fb7185", background: "color-mix(in srgb, #fb7185 14%, transparent)" }}
            title="Todos los grupos están llenos - este curso se excluye automáticamente de las combinaciones"
          >
            Sin cupos
          </span>
        )}
        {liveLink && (
          <span
            className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-[var(--accent)]"
            style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
            title={`Datos en vivo de UNAL - actualizado ${formatRelativeTime(liveLink.subjectUpdatedAt)}`}
          >
            <WifiIcon width={10} height={10} />
            en vivo
          </span>
        )}
        <span className="font-mono text-[10px] text-[var(--text-muted)]">{course.credits}cr</span>
      </button>
      <div className="flex items-center justify-between pl-3.5">
        <span className="font-mono text-[10px] text-[var(--text-faint)]">
          <button
            type="button"
            onClick={handleCopyId}
            className="hover:text-[var(--accent)]"
            title="Copiar código del curso"
          >
            {course.id}
          </button>{" "}
          · {course.groups.length} grupo{course.groups.length === 1 ? "" : "s"}
          {copied && <span className="ml-1 text-[var(--accent)]">Copiado</span>}
        </span>
        {liveLink && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-40"
            title="Actualizar cupos desde UNAL"
          >
            <RefreshIcon width={10} height={10} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Actualizando..." : "Actualizar"}
          </button>
        )}
      </div>
      {refreshError && <div className="pl-3.5 text-[10px] text-rose-400">{refreshError}</div>}

      {expanded && (
        <div className="mt-2 flex flex-col gap-1.5 border-t border-[var(--border)] pt-2">
          {course.groups.length === 0 && (
            <div className="text-[11px] text-[var(--text-faint)]">Sin grupos todavía.</div>
          )}
          {course.groups.map((g) => {
            const off = isGroupEffectivelyDisabled(g);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGroupDisabled(course.id, g.id)}
                className="flex items-center justify-between rounded-md border px-2 py-1 text-left text-[11px]"
                style={{
                  borderColor: "var(--border)",
                  color: off ? "var(--text-faint)" : "var(--text-dim)",
                  textDecoration: g.disabled ? "line-through" : "none",
                }}
              >
                <span>
                  Grupo {g.id}
                  {g.teacher ? ` · ${g.teacher}` : ""}
                </span>
                <span className="flex items-center gap-1.5 font-mono">
                  {liveLink && (
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: quotaColor(g.quota) }} />
                  )}
                  {g.quota === -1 ? "?" : g.quota}
                </span>
              </button>
            );
          })}
          <div className="mt-1 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setAddGroupOpen(true)}
              className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-[var(--accent)]"
            >
              <PlusIcon width={12} height={12} />
              Agregar grupo
            </button>
            <button
              type="button"
              onClick={() => removeCourse(course.id)}
              className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-rose-400/80 hover:text-rose-400"
            >
              <TrashIcon width={12} height={12} />
              Eliminar curso
            </button>
          </div>
        </div>
      )}

      {addGroupOpen && <AddGroupDialog courseId={course.id} onClose={() => setAddGroupOpen(false)} />}
    </div>
  );
}
