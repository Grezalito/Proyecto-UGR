"use client";

import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Ícono decorativo junto al título. */
  icon?: LucideIcon;
  /** Mientras es true no se puede cerrar (p. ej. guardando en la base). */
  busy?: boolean;
  size?: "md" | "lg";
  children: ReactNode;
};

const WIDTH = { md: "w-[min(40rem,calc(100vw-2rem))]", lg: "w-[min(56rem,calc(100vw-2rem))]" } as const;

/**
 * Modal accesible basado en <dialog> nativo:
 * atrapa el foco, cierra con Escape o clic en el fondo, vuelve el foco al
 * disparador y deja inerte el resto de la página.
 * Enfoca el primer elemento con [data-autofocus] al abrir.
 */
export default function Modal({ open, onClose, title, description, icon: Icon, busy = false, size = "lg", children }: Props) {
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

  const requestClose = () => {
    if (!busy) onClose();
  };

  // El <dialog> ocupa solo la tarjeta: un clic cuyo target es el propio dialog cayó en el fondo.
  const onBackdropClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) requestClose();
  };

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClose={() => open && onClose()}
      onClick={onBackdropClick}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      aria-busy={busy}
      className={`m-auto ${WIDTH[size]} overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-0 text-slate-900 shadow-2xl transition-[opacity,transform] duration-200 backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm starting:open:translate-y-2 starting:open:opacity-0`}
    >
      <div className="flex items-start justify-between gap-6 border-b border-slate-200/80 bg-slate-50/80 px-8 py-6">
        <div className="flex items-start gap-4">
          {Icon && (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-ugr-blue text-white shadow-sm">
              <Icon aria-hidden className="size-6" />
            </span>
          )}
          <div>
            <h2 id={titleId} className="text-2xl font-bold tracking-tight text-slate-900">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-base text-slate-600">
                {description}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={requestClose}
          disabled={busy}
          aria-label="Cerrar ventana"
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-[transform,background-color] duration-100 hover:bg-slate-100 active:scale-[0.98] disabled:opacity-40"
        >
          <X aria-hidden className="size-6" />
        </button>
      </div>
      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-8 py-6">{open && children}</div>
    </dialog>
  );
}
