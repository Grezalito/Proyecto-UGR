"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Upload } from "lucide-react";
import ImagePicker from "@/components/ui/ImagePicker";
import { COVER_PRESETS } from "@/lib/initial-data";
import { isHttpUrl } from "@/lib/store";
import type { NewTrack } from "@/lib/types";

type Errors = Partial<Record<"title" | "src" | "cover", string>>;

type Props = { onSubmit: (track: NewTrack) => void; onCancel: () => void };

export default function TrackForm({ onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [src, setSrc] = useState("");
  const [cover, setCover] = useState(COVER_PRESETS[0].url);
  const [errors, setErrors] = useState<Errors>({});

  const titleRef = useRef<HTMLInputElement>(null);
  const srcRef = useRef<HTMLInputElement>(null);
  const ids = { title: useId(), artist: useId(), src: useId(), srcHint: useId() };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!title.trim()) next.title = "Escribí el título de la canción.";
    if (!isHttpUrl(src)) next.src = "Pegá una dirección de audio que empiece con https://";
    if (cover && !isHttpUrl(cover)) next.cover = "La portada debe ser una dirección https://";
    setErrors(next);

    if (next.title) return titleRef.current?.focus();
    if (next.src) return srcRef.current?.focus();
    if (next.cover) return;

    onSubmit({ title, artist: artist.trim() || "Artista desconocido", src, cover });
  };

  const field = "min-h-12 rounded-xl border border-slate-300 px-4 text-lg";

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-5">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.title} className="text-lg font-bold">
            Título <span className="text-ugr-red">*</span>
          </label>
          <input
            ref={titleRef}
            id={ids.title}
            data-autofocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            autoComplete="off"
            aria-required
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? `${ids.title}-err` : undefined}
            className={field}
          />
          {errors.title && (
            <p id={`${ids.title}-err`} className="text-base font-bold text-ugr-red">
              {errors.title}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={ids.artist} className="text-lg font-bold">
            Artista
          </label>
          <input
            id={ids.artist}
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            maxLength={80}
            autoComplete="off"
            className={field}
          />
        </div>

        <div className="col-span-2 flex flex-col gap-1">
          <label htmlFor={ids.src} className="text-lg font-bold">
            Dirección (URL) del audio <span className="text-ugr-red">*</span>
          </label>
          <input
            ref={srcRef}
            id={ids.src}
            type="url"
            inputMode="url"
            value={src}
            onChange={(e) => setSrc(e.target.value.trim())}
            placeholder="https://…/cancion.mp3"
            aria-required
            aria-invalid={errors.src ? true : undefined}
            aria-describedby={`${ids.srcHint}${errors.src ? ` ${ids.src}-err` : ""}`}
            className={field}
          />
          <p id={ids.srcHint} className="text-sm text-slate-500">
            Archivo MP3/OGG o stream en vivo. Ej.: https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3
          </p>
          {errors.src && (
            <p id={`${ids.src}-err`} className="text-base font-bold text-ugr-red">
              {errors.src}
            </p>
          )}
        </div>
      </div>

      <ImagePicker
        label="Portada"
        value={cover}
        onChange={setCover}
        presets={COVER_PRESETS}
        error={errors.cover}
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
          <Upload aria-hidden className="size-5" />
          Cargar pista
        </button>
      </div>
    </form>
  );
}
