"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
};

/**
 * Modal accesible basado en <dialog> nativo:
 * atrapa el foco, cierra con Escape, vuelve el foco al disparador
 * y deja inerte el resto de la página.
 * Enfoca el primer elemento con [data-autofocus] al abrir.
 */
export default function Modal({ open, onClose, title, description, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className="m-auto w-[min(44rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-6 border-b border-slate-200 px-8 py-6">
        <div>
          <h2 id={titleId} className="text-2xl font-bold text-ugr-blue">
            {title}
          </h2>
          {description && (
            <p id={descId} className="mt-1 text-base text-slate-600">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ventana"
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
        >
          <X aria-hidden className="size-6" />
        </button>
      </div>
      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-8 py-6">{open && children}</div>
    </dialog>
  );
}
