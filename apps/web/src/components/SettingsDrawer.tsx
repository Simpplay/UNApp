import { formatHHmm, parseHHmm, WEEKDAY_LABEL_ES, WEEKDAYS, type Weekday } from "@unapp/core";
import { useAppStore, useSelectedUniversity } from "../store/appStore";
import { CloseIcon } from "./icons";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[11px] font-medium text-[var(--text-muted)]">
      {label}
      {children}
    </label>
  );
}

const inputClass =
  "rounded-md border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]";

export function SettingsDrawer() {
  const open = useAppStore((s) => s.settingsOpen);
  const toggle = useAppStore((s) => s.toggleSettings);
  const updateConfig = useAppStore((s) => s.updateConfig);
  const university = useSelectedUniversity();

  if (!open || !university) return null;
  const { config } = university;

  function toggleFreeDay(day: Weekday) {
    const next = config.freeDays.includes(day) ? config.freeDays.filter((d) => d !== day) : [...config.freeDays, day];
    updateConfig({ freeDays: next });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={toggle} role="presentation">
      <div
        className="flex h-full w-80 flex-col gap-5 overflow-y-auto border-l border-[var(--border)] bg-[var(--panel)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="font-display text-[15px] font-semibold text-[var(--text)]">Configuración</div>
          <button type="button" onClick={toggle} className="text-[var(--text-muted)]" aria-label="Cerrar">
            <CloseIcon />
          </button>
        </div>

        <Field label="Días libres">
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.filter((d) => d !== "sunday").map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleFreeDay(day)}
                className="rounded-md border px-2.5 py-1 text-[11px]"
                style={{
                  borderColor: config.freeDays.includes(day) ? "var(--accent)" : "var(--border)",
                  color: config.freeDays.includes(day) ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {WEEKDAY_LABEL_ES[day].slice(0, 3)}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Horario de almuerzo">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px]">
              <input
                type="checkbox"
                checked={config.lunchTime !== null}
                onChange={(e) => updateConfig({ lunchTime: e.target.checked ? { start: 12 * 60, end: 13 * 60 } : null })}
              />
              Activo
            </label>
          </div>
          {config.lunchTime && (
            <div className="flex gap-2">
              <input
                type="time"
                className={inputClass}
                value={formatHHmm(config.lunchTime.start)}
                onChange={(e) => updateConfig({ lunchTime: { ...config.lunchTime!, start: parseHHmm(e.target.value) } })}
              />
              <input
                type="time"
                className={inputClass}
                value={formatHHmm(config.lunchTime.end)}
                onChange={(e) => updateConfig({ lunchTime: { ...config.lunchTime!, end: parseHHmm(e.target.value) } })}
              />
            </div>
          )}
        </Field>

        <Field label="Rango disponible">
          <div className="flex gap-2">
            <input
              type="time"
              className={inputClass}
              value={formatHHmm(config.range.start)}
              onChange={(e) => updateConfig({ range: { ...config.range, start: parseHHmm(e.target.value) } })}
            />
            <input
              type="time"
              className={inputClass}
              value={formatHHmm(config.range.end)}
              onChange={(e) => updateConfig({ range: { ...config.range, end: parseHHmm(e.target.value) } })}
            />
          </div>
        </Field>

        <Field label="Máx. clases por día">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.maxCoursesPerDay !== -1}
              onChange={(e) => updateConfig({ maxCoursesPerDay: e.target.checked ? 3 : -1 })}
            />
            <input
              type="number"
              min={0}
              disabled={config.maxCoursesPerDay === -1}
              className={`${inputClass} w-20 disabled:opacity-30`}
              value={config.maxCoursesPerDay === -1 ? "" : config.maxCoursesPerDay}
              onChange={(e) => updateConfig({ maxCoursesPerDay: Number(e.target.value) || 0 })}
            />
          </div>
        </Field>

        <Field label="Máx. huecos por día">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.maxHolesPerDay !== -1}
              onChange={(e) => updateConfig({ maxHolesPerDay: e.target.checked ? 1 : -1 })}
            />
            <input
              type="number"
              min={0}
              disabled={config.maxHolesPerDay === -1}
              className={`${inputClass} w-20 disabled:opacity-30`}
              value={config.maxHolesPerDay === -1 ? "" : config.maxHolesPerDay}
              onChange={(e) => updateConfig({ maxHolesPerDay: Number(e.target.value) || 0 })}
            />
          </div>
        </Field>

        <Field label="Créditos (mín. / máx.)">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              placeholder="—"
              className={`${inputClass} w-full`}
              value={config.minCredits === -1 ? "" : config.minCredits}
              onChange={(e) => updateConfig({ minCredits: e.target.value === "" ? -1 : Number(e.target.value) })}
            />
            <input
              type="number"
              min={0}
              placeholder="—"
              className={`${inputClass} w-full`}
              value={config.maxCredits === -1 ? "" : config.maxCredits}
              onChange={(e) => updateConfig({ maxCredits: e.target.value === "" ? -1 : Number(e.target.value) })}
            />
          </div>
        </Field>
      </div>
    </div>
  );
}
