import { useState } from "react";
import { useAppStore } from "../store/appStore";

export function ImportTextPanel() {
  const importText = useAppStore((s) => s.importText);
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  function submit() {
    if (!value.trim()) return;
    const { warnings, added } = importText(value);
    setValue("");
    const parts = [`${added} curso(s) agregado(s).`];
    if (warnings.length > 0) parts.push(`${warnings.length} advertencia(s) - revisa la consola.`);
    if (warnings.length > 0) console.warn("Advertencias de importación:", warnings);
    setFeedback(parts.join(" "));
    window.setTimeout(() => setFeedback(null), 4000);
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder="Pega aquí el texto exportado por el portal de tu universidad..."
        className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]"
      />
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={submit}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-ink)]"
        >
          Importar texto
        </button>
        {feedback && <span className="text-[11px] text-[var(--text-muted)]">{feedback}</span>}
      </div>
    </div>
  );
}
