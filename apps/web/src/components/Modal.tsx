import type { PropsWithChildren } from "react";
import { CloseIcon } from "./icons";

interface ModalProps {
  title: string;
  onClose: () => void;
  width?: number;
}

export function Modal({ title, onClose, width = 420, children }: PropsWithChildren<ModalProps>) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-2xl"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[15px] font-semibold text-[var(--text)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-white/5"
            aria-label="Cerrar"
          >
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
