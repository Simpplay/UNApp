import {
  WEEKDAY_LABEL_ES,
  WEEKDAYS,
  type UnalFacets,
  type UnalGroup,
  type UnalPagination,
  type UnalScheduleEntry,
  type UnalSubjectResult,
} from "@unapp/core";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { formatRelativeTime } from "../lib/format";
import { fetchGroupsWithSchedules, searchUnalSubjects } from "../lib/unalLiveApi";
import { useAppStore } from "../store/appStore";
import { ChevronDownIcon, PlusIcon, SearchIcon } from "./icons";
import { Modal } from "./Modal";

const PAGE_SIZE = 15;

/**
 * Splits the API's `highlight` string (the subject name with the matched
 * text wrapped in a literal `<mark>...</mark>`) into React nodes instead of
 * `dangerouslySetInnerHTML` - the highlight is server-built from whatever the
 * user typed into `q`, so treating it as trusted HTML would be an XSS vector.
 * Only the exact `<mark>`/`</mark>` tokens are special-cased; everything else
 * renders as plain (auto-escaped) text.
 */
function renderHighlight(highlight: string | undefined, fallback: string): ReactNode {
  if (!highlight) return fallback;
  const parts = highlight.split(/(<mark>|<\/mark>)/g);
  const nodes: ReactNode[] = [];
  let inMark = false;
  parts.forEach((part, i) => {
    if (part === "<mark>") {
      inMark = true;
      return;
    }
    if (part === "</mark>") {
      inMark = false;
      return;
    }
    if (!part) return;
    nodes.push(
      inMark ? (
        <mark key={i} className="rounded bg-[var(--accent)]/25 px-0.5 text-[var(--accent)]">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  });
  return nodes;
}

function groupQuotaColor(g: UnalGroup): string {
  if (g.available_places === 0) return "#fb7185";
  if (g.offered_places > 0 && g.available_places / g.offered_places <= 0.15) return "#fbbf24";
  return "#34d399";
}

function SubjectResultCard({ subject }: { subject: UnalSubjectResult }) {
  const [expanded, setExpanded] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [groups, setGroups] = useState<UnalGroup[] | null>(null);
  const [schedules, setSchedules] = useState<Record<string, UnalScheduleEntry[]>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [addFeedback, setAddFeedback] = useState<string | null>(null);
  const addLiveCourse = useAppStore((s) => s.addLiveCourse);

  async function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (!next || groups !== null) return;

    setLoadingGroups(true);
    setGroupsError(null);
    const result = await fetchGroupsWithSchedules(subject.subject_id);
    setLoadingGroups(false);
    if (!result.ok) {
      setGroupsError(result.error);
      return;
    }
    setGroups(result.data.groups);
    setSchedules(result.data.schedulesByGroupId);
    setChecked(Object.fromEntries(result.data.groups.map((g) => [g.group_id, true])));
  }

  function handleAdd() {
    if (!groups) return;
    const selected = groups.filter((g) => checked[g.group_id]);
    if (selected.length === 0) return;
    const selectedSchedules = Object.fromEntries(selected.map((g) => [g.group_id, schedules[g.group_id] ?? []]));
    const { added, warnings } = addLiveCourse(subject, selected, selectedSchedules);
    setAddFeedback(
      added > 0
        ? `${added} curso${added === 1 ? "" : "s"} agregado(s) con ${selected.length} grupo(s).`
        : "No se pudo agregar el curso.",
    );
    if (warnings.length > 0) console.warn("Advertencias al mapear oferta en vivo de UNAL:", warnings);
    window.setTimeout(() => setAddFeedback(null), 4000);
  }

  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-alt)] p-3">
      <button
        type="button"
        onClick={() => void toggleExpand()}
        className="flex w-full items-start gap-2.5 text-left"
      >
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{ background: subject.available_seats === 0 ? "#fb7185" : "#34d399" }}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-[var(--text)]">
            {renderHighlight(subject.highlight, subject.name)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] text-[var(--text-faint)]">
            <span>{subject.code}</span>
            <span>· {subject.credits} cr</span>
            <span>
              · {subject.groups_count} grupo{subject.groups_count === 1 ? "" : "s"}
            </span>
            <span>
              · {subject.available_seats} cupo{subject.available_seats === 1 ? "" : "s"} libre
              {subject.available_seats === 1 ? "" : "s"}
            </span>
            {subject.is_libre_eleccion && (
              <span className="rounded bg-[var(--accent)]/15 px-1 py-0.5 text-[var(--accent)]">libre elección</span>
            )}
            <span>· actualizado {formatRelativeTime(subject.updated_at)}</span>
          </div>
        </div>
        <ChevronDownIcon
          width={14}
          height={14}
          className="mt-1 shrink-0 text-[var(--text-muted)]"
          style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
        />
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2 border-t border-[var(--border)] pt-2.5">
          {loadingGroups && <div className="text-[11px] text-[var(--text-faint)]">Cargando grupos y horarios...</div>}
          {groupsError && <div className="text-[11px] text-rose-400">{groupsError}</div>}

          {groups?.map((g) => (
            <label
              key={g.group_id}
              className="flex items-start gap-2 rounded-md border border-[var(--border)] px-2 py-1.5 text-[11px] text-[var(--text-dim)]"
            >
              <input
                type="checkbox"
                checked={checked[g.group_id] ?? true}
                onChange={(e) => setChecked((prev) => ({ ...prev, [g.group_id]: e.target.checked }))}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">
                    Grupo {g.group_identifier}
                    {g.activity_type ? ` · ${g.activity_type}` : ""}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 font-mono">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: groupQuotaColor(g) }} />
                    {g.available_places}/{g.offered_places}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-col gap-0.5 text-[var(--text-faint)]">
                  {(schedules[g.group_id] ?? []).length === 0 && <span>Sin horario reportado.</span>}
                  {(schedules[g.group_id] ?? []).map((s, i) => {
                    const day = WEEKDAYS[s.day];
                    return (
                      <span key={i}>
                        {day ? WEEKDAY_LABEL_ES[day] : `día ${s.day}`} {String(s.start_hour).padStart(2, "0")}:00–
                        {String(s.end_hour).padStart(2, "0")}:00
                        {s.location ? ` · ${s.location}` : ""}
                        {s.professor ? ` · ${s.professor}` : ""}
                      </span>
                    );
                  })}
                </div>
              </div>
            </label>
          ))}

          {groups && groups.length > 0 && (
            <button
              type="button"
              onClick={handleAdd}
              disabled={checkedCount === 0}
              className="mt-1 flex items-center justify-center gap-1.5 self-start rounded-md bg-[var(--accent)] px-3 py-1.5 text-[11px] font-semibold text-[var(--accent-ink)] disabled:opacity-40"
            >
              <PlusIcon width={12} height={12} />
              Agregar {checkedCount} grupo{checkedCount === 1 ? "" : "s"}
            </button>
          )}
          {addFeedback && <div className="text-[11px] text-[var(--text-muted)]">{addFeedback}</div>}
        </div>
      )}
    </div>
  );
}

export function UnalLiveSearchDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [sede, setSede] = useState("");
  const [faculty, setFaculty] = useState("");
  const [level, setLevel] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const [results, setResults] = useState<UnalSubjectResult[]>([]);
  const [facets, setFacets] = useState<UnalFacets | null>(null);
  const [pagination, setPagination] = useState<UnalPagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  async function runSearch(pageToLoad: number, replace: boolean) {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    if (replace) setError(null);

    const result = await searchUnalSubjects({
      q: query,
      filters: {
        ...(sede ? { sede: [sede] } : {}),
        ...(faculty ? { faculty: [faculty] } : {}),
        ...(level ? { level: [level] } : {}),
        ...(onlyAvailable ? { has_available: true } : {}),
      },
      page: pageToLoad,
      limit: PAGE_SIZE,
    });

    if (requestIdRef.current !== requestId) return;
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFacets(result.data.facets);
    setPagination(result.data.pagination);
    setPage(pageToLoad);
    setResults((prev) => (replace ? result.data.results : [...prev, ...result.data.results]));
  }

  useEffect(() => {
    const handle = window.setTimeout(() => void runSearch(1, true), 350);
    return () => window.clearTimeout(handle);
  }, [query, sede, faculty, level, onlyAvailable]);

  const canLoadMore = pagination !== null && page < pagination.totalPages;

  return (
    <Modal title="Buscar oferta en vivo · Universidad Nacional" onClose={onClose} width={760}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-xs text-[var(--text-faint)]">
          <SearchIcon width={14} height={14} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca por nombre o código (ej: cálculo, 1000004)..."
            className="w-full bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sede}
            onChange={(e) => {
              setSede(e.target.value);
              setFaculty("");
              setLevel("");
            }}
            className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-[11px] text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
          >
            <option value="">Toda sede</option>
            {facets?.sede.map((f) => (
              <option key={String(f.key)} value={f.key}>
                {f.key} ({f.count})
              </option>
            ))}
          </select>
          <select
            value={faculty}
            onChange={(e) => {
              setFaculty(e.target.value);
              setLevel("");
            }}
            className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-[11px] text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
          >
            <option value="">Toda facultad</option>
            {facets?.faculty.map((f) => (
              <option key={String(f.key)} value={f.key}>
                {f.key} ({f.count})
              </option>
            ))}
          </select>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-[11px] text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
          >
            <option value="">Todo nivel</option>
            {facets?.level.map((f) => (
              <option key={String(f.key)} value={f.key}>
                {f.key} ({f.count})
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1.5 text-[11px] text-[var(--text-muted)]">
            <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
            Solo con cupo
          </label>
          {pagination && (
            <span className="ml-auto font-mono text-[10px] text-[var(--text-faint)]">
              {pagination.total} resultado{pagination.total === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {error && <div className="text-xs text-rose-400">{error}</div>}

        <div className="flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1">
          {results.length === 0 && !loading && !error && (
            <div className="pt-6 text-center text-[11px] text-[var(--text-faint)]">
              Ningún resultado. Prueba con otro nombre o quita filtros.
            </div>
          )}
          {results.map((subject) => (
            <SubjectResultCard key={subject.subject_id} subject={subject} />
          ))}
          {loading && <div className="py-2 text-center text-[11px] text-[var(--text-faint)]">Buscando...</div>}
        </div>

        {canLoadMore && !loading && (
          <button
            type="button"
            onClick={() => void runSearch(page + 1, false)}
            className="self-center rounded-md border border-[var(--border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Cargar más
          </button>
        )}
      </div>
    </Modal>
  );
}
