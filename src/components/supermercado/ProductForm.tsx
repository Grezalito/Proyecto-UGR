"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, Save } from "lucide-react";
import CategoryIcon from "./CategoryIcon";
import ImagePicker from "@/components/ui/ImagePicker";
import SafeImage from "@/components/ui/SafeImage";
import { PRODUCT_IMAGE_PRESETS } from "@/lib/initial-data";
import { centsToInput, formatARS, isHttpUrl, parseARSInput } from "@/lib/store";
import type { Category, CategoryId, NewProduct, Product } from "@/lib/types";

type Errors = Partial<Record<"name" | "category" | "price" | "image", string>>;

type Props = {
  categories: Category[];
  /** Si viene, el formulario está en modo edición con estos datos precargados. */
  initial?: Product;
  submitting?: boolean;
  onSubmit: (product: NewProduct) => void;
  onCancel: () => void;
};

const press = "transition-[transform,background-color,box-shadow] duration-100 active:scale-[0.98]";

export default function ProductForm({ categories, initial, submitting = false, onSubmit, onCancel }: Props) {
  const editing = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [categoryId, setCategoryId] = useState<CategoryId>(initial?.categoryId ?? categories[0]?.id ?? "");
  const [priceText, setPriceText] = useState(initial ? centsToInput(initial.price) : "");
  const [image, setImage] = useState(initial?.image ?? PRODUCT_IMAGE_PRESETS[0].url);
  const [errors, setErrors] = useState<Errors>({});

  const nameRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLFieldSetElement>(null);
  const ids = { name: useId(), price: useId(), priceHint: useId(), cat: useId() };

  const priceCents = parseARSInput(priceText);
  const selectedCategory = categories.find((c) => c.id === categoryId);
  // Si la categoría original ya no figura en la lista, se conserva como opción.
  const options =
    initial && !categories.some((c) => c.id === initial.categoryId)
      ? [...categories, { id: initial.categoryId, name: initial.categoryId }]
      : categories;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const next: Errors = {};
    if (name.trim().length < 2) next.name = "Escribí el nombre del producto.";
    if (!categoryId) next.category = "Elegí una categoría.";
    if (priceCents === null) next.price = "Escribí un precio válido, por ejemplo 1500 o 1.500,50.";
    if (image && !isHttpUrl(image)) next.image = "La dirección de la imagen debe empezar con https://";
    setErrors(next);

    if (next.name) return nameRef.current?.focus();
    if (next.category) return categoryRef.current?.querySelector("input")?.focus();
    if (next.price) return priceRef.current?.focus();
    if (next.image) return;

    onSubmit({ name: name.trim(), categoryId, price: priceCents!, image });
  };

  const field =
    "min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-lg shadow-sm transition-colors focus:border-ugr-blue";

  return (
    <form onSubmit={submit} noValidate aria-busy={submitting} className="flex flex-col gap-7">
      <div className="grid grid-cols-[minmax(0,1fr)_14rem] gap-6">
        {/* ───────── Datos principales ───────── */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.name} className="text-lg font-bold text-slate-900">
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
              className={field}
            />
            {errors.name && (
              <p id={`${ids.name}-err`} className="text-base font-bold text-ugr-red">
                {errors.name}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={ids.price} className="text-lg font-bold text-slate-900">
              Precio en pesos <span className="text-ugr-red">*</span>
            </label>
            <div className="flex min-h-12 items-center rounded-xl border border-slate-300 bg-white shadow-sm focus-within:border-ugr-blue">
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

        {/* ───────── Vista previa en vivo ───────── */}
        <figure aria-hidden className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 p-3 shadow-sm">
          <SafeImage src={image} alt="" className="aspect-square w-full rounded-xl" />
          <span className="flex w-fit items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-ugr-blue ring-1 ring-ugr-blue/15">
            <CategoryIcon name={selectedCategory?.icon} className="size-3.5" />
            {selectedCategory?.name ?? "Sin categoría"}
          </span>
          <span className="line-clamp-2 text-base leading-snug font-bold text-slate-900">{name.trim() || "Nombre del producto"}</span>
          <span className="text-lg font-black text-[#0033a0]">{priceCents !== null ? formatARS(priceCents) : "$ —"}</span>
          <figcaption className="text-xs font-bold tracking-wide text-slate-500 uppercase">Vista previa</figcaption>
        </figure>
      </div>

      {/* ───────── Categoría (pills tipo radio) ───────── */}
      <fieldset
        ref={categoryRef}
        aria-describedby={errors.category ? `${ids.cat}-err` : undefined}
        aria-invalid={errors.category ? true : undefined}
        className="flex flex-col gap-2"
      >
        <legend className="mb-2 text-lg font-bold text-slate-900">
          Categoría <span className="text-ugr-red">*</span>
        </legend>
        {options.length === 0 ? (
          <p className="text-base text-slate-600">Todavía no hay categorías. Creá una desde el selector del catálogo.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {options.map((c) => (
              <label
                key={c.id}
                className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-full border px-4 text-base font-bold ${press} border-slate-200 bg-white text-slate-700 hover:border-ugr-blue/40 hover:bg-blue-50 has-[input:checked]:border-ugr-blue has-[input:checked]:bg-ugr-blue has-[input:checked]:text-white has-[input:checked]:shadow-md has-[input:focus-visible]:outline-4 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus`}
              >
                <input
                  type="radio"
                  name="categoria"
                  value={c.id}
                  checked={categoryId === c.id}
                  onChange={() => setCategoryId(c.id)}
                  className="sr-only"
                />
                <CategoryIcon name={c.icon} />
                {c.name}
              </label>
            ))}
          </div>
        )}
        {errors.category && (
          <p id={`${ids.cat}-err`} className="text-base font-bold text-ugr-red">
            {errors.category}
          </p>
        )}
      </fieldset>

      <ImagePicker
        label="Imagen del producto"
        value={image}
        onChange={setImage}
        presets={PRODUCT_IMAGE_PRESETS}
        error={errors.image}
      />

      <div className="sticky -bottom-6 -mx-8 -mb-6 flex justify-end gap-4 border-t border-slate-200/80 bg-white/95 px-8 py-5 backdrop-blur">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className={`min-h-12 rounded-xl border border-slate-300 px-6 text-lg font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 ${press}`}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className={`flex min-h-12 items-center gap-2 rounded-xl bg-ugr-red px-6 text-lg font-bold text-white shadow-sm hover:bg-ugr-red-dark disabled:opacity-70 ${press}`}
        >
          {submitting ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : <Save aria-hidden className="size-5" />}
          {submitting ? "Guardando…" : editing ? "Guardar cambios" : "Guardar producto"}
        </button>
      </div>
    </form>
  );
}
