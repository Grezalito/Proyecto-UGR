"use client";

import { useId } from "react";
import { Check } from "lucide-react";
import SafeImage from "./SafeImage";
import type { ImagePreset } from "@/lib/types";

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  presets: ImagePreset[];
  error?: string;
};

/** Selector de imagen: 4 accesos rápidos + campo de URL libre + vista previa. */
export default function ImagePicker({ label, value, onChange, presets, error }: Props) {
  const urlId = useId();
  const errorId = useId();
  const hintId = useId();

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-2 text-lg font-bold text-slate-900">{label}</legend>

      <div role="group" aria-label="Imágenes rápidas" className="grid grid-cols-4 gap-3">
        {presets.map((p) => {
          const selected = value === p.url;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(p.url)}
              className={`group relative flex flex-col overflow-hidden rounded-xl border-2 bg-white text-left transition-shadow hover:shadow-md ${
                selected ? "border-ugr-blue ring-2 ring-ugr-blue/30" : "border-slate-200"
              }`}
            >
              <SafeImage src={p.url} alt="" className="aspect-[4/3] w-full" />
              <span className="flex min-h-11 items-center justify-between gap-1 px-3 text-base font-bold text-slate-800">
                {p.label}
                {selected && <Check aria-hidden className="size-5 text-ugr-blue" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[1fr_8rem] items-start gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={urlId} className="text-base font-bold text-slate-800">
            O pegá la dirección (URL) de una imagen
          </label>
          <input
            id={urlId}
            type="url"
            inputMode="url"
            value={value}
            onChange={(e) => onChange(e.target.value.trim())}
            placeholder="https://…"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${errorId} ${hintId}` : hintId}
            className="min-h-12 rounded-xl border border-slate-300 px-4 text-base"
          />
          <p id={hintId} className="text-sm text-slate-500">
            Si la dejás vacía se muestra un ícono genérico.
          </p>
          {error && (
            <p id={errorId} className="text-base font-bold text-ugr-red">
              {error}
            </p>
          )}
        </div>
        <div aria-hidden className="overflow-hidden rounded-xl border border-slate-200">
          <SafeImage src={value} alt="" className="aspect-[4/3] w-full" />
        </div>
      </div>
    </fieldset>
  );
}
