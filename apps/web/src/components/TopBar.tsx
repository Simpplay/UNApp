import { useRef, useState } from "react";
import { downloadText } from "../lib/download";
import { useAppStore } from "../store/appStore";
import { DownloadIcon, GearIcon, PlusIcon, UploadIcon } from "./icons";
import { Modal } from "./Modal";

export function TopBar() {
  const universities = useAppStore((s) => s.universities);
  const selectedId = useAppStore((s) => s.selectedUniversityId);
  const selectUniversity = useAppStore((s) => s.selectUniversity);
  const addManualUniversity = useAppStore((s) => s.addManualUniversity);
  const toggleSettings = useAppStore((s) => s.toggleSettings);
  const exportBackup = useAppStore((s) => s.exportBackup);
  const importBackup = useAppStore((s) => s.importBackup);
  const selectedUniversityExists = Boolean(selectedId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  function handleExport() {
    const json = exportBackup();
    if (!json) return;
    downloadText(`${selectedId}.unapp.json`, json, "application/json");
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const result = importBackup(text);
    setImportFeedback(result.ok ? "Respaldo importado." : (result.error ?? "No se pudo importar."));
    window.setTimeout(() => setImportFeedback(null), 4000);
  }

  function submitAdd() {
    const result = addManualUniversity(name, id);
    if (!result.ok) {
      setError(result.error ?? "No se pudo agregar.");
      return;
    }
    setAddOpen(false);
    setName("");
    setId("");
    setError(null);
  }

  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--panel)] px-6">
      <div className="flex items-center gap-3.5">
        <div className="font-display text-[19px] font-bold tracking-tight text-[var(--text)]">UNApp</div>
        <select
          value={selectedId ?? ""}
          onChange={(e) => selectUniversity(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
        >
          <option value="" disabled>
            Selecciona una universidad
          </option>
          {universities.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
          aria-label="Agregar universidad"
        >
          <PlusIcon width={13} height={13} />
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        {importFeedback && <span className="mr-1 text-[11px] text-[var(--text-muted)]">{importFeedback}</span>}
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleFileSelected} />
        <button
          type="button"
          onClick={handleImportClick}
          disabled={!selectedUniversityExists}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-30"
          aria-label="Importar respaldo"
          title="Importar respaldo (.json) - también acepta un respaldo de la versión anterior de UNApp"
        >
          <UploadIcon />
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={!selectedUniversityExists}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-30"
          aria-label="Exportar respaldo"
          title="Exportar respaldo (.json)"
        >
          <DownloadIcon />
        </button>
        <button
          type="button"
          onClick={toggleSettings}
          disabled={!selectedUniversityExists}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-30"
          aria-label="Configuración"
        >
          <GearIcon />
        </button>
      </div>

      {addOpen && (
        <Modal title="Agregar universidad" onClose={() => setAddOpen(false)}>
          <div className="flex flex-col gap-3">
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
              placeholder="Nombre de la universidad"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
              placeholder="ID (sin espacios)"
              value={id}
              onChange={(e) => setId(e.target.value)}
            />
            {error && <div className="text-xs text-rose-400">{error}</div>}
            <button
              type="button"
              onClick={submitAdd}
              className="mt-1 rounded-lg bg-[var(--accent)] py-2 text-sm font-semibold text-[var(--accent-ink)]"
            >
              Agregar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
