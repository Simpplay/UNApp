import { isCourseFullyDisabled, isGroupEffectivelyDisabled, type Course } from "@unapp/core";
import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { TrashIcon } from "./icons";

export function CourseCard({ course }: { course: Course }) {
  const [expanded, setExpanded] = useState(false);
  const removeCourse = useAppStore((s) => s.removeCourse);
  const toggleGroupDisabled = useAppStore((s) => s.toggleGroupDisabled);
  const disabled = isCourseFullyDisabled(course);

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
        <span className="font-mono text-[10px] text-[var(--text-muted)]">{course.credits}cr</span>
      </button>
      <div className="pl-3.5 font-mono text-[10px] text-[var(--text-faint)]">
        {course.id} · {course.groups.length} grupo{course.groups.length === 1 ? "" : "s"}
      </div>

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
                <span className="font-mono">{g.quota === -1 ? "?" : g.quota}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => removeCourse(course.id)}
            className="mt-1 flex items-center gap-1.5 self-start rounded-md px-1.5 py-1 text-[11px] text-rose-400/80 hover:text-rose-400"
          >
            <TrashIcon width={12} height={12} />
            Eliminar curso
          </button>
        </div>
      )}
    </div>
  );
}
