"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import SafeImage from "@/components/ui/SafeImage";
import { categoryName, centsToInput, formatARS, parseARSInput } from "@/lib/store";
import type { Product } from "@/lib/types";

type Mode = "view" | "edit" | "confirm-delete";

type Props = {
  product: Product;
  onUpdatePrice: (id: string, cents: number) => void;
  onDelete: (id: string) => void;
};

export default function ProductAdminCard({ product, onUpdatePrice, onDelete }: Props) {
  const [mode, setMode] = useState<Mode>("view");
  const [priceText, setPriceText] = useState("");
  const [error, setError] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<"edit" | "delete" | null>(null);

  const headingId = useId();
  const inputId = useId();
  const errorId = useId();

  // Manejo del foco al cambiar de modo.
  useEffect(() => {
    if (mode === "edit") inputRef.current?.select();
    else if (mode === "confirm-delete") cancelDeleteRef.current?.focus();
    else if (returnFocus.current) {
      (returnFocus.current === "edit" ? editBtnRef : deleteBtnRef).current?.focus();
      returnFocus.current = null;
    }
  }, [mode]);

  const startEdit = () => {
    setPriceText(centsToInput(product.price));
    setError("");
    setMode("edit");
  };

  const backToView = (focus: "edit" | "delete") => {
    returnFocus.current = focus;
    setMode("view");
  };

  const savePrice = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseARSInput(priceText);
    if (cents === null) {
      setError("Precio no válido. Ej.: 1500 o 1.500,50");
      inputRef.current?.focus();
      return;
    }
    onUpdatePrice(product.id, cents);
    backToView("edit");
  };

  const preview = parseARSInput(priceText);

  return (
    <article
      aria-labelledby={headingId}
      className="group flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative">
        <SafeImage src={product.image} alt={product.name} className="aspect-[4/3] w-full" />
        <span className="absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1 text-sm font-bold text-ugr-blue shadow-sm">
          {categoryName(product.categoryId)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <h3 id={headingId} className="text-xl leading-snug font-bold text-slate-900">
          {product.name}
        </h3>

        {mode === "edit" ? (
          <form onSubmit={savePrice} noValidate className="flex flex-col gap-2">
            <label htmlFor={inputId} className="text-base font-bold text-slate-700">
              Nuevo precio en pesos
            </label>
            <input
              ref={inputRef}
              id={inputId}
              inputMode="decimal"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && backToView("edit")}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="min-h-12 rounded-xl border border-slate-300 px-4 text-xl font-bold"
            />
            <p className="text-sm text-slate-600" aria-live="polite">
              {preview !== null ? `Quedará en ${formatARS(preview)}` : " "}
            </p>
            {error && (
              <p id={errorId} className="text-base font-bold text-ugr-red">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="submit"
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ugr-blue font-bold text-white hover:bg-ugr-blue-dark"
              >
                <Check aria-hidden className="size-5" strokeWidth={3} />
                Guardar
              </button>
              <button
                type="button"
                onClick={() => backToView("edit")}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-100"
              >
                <X aria-hidden className="size-5" />
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <p className="text-3xl font-bold text-ugr-blue">
            <span className="sr-only">Precio: </span>
            {formatARS(product.price)}
          </p>
        )}

        {mode === "confirm-delete" && (
          <div role="alertdialog" aria-label={`Confirmar eliminación de ${product.name}`} className="rounded-xl border border-ugr-red/40 bg-red-50 p-4">
            <p className="mb-3 text-base font-bold text-slate-900">¿Eliminar este producto del inventario?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onDelete(product.id)}
                className="min-h-12 rounded-xl bg-ugr-red font-bold text-white hover:bg-ugr-red-dark"
              >
                Sí, eliminar
              </button>
              <button
                ref={cancelDeleteRef}
                type="button"
                onClick={() => backToView("delete")}
                className="min-h-12 rounded-xl border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100"
              >
                No, volver
              </button>
            </div>
          </div>
        )}

        {mode === "view" && (
          <div className="mt-auto grid grid-cols-2 gap-2">
            <button
              ref={editBtnRef}
              type="button"
              onClick={startEdit}
              aria-label={`Editar precio de ${product.name}`}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-ugr-blue/40 font-bold text-ugr-blue hover:bg-blue-50"
            >
              <Pencil aria-hidden className="size-5" />
              Precio
            </button>
            <button
              ref={deleteBtnRef}
              type="button"
              onClick={() => setMode("confirm-delete")}
              aria-label={`Eliminar ${product.name}`}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:border-ugr-red hover:bg-red-50 hover:text-ugr-red"
            >
              <Trash2 aria-hidden className="size-5" />
              Eliminar
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
