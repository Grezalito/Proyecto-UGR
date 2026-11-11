"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CircleCheck, Pencil, Trash2 } from "lucide-react";
import CategoryIcon from "./CategoryIcon";
import SafeImage from "@/components/ui/SafeImage";
import { formatARS } from "@/lib/store";
import type { Category, Product } from "@/lib/types";

type Props = {
  product: Product;
  /** Categoría resuelta desde la base (puede faltar si fue borrada). */
  category?: Category;
  /** Resalta la tarjeta tras guardar cambios (confirmación visual). */
  highlighted?: boolean;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
};

const press = "transition-[transform,background-color,border-color,color] duration-100 active:scale-[0.98]";

export default function ProductAdminCard({ product, category, highlighted = false, onEdit, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const headingId = useId();

  // Manejo del foco al entrar y salir de la confirmación.
  useEffect(() => {
    if (confirming) cancelDeleteRef.current?.focus();
    else if (returnFocus.current) {
      deleteBtnRef.current?.focus();
      returnFocus.current = false;
    }
  }, [confirming]);

  const cancelDelete = () => {
    returnFocus.current = true;
    setConfirming(false);
  };

  return (
    <article
      aria-labelledby={headingId}
      className={`group flex flex-1 flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
        highlighted ? "border-emerald-500 ring-4 ring-emerald-500/25" : "border-slate-200/80"
      }`}
    >
      <div className="relative overflow-hidden rounded-xl bg-slate-100">
        <SafeImage
          src={product.image}
          alt={product.name}
          className="aspect-square w-full rounded-xl object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-sm font-bold text-ugr-blue shadow-sm ring-1 ring-ugr-blue/15 backdrop-blur">
          <CategoryIcon name={category?.icon} className="size-4" />
          {category?.name ?? product.categoryId}
        </span>
        {highlighted && (
          <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-sm font-bold text-white shadow-sm">
            <CircleCheck aria-hidden className="size-4" />
            Guardado
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <h3 id={headingId} className="text-lg leading-snug font-bold tracking-tight text-slate-900">
          {product.name}
        </h3>

        <p className="w-fit rounded-lg bg-blue-50 px-3 py-1 text-lg font-black text-[#0033a0] ring-1 ring-[#0033a0]/10">
          <span className="sr-only">Precio: </span>
          {formatARS(product.price)}
        </p>

        {confirming ? (
          <div
            role="group"
            aria-label={`Confirmar eliminación de ${product.name}`}
            className="mt-auto rounded-xl border border-ugr-red/40 bg-red-50 p-3"
          >
            <p className="mb-3 text-base font-bold text-slate-900">¿Eliminar este producto?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onDelete(product.id)}
                className={`min-h-12 rounded-xl bg-ugr-red font-bold text-white hover:bg-ugr-red-dark ${press}`}
              >
                Sí, eliminar
              </button>
              <button
                ref={cancelDeleteRef}
                type="button"
                onClick={cancelDelete}
                onKeyDown={(e) => e.key === "Escape" && cancelDelete()}
                className={`min-h-12 rounded-xl border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100 ${press}`}
              >
                No, volver
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-auto grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onEdit(product)}
              aria-label={`Editar ${product.name}`}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border border-ugr-blue/40 font-bold text-ugr-blue hover:bg-blue-50 ${press}`}
            >
              <Pencil aria-hidden className="size-5" />
              Editar
            </button>
            <button
              ref={deleteBtnRef}
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`Eliminar ${product.name}`}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:border-ugr-red hover:bg-red-50 hover:text-ugr-red ${press}`}
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
