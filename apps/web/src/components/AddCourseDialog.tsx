import { createCourse } from "@unapp/core";
import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { Modal } from "./Modal";

export function AddCourseDialog({ onClose }: { onClose: () => void }) {
  const addManualCourse = useAppStore((s) => s.addManualCourse);
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [credits, setCredits] = useState("3");

  function submit() {
    if (!name.trim() || !id.trim()) return;
    addManualCourse(createCourse({ id: id.trim(), name: name.trim(), credits: Number(credits) || 0 }));
    onClose();
  }

  return (
    <Modal title="Agregar curso manualmente" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input
          className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          placeholder="Nombre del curso"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          placeholder="Código / ID"
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
        <input
          className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          placeholder="Créditos"
          type="number"
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
        />
        <p className="text-[11px] text-[var(--text-faint)]">
          Los grupos y horarios se agregan pegando el texto exportado por tu universidad, o próximamente desde este
          mismo diálogo.
        </p>
        <button
          type="button"
          onClick={submit}
          className="mt-1 rounded-lg bg-[var(--accent)] py-2 text-sm font-semibold text-[var(--accent-ink)]"
        >
          Agregar
        </button>
      </div>
    </Modal>
  );
}
