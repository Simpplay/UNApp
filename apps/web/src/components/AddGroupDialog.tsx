import { parseHHmm, WEEKDAY_LABEL_ES, WEEKDAYS, type ScheduleSlot, type Weekday } from "@unapp/core";
import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { newId } from "../lib/download";
import { Modal } from "./Modal";
import { TrashIcon } from "./icons";

interface DraftSlot {
  key: string;
  day: Weekday;
  start: string;
  end: string;
  validityStart: string;
  validityEnd: string;
}

function emptyDraftSlot(): DraftSlot {
  return { key: newId(), day: "monday", start: "07:00", end: "09:00", validityStart: "", validityEnd: "" };
}

export function AddGroupDialog({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const addManualGroup = useAppStore((s) => s.addManualGroup);
  const [groupId, setGroupId] = useState("");
  const [teacher, setTeacher] = useState("");
  const [quota, setQuota] = useState("-1");
  const [slots, setSlots] = useState<DraftSlot[]>([emptyDraftSlot()]);
  const [error, setError] = useState<string | null>(null);

  function updateSlot(key: string, patch: Partial<DraftSlot>) {
    setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function submit() {
    if (!groupId.trim()) {
      setError("El ID del grupo es obligatorio.");
      return;
    }
    const builtSlots: ScheduleSlot[] = [];
    for (const s of slots) {
      if (!s.validityStart || !s.validityEnd) {
        setError("Completa la fecha de inicio y fin de vigencia en cada horario.");
        return;
      }
      try {
        builtSlots.push({
          day: s.day,
          time: { start: parseHHmm(s.start), end: parseHHmm(s.end) },
          validity: { start: s.validityStart, end: s.validityEnd },
        });
      } catch {
        setError(`Hora inválida en el horario de ${WEEKDAY_LABEL_ES[s.day]}.`);
        return;
      }
    }

    const result = addManualGroup(courseId, {
      id: groupId.trim(),
      parentCourseId: courseId,
      quota: Number(quota),
      disabled: false,
      slots: builtSlots,
      ...(teacher.trim() ? { teacher: teacher.trim() } : {}),
    });

    if (!result.ok) {
      setError(result.error ?? "No se pudo agregar el grupo.");
      return;
    }
    onClose();
  }

  return (
    <Modal title="Agregar grupo" onClose={onClose} width={520}>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
            placeholder="ID del grupo*"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          />
          <input
            className="w-32 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
            placeholder="Cupo"
            type="number"
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
          />
        </div>
        <input
          className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          placeholder="Profesor (opcional)"
          value={teacher}
          onChange={(e) => setTeacher(e.target.value)}
        />

        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-semibold text-[var(--text-muted)]">Horarios</div>
          {slots.map((s) => (
            <div key={s.key} className="flex flex-col gap-1.5 rounded-md border border-[var(--border)] p-2.5">
              <div className="flex items-center gap-2">
                <select
                  value={s.day}
                  onChange={(e) => updateSlot(s.key, { day: e.target.value as Weekday })}
                  className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] outline-none"
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d} value={d}>
                      {WEEKDAY_LABEL_ES[d]}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={s.start}
                  onChange={(e) => updateSlot(s.key, { start: e.target.value })}
                  className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] outline-none"
                />
                <input
                  type="time"
                  value={s.end}
                  onChange={(e) => updateSlot(s.key, { end: e.target.value })}
                  className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] outline-none"
                />
                {slots.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSlots((prev) => prev.filter((x) => x.key !== s.key))}
                    className="ml-auto text-[var(--text-muted)] hover:text-rose-400"
                    aria-label="Quitar horario"
                  >
                    <TrashIcon width={13} height={13} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={s.validityStart}
                  onChange={(e) => updateSlot(s.key, { validityStart: e.target.value })}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] outline-none"
                />
                <input
                  type="date"
                  value={s.validityEnd}
                  onChange={(e) => updateSlot(s.key, { validityEnd: e.target.value })}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] outline-none"
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSlots((prev) => [...prev, emptyDraftSlot()])}
            className="self-start text-[11px] font-semibold text-[var(--accent)]"
          >
            + Agregar otro horario
          </button>
        </div>

        {error && <div className="text-xs text-rose-400">{error}</div>}
        <button
          type="button"
          onClick={submit}
          className="mt-1 rounded-lg bg-[var(--accent)] py-2 text-sm font-semibold text-[var(--accent-ink)]"
        >
          Agregar grupo
        </button>
      </div>
    </Modal>
  );
}
