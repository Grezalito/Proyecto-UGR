"use client";

import { useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import {
  ArrowDown,
  ArrowUp,
  Disc3,
  ListMusic,
  LoaderCircle,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  SkipBack,
  SkipForward,
  Trash2,
} from "lucide-react";
import TrackForm from "./TrackForm";
import Modal from "@/components/ui/Modal";
import SafeImage from "@/components/ui/SafeImage";
import type { NewTrack, Track } from "@/lib/types";

export type RadioDeckHandle = {
  /** Inserta una pista ya guardada en la base (p. ej. un pedido del chat). */
  appendTrack: (track: Track) => void;
};

type Props = {
  ref?: Ref<RadioDeckHandle>;
  /** Avisa al Master si el deck está sonando (para el vúmetro). */
  onPlayingChange?: (playing: boolean) => void;
};

type Status = "stopped" | "loading" | "playing" | "paused" | "error";
type LoadState = "loading" | "ready" | "error";

const API = "/api/tracks";
const SYNC_INTERVAL = 15_000;
const VU_SEGMENTS = 20;

const STATUS_TEXT: Record<Status, string> = {
  stopped: "Listo",
  loading: "Cargando…",
  playing: "Sonando",
  paused: "En pausa",
  error: "No se pudo reproducir esta pista",
};

const press = "transition-[transform,background-color,box-shadow] duration-100 active:scale-[0.98]";

async function apiError(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (typeof data === "object" && data !== null && "error" in data && typeof data.error === "string") {
      return data.error;
    }
  } catch {
    /* sin cuerpo JSON */
  }
  return `Error ${res.status}`;
}

async function fetchTracks(signal?: AbortSignal): Promise<Track[]> {
  const res = await fetch(API, { cache: "no-store", signal });
  if (!res.ok) throw new Error(await apiError(res));
  return (await res.json()) as Track[];
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function RadioDeck({ ref, onPlayingChange }: Props) {
  const [serverTracks, setServerTracks] = useState<Track[]>([]);
  /** Orden local de la sesión (la tabla no guarda posición). */
  const [order, setOrder] = useState<string[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("stopped");
  const [volume, setVolume] = useState(75);
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const seekId = useId();
  const volumeId = useId();

  const tracks = useMemo(() => {
    const rank = new Map(order.map((id, i) => [id, i]));
    return serverTracks
      .map((t, i) => ({ t, k: rank.get(t.id) ?? order.length + i }))
      .sort((a, b) => a.k - b.k)
      .map(({ t }) => t);
  }, [serverTracks, order]);

  const current: Track | null = tracks.find((t) => t.id === currentId) ?? tracks[0] ?? null;
  const currentIndex = current ? tracks.indexOf(current) : -1;
  const isPlaying = status === "playing" || status === "loading";
  const canSeek = Number.isFinite(time.duration) && time.duration > 0;

  useImperativeHandle(
    ref,
    () => ({
      appendTrack(track) {
        setServerTracks((list) => (list.some((t) => t.id === track.id) ? list : [...list, track]));
        setAnnouncement(`Pista sumada al deck: ${track.title}, de ${track.artist}.`);
      },
    }),
    [],
  );

  useEffect(() => {
    onPlayingChange?.(status === "playing");
  }, [status, onPlayingChange]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  /* ───────── Sincronización con la base ───────── */

  const apply = (data: Track[]) => {
    setServerTracks(data);
    setLoadState("ready");
    return data;
  };

  useEffect(() => {
    const controller = new AbortController();
    const onData = (data: Track[]) => {
      setServerTracks(data);
      setLoadState("ready");
    };
    fetchTracks(controller.signal).then(onData, (err: unknown) => {
      if ((err as DOMException)?.name !== "AbortError") setLoadState("error");
    });
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") fetchTracks().then(onData, () => undefined);
    }, SYNC_INTERVAL);
    return () => {
      controller.abort();
      window.clearInterval(id);
    };
  }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      const data = apply(await fetchTracks());
      setAnnouncement(`Lista sincronizada: ${data.length} pistas.`);
    } catch {
      setAnnouncement("No se pudo sincronizar la lista. Probá de nuevo.");
    } finally {
      setSyncing(false);
    }
  };

  // Recupera el foco después de reordenar (React mueve el nodo y el foco se pierde).
  useEffect(() => {
    if (!pendingFocus.current) return;
    const el =
      document.querySelector<HTMLButtonElement>(`[data-focus-key="${pendingFocus.current}"]:not(:disabled)`) ??
      document.querySelector<HTMLButtonElement>(`[data-focus-key^="${pendingFocus.current.split(":")[0]}:"]:not(:disabled)`);
    el?.focus();
    pendingFocus.current = null;
  }, [tracks]);

  /* ───────── Transporte ───────── */

  const releaseAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  };

  const startTrack = async (track: Track) => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentId(track.id);
    setTime({ current: 0, duration: 0 });
    setStatus("loading");
    audio.src = track.src;
    try {
      await audio.play();
    } catch (err) {
      if ((err as DOMException)?.name !== "AbortError") setStatus("error");
    }
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (isPlaying) {
      audio.pause();
    } else if (status === "paused" && audio.getAttribute("src") === current.src) {
      try {
        await audio.play();
      } catch {
        setStatus("error");
      }
    } else {
      void startTrack(current);
    }
  };

  const step = (dir: -1 | 1) => {
    if (!tracks.length) return;
    const i = currentIndex < 0 ? 0 : (currentIndex + dir + tracks.length) % tracks.length;
    void startTrack(tracks[i]);
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio || !canSeek) return;
    audio.currentTime = value;
    setTime((t) => ({ ...t, current: value }));
  };

  /* ───────── Gestión de la lista ───────── */

  const handleAdd = async (input: NewTrack) => {
    if (saving) return;
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await apiError(res));
      const t = (await res.json()) as Track;
      setServerTracks((list) => [...list.filter((x) => x.id !== t.id), t]);
      setModalOpen(false);
      setAnnouncement(`Pista cargada: ${t.title}, de ${t.artist}. Está en el puesto ${tracks.length + 1}.`);
    } catch (err) {
      setFormError(`No se pudo guardar la pista. ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (track: Track) => {
    if (track.id === current?.id) {
      releaseAudio();
      setStatus("stopped");
      setTime({ current: 0, duration: 0 });
      setCurrentId(null);
    }
    const index = serverTracks.findIndex((t) => t.id === track.id);
    setServerTracks((list) => list.filter((t) => t.id !== track.id));
    setConfirmId(null);
    document.getElementById("titulo-playlist")?.focus();
    try {
      const res = await fetch(`${API}?id=${encodeURIComponent(track.id)}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(await apiError(res));
      setAnnouncement(`Se quitó ${track.title} de la lista.`);
    } catch {
      setServerTracks((list) => {
        const next = [...list];
        next.splice(Math.min(Math.max(index, 0), next.length), 0, track);
        return next;
      });
      setAnnouncement(`No se pudo quitar ${track.title}. Probá de nuevo.`);
    }
  };

  const handleMove = (track: Track, dir: -1 | 1) => {
    const from = tracks.indexOf(track);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= tracks.length) return;
    const ids = tracks.map((t) => t.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    pendingFocus.current = `${track.id}:${dir}`;
    setOrder(ids);
    setAnnouncement(`${track.title} pasó al puesto ${to + 1}.`);
  };

  const changeVolume = (v: number) => setVolume(Math.min(100, Math.max(0, v)));
  const litSegments = Math.round((volume / 100) * VU_SEGMENTS);

  const roundBtn = `flex items-center justify-center rounded-full ${press} disabled:cursor-not-allowed disabled:opacity-40`;
  const iconBtn = `flex size-12 items-center justify-center rounded-lg text-slate-300 ${press}`;

  return (
    <section
      aria-labelledby="titulo-deck"
      className="flex flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-800/60 shadow-sm transition-shadow hover:shadow-md"
    >
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      <audio
        ref={audioRef}
        preload="none"
        onPlaying={() => setStatus("playing")}
        onWaiting={() => setStatus("loading")}
        onPause={() => setStatus((s) => (s === "playing" || s === "loading" ? "paused" : s))}
        onEnded={() => step(1)}
        onError={() => {
          if (audioRef.current?.getAttribute("src")) setStatus("error");
        }}
        onLoadedMetadata={(e) => setTime((t) => ({ ...t, duration: e.currentTarget.duration }))}
        onTimeUpdate={(e) => setTime({ current: e.currentTarget.currentTime, duration: e.currentTarget.duration })}
      />

      <header className="flex items-center justify-between gap-4 border-b border-slate-700/80 px-6 py-4">
        <h2 id="titulo-deck" className="flex items-center gap-3 text-xl font-bold tracking-tight text-white">
          <Disc3 aria-hidden className={`size-6 text-sky-300 ${status === "playing" ? "animate-spin [animation-duration:3s]" : ""}`} />
          Deck de transmisión
        </h2>
        <span
          role="status"
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${
            status === "playing"
              ? "bg-ugr-blue text-white ring-1 ring-sky-300/60"
              : status === "error"
                ? "bg-red-950 text-red-200 ring-1 ring-red-400/60"
                : "bg-slate-700 text-slate-200"
          }`}
        >
          <span
            aria-hidden
            className={`size-2 rounded-full ${status === "playing" ? "animate-pulse bg-sky-300" : status === "error" ? "bg-red-400" : "bg-slate-400"}`}
          />
          {STATUS_TEXT[status]}
        </span>
      </header>

      {/* ───────── Reproductor ───────── */}
      <div className="flex flex-col gap-5 bg-slate-900 p-6 text-white">
        <div className="flex items-center gap-5">
          <div className="relative size-32 shrink-0 overflow-hidden rounded-xl bg-slate-800 shadow-lg ring-1 ring-slate-700">
            {current && <SafeImage src={current.cover} alt="" className="size-full" />}
            {status === "playing" && (
              <span className="absolute right-2 bottom-2 rounded-full bg-ugr-red px-2 py-0.5 text-xs font-black tracking-wide">
                EN CURSO
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-wider text-slate-400 uppercase">
              {current ? `Pista ${currentIndex + 1} de ${tracks.length}` : "Sin pistas"}
            </p>
            <p className="truncate text-3xl font-bold tracking-tight">{current?.title ?? "Cargá una pista para empezar"}</p>
            <p className="truncate text-lg text-slate-300">{current?.artist ?? "—"}</p>
          </div>
        </div>

        {/* Barra de tiempo */}
        <div className="flex flex-col gap-1">
          <label htmlFor={seekId} className="sr-only">
            Posición de la canción
          </label>
          <input
            id={seekId}
            type="range"
            min={0}
            max={canSeek ? Math.floor(time.duration) : 0}
            step={1}
            value={canSeek ? Math.floor(time.current) : 0}
            disabled={!canSeek}
            onChange={(e) => seek(Number(e.target.value))}
            aria-valuetext={`${formatTime(time.current)} de ${formatTime(time.duration)}`}
            className="h-12 w-full disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="flex justify-between font-mono text-base text-slate-300" aria-hidden>
            <span>{formatTime(time.current)}</span>
            <span>{canSeek ? formatTime(time.duration) : time.duration === Infinity ? "EN VIVO" : "--:--"}</span>
          </div>
        </div>

        {/* Controles */}
        <div role="group" aria-label="Controles de reproducción" className="flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={!tracks.length}
            aria-label="Pista anterior"
            className={`${roundBtn} size-16 bg-slate-800 ring-1 ring-slate-600 hover:bg-slate-700`}
          >
            <SkipBack aria-hidden className="size-7" fill="currentColor" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!current}
            aria-label={isPlaying ? "Pausar" : `Reproducir ${current?.title ?? ""}`}
            className={`${roundBtn} size-24 bg-ugr-red shadow-[0_0_28px_rgba(227,0,15,0.45)] hover:bg-ugr-red-dark`}
          >
            {status === "loading" ? (
              <LoaderCircle aria-hidden className="size-11 animate-spin" />
            ) : isPlaying ? (
              <Pause aria-hidden className="size-11" fill="currentColor" />
            ) : (
              <Play aria-hidden className="size-11 translate-x-0.5" fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={!tracks.length}
            aria-label="Pista siguiente"
            className={`${roundBtn} size-16 bg-slate-800 ring-1 ring-slate-600 hover:bg-slate-700`}
          >
            <SkipForward aria-hidden className="size-7" fill="currentColor" />
          </button>
        </div>

        {/* Volumen */}
        <div className="rounded-xl bg-slate-800/70 p-4 ring-1 ring-slate-700">
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor={volumeId} className="text-base font-bold">
              Volumen del deck
            </label>
            <output htmlFor={volumeId} className="rounded-lg bg-slate-900 px-3 py-1 font-mono text-2xl font-bold">
              {volume}%
            </output>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => changeVolume(volume - 5)}
              aria-label="Bajar volumen del deck"
              className={`${roundBtn} size-12 shrink-0 bg-slate-700 hover:bg-slate-600`}
            >
              <Minus aria-hidden className="size-6" strokeWidth={3} />
            </button>
            <input
              id={volumeId}
              type="range"
              min={0}
              max={100}
              step={1}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-valuetext={`${volume} por ciento`}
              className="h-12 flex-1"
            />
            <button
              type="button"
              onClick={() => changeVolume(volume + 5)}
              aria-label="Subir volumen del deck"
              className={`${roundBtn} size-12 shrink-0 bg-slate-700 hover:bg-slate-600`}
            >
              <Plus aria-hidden className="size-6" strokeWidth={3} />
            </button>
          </div>
          <div aria-hidden className="mt-3 flex h-3 gap-1">
            {Array.from({ length: VU_SEGMENTS }, (_, i) => (
              <span
                key={i}
                className={`flex-1 rounded-sm ${
                  i < litSegments
                    ? i >= VU_SEGMENTS * 0.85
                      ? "bg-ugr-red"
                      : i >= VU_SEGMENTS * 0.65
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                    : "bg-slate-700"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ───────── Lista de reproducción ───────── */}
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 id="titulo-playlist" tabIndex={-1} className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
            <ListMusic aria-hidden className="size-5 text-sky-300" />
            Lista de reproducción
            <span className="rounded-full bg-slate-700 px-2 text-sm font-bold text-slate-200">{tracks.length}</span>
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={sync}
              disabled={syncing || loadState === "loading"}
              aria-label="Sincronizar lista con la base"
              className={`flex size-12 items-center justify-center rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-700 disabled:opacity-50 ${press}`}
            >
              <RefreshCw aria-hidden className={`size-5 ${syncing ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError("");
                setModalOpen(true);
              }}
              className={`flex min-h-12 items-center gap-2 rounded-xl bg-ugr-red px-4 text-base font-bold text-white shadow-sm hover:bg-ugr-red-dark ${press}`}
            >
              <Plus aria-hidden className="size-5" strokeWidth={3} />
              Cargar pista
            </button>
          </div>
        </div>

        {loadState === "loading" ? (
          <p role="status" className="flex items-center justify-center gap-3 rounded-xl border border-slate-700 px-6 py-10 text-lg text-slate-300">
            <LoaderCircle aria-hidden className="size-6 animate-spin text-sky-300" />
            Cargando pistas…
          </p>
        ) : loadState === "error" ? (
          <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border-2 border-red-400/50 bg-red-950/40 px-6 py-8 text-center">
            <p className="text-lg font-bold text-red-200">No se pudieron cargar las pistas.</p>
            <button
              type="button"
              onClick={() => {
                setLoadState("loading");
                fetchTracks().then(apply, () => setLoadState("error"));
              }}
              className={`flex min-h-12 items-center gap-2 rounded-xl bg-ugr-blue px-5 text-base font-bold text-white ${press}`}
            >
              <RefreshCw aria-hidden className="size-5" />
              Reintentar
            </button>
          </div>
        ) : tracks.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-slate-600 px-6 py-10 text-center text-lg text-slate-300">
            No hay pistas. Tocá <strong className="text-white">Cargar pista</strong> para agregar una.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {tracks.map((t, i) => {
              const isCurrent = t.id === current?.id;
              const confirming = confirmId === t.id;
              return (
                <li
                  key={t.id}
                  className={`flex items-center gap-3 rounded-xl border p-2 transition-colors ${
                    isCurrent ? "border-sky-300/60 bg-ugr-blue" : "border-slate-700 bg-slate-900/60 hover:bg-slate-900"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void startTrack(t)}
                    aria-current={isCurrent ? "true" : undefined}
                    aria-label={`Reproducir pista ${i + 1}: ${t.title}, de ${t.artist}`}
                    className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
                  >
                    <span className={`w-6 text-center font-mono text-base ${isCurrent ? "text-white" : "text-slate-400"}`}>{i + 1}</span>
                    <SafeImage src={t.cover} alt="" className="size-12 shrink-0 rounded-lg" />
                    <span className="min-w-0">
                      <span className="block truncate text-base font-bold text-white">{t.title}</span>
                      <span className={`block truncate text-sm ${isCurrent ? "text-blue-100" : "text-slate-300"}`}>{t.artist}</span>
                    </span>
                    {isCurrent && isPlaying && (
                      <span className="ml-auto shrink-0 rounded-full bg-ugr-red px-2 py-0.5 text-xs font-black text-white">
                        SONANDO
                      </span>
                    )}
                  </button>

                  {confirming ? (
                    <div role="group" aria-label={`Confirmar quitar ${t.title}`} className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleRemove(t)}
                        className={`min-h-12 rounded-lg bg-ugr-red px-3 text-sm font-bold text-white hover:bg-ugr-red-dark ${press}`}
                      >
                        Quitar
                      </button>
                      <button
                        type="button"
                        autoFocus
                        onClick={() => setConfirmId(null)}
                        className={`min-h-12 rounded-lg border border-slate-500 px-3 text-sm font-bold text-slate-100 hover:bg-slate-700 ${press}`}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        data-focus-key={`${t.id}:-1`}
                        onClick={() => handleMove(t, -1)}
                        disabled={i === 0}
                        aria-label={`Subir ${t.title}`}
                        className={`${iconBtn} hover:bg-white/10 disabled:opacity-30`}
                      >
                        <ArrowUp aria-hidden className="size-5" />
                      </button>
                      <button
                        type="button"
                        data-focus-key={`${t.id}:1`}
                        onClick={() => handleMove(t, 1)}
                        disabled={i === tracks.length - 1}
                        aria-label={`Bajar ${t.title}`}
                        className={`${iconBtn} hover:bg-white/10 disabled:opacity-30`}
                      >
                        <ArrowDown aria-hidden className="size-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(t.id)}
                        aria-label={`Quitar ${t.title} de la lista`}
                        className={`${iconBtn} hover:bg-red-950 hover:text-red-200`}
                      >
                        <Trash2 aria-hidden className="size-5" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title="Cargar pista"
        description="Agregá una canción a la lista de reproducción."
      >
        <div aria-busy={saving} className="flex flex-col gap-4">
          {formError && (
            <p role="alert" className="rounded-xl border border-ugr-red/40 bg-red-50 px-4 py-3 text-base font-bold text-ugr-red">
              {formError}
            </p>
          )}
          {saving && (
            <p role="status" className="flex items-center gap-2 text-base font-bold text-ugr-blue">
              <LoaderCircle aria-hidden className="size-5 animate-spin" />
              Guardando en la base…
            </p>
          )}
          <TrackForm onSubmit={(t) => void handleAdd(t)} onCancel={() => !saving && setModalOpen(false)} />
        </div>
      </Modal>
    </section>
  );
}
