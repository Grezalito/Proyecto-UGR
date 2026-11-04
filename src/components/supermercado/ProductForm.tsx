"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import ImagePicker from "@/components/ui/ImagePicker";
import { CATEGORIES, PRODUCT_IMAGE_PRESETS } from "@/lib/initial-data";
import { formatARS, isHttpUrl, parseARSInput } from "@/lib/store";
import type { CategoryId, NewProduct } from "@/lib/types";

type Errors = Partial<Record<"name" | "price" | "image", string>>;

type Props = {
  onSubmit: (product: NewProduct) => void;
  onCancel: () => void;
};

export default function ProductForm({ onSubmit, onCancel }: Props) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<CategoryId>("almacen");
  const [priceText, setPriceText] = useState("");
  const [image, setImage] = useState(PRODUCT_IMAGE_PRESETS[0].url);
  const [errors, setErrors] = useState<Errors>({});

  const nameRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const ids = { name: useId(), cat: useId(), price: useId(), priceHint: useId(), err: useId() };

  const priceCents = parseARSInput(priceText);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (name.trim().length < 2) next.name = "Escribí el nombre del producto.";
    if (priceCents === null) next.price = "Escribí un precio válido, por ejemplo 1500 o 1.500,50.";
    if (image && !isHttpUrl(image)) next.image = "La dirección de la imagen debe empezar con https://";
    setErrors(next);

    if (next.name) return nameRef.current?.focus();
    if (next.price) return priceRef.current?.focus();
    if (next.image) return;

    onSubmit({ name: name.trim(), categoryId, price: priceCents!, image });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-5">
        <div className="col-span-2 flex flex-col gap-1">
          <label htmlFor={ids.name} className="text-lg font-bold">
            Nombre del producto <span className="text-ugr-red">*</span>
          </label>
          <input
            ref={nameRef}
            id={ids.name}
            data-autofocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoComplete="off"
            placeholder="Ej.: Arroz largo fino 1 kg"
            aria-required
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${ids.name}-err` : undefined}
            className="min-h-12 rounded-xl border border-slate-300 px-4 text-lg"
          />
          {errors.name && (
            <p id={`${ids.name}-err`} className="text-base font-bold text-ugr-red">
              {errors.name}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={ids.cat} className="text-lg font-bold">
            Categoría
          </label>
          <select
            id={ids.cat}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value as CategoryId)}
            className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-lg"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={ids.price} className="text-lg font-bold">
            Precio en pesos <span className="text-ugr-red">*</span>
          </label>
          <div className="flex min-h-12 items-center rounded-xl border border-slate-300 focus-within:border-ugr-blue">
            <span aria-hidden className="pl-4 text-lg font-bold text-slate-500">
              $
            </span>
            <input
              ref={priceRef}
              id={ids.price}
              inputMode="decimal"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              placeholder="1.500,00"
              autoComplete="off"
              aria-required
              aria-invalid={errors.price ? true : undefined}
              aria-describedby={`${ids.priceHint}${errors.price ? ` ${ids.price}-err` : ""}`}
              className="min-h-12 w-full rounded-xl px-3 text-lg"
            />
          </div>
          <p id={ids.priceHint} className="text-base text-slate-600" aria-live="polite">
            {priceCents !== null ? `Se guardará como ${formatARS(priceCents)}` : "Ej.: 1500 o 1.500,50"}
          </p>
          {errors.price && (
            <p id={`${ids.price}-err`} className="text-base font-bold text-ugr-red">
              {errors.price}
            </p>
          )}
        </div>
      </div>

      <ImagePicker
        label="Imagen del producto"
        value={image}
        onChange={setImage}
        presets={PRODUCT_IMAGE_PRESETS}
        error={errors.image}
      />

      <div className="flex justify-end gap-4 border-t border-slate-200 pt-6">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-12 rounded-xl border border-slate-300 px-6 text-lg font-bold text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="flex min-h-12 items-center gap-2 rounded-xl bg-ugr-red px-6 text-lg font-bold text-white shadow-sm hover:bg-ugr-red-dark"
        >
          <Save aria-hidden className="size-5" />
          Guardar producto
        </button>
      </div>
    </form>
  );
}
