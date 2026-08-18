import { combinationToIcs } from "@unapp/core";
import { downloadText } from "../lib/download";
import { useAppStore, useSelectedUniversity } from "../store/appStore";
import { DownloadIcon, TrashIcon } from "./icons";

export function ComparePanel() {
  const university = useSelectedUniversity();
  const unpin = useAppStore((s) => s.unpin);

  if (!university) return null;
  const pinned = university.pinned;
  const bestScore = Math.max(0, ...pinned.map((p) => p.score));

  function exportIcs(label: string, groups: (typeof pinned)[number]["groups"]) {
    const names = new Map(university!.courses.map((c) => [c.id, c.name]));
    const ics = combinationToIcs(groups, names, { calendarName: `UNApp - ${label}` });
    downloadText(`${label.replace(/\s+/g, "-").toLowerCase()}.ics`, ics, "text/calendar");
  }

  return (
    <div className="flex w-72 shrink-0 flex-col gap-3 border-l border-[var(--border)] bg-[var(--panel)] p-3.5">
      <div className="font-display text-[14px] font-semibold text-[var(--text)]">Comparar combinaciones</div>

      {pinned.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center text-[11px] text-[var(--text-faint)]">
          Fija combinaciones con el ícono de pin en el navegador para compararlas aquí.
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto">
        {pinned.map((p) => {
          const pct = bestScore > 0 ? Math.max(4, Math.round((100 * (p.score + 100)) / (bestScore + 100))) : 100;
          return (
            <div key={p.id} className="flex flex-col gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-[var(--text-dim)]">{p.label}</div>
                <div className="font-mono text-[11px] font-semibold text-[var(--accent)]">{p.score}</div>
              </div>
              <div className="h-1 rounded-full bg-[var(--border)]">
                <div className="h-1 rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[var(--text-faint)]">{p.groups.length} curso(s)</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => exportIcs(p.label, p.groups)}
                    className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--accent)]"
                    aria-label="Exportar .ics"
                    title="Exportar a calendario (.ics)"
                  >
                    <DownloadIcon width={12} height={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => unpin(p.id)}
                    className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:text-rose-400"
                    aria-label="Quitar"
                  >
                    <TrashIcon width={12} height={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
