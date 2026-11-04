"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  RotateCcw,
  SkipBack,
  SkipForward,
  Trash2,
} from "lucide-react";
import TrackForm from "./TrackForm";
import Modal from "@/components/ui/Modal";
import SafeImage from "@/components/ui/SafeImage";
import { usePlaylist } from "@/lib/store";
import type { NewTrack, Track } from "@/lib/types";

type Status = "stopped" | "loading" | "playing" | "paused" | "error";

const STATUS_TEXT: Record<Status, string> = {
  stopped: "Listo",
  loading: "Cargando…",
  playing: "Sonando",
  paused: "En pausa",
  error: "No se pudo reproducir esta pista",
};

const VU_SEGMENTS = 20;

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function RadioDeck() {
  const { tracks, addTrack, removeTrack, moveTrack, resetPlaylist } = usePlaylist();

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

  const current: Track | null = tracks.find((t) => t.id === currentId) ?? tracks[0] ?? null;
  const currentIndex = current ? tracks.indexOf(current) : -1;
  const isPlaying = status === "playing" || status === "loading";
  const canSeek = Number.isFinite(time.duration) && time.duration > 0;

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

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

  const handleAdd = (input: NewTrack) => {
    const t = addTrack(input);
    setModalOpen(false);
    setAnnouncement(`Pista cargada: ${t.title}, de ${t.artist}. Está en el puesto ${tracks.length + 1}.`);
  };

  const handleRemove = (track: Track) => {
    if (track.id === current?.id) {
      releaseAudio();
      setStatus("stopped");
      setTime({ current: 0, duration: 0 });
      setCurrentId(null);
    }
    removeTrack(track.id);
    setConfirmId(null);
    setAnnouncement(`Se quitó ${track.title} de la lista.`);
    document.getElementById("titulo-playlist")?.focus();
  };

  const handleMove = (track: Track, dir: -1 | 1) => {
    const to = tracks.indexOf(track) + dir;
    pendingFocus.current = `${track.id}:${dir}`;
    moveTrack(track.id, dir);
    setAnnouncement(`${track.title} pasó al puesto ${to + 1}.`);
  };

  const handleReset = () => {
    if (!window.confirm("¿Restaurar las 4 pistas de ejemplo? Se pierden los cambios de la lista.")) return;
    releaseAudio();
    setStatus("stopped");
    setCurrentId(null);
    resetPlaylist();
    setAnnouncement("Lista restaurada con las pistas de ejemplo.");
  };

  const changeVolume = (v: number) => setVolume(Math.min(100, Math.max(0, v)));
  const litSegments = Math.round((volume / 100) * VU_SEGMENTS);

  const roundBtn =
    "flex items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <section
      aria-labelledby="titulo-deck"
      className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
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
        onTimeUpdate={(e) =>
          setTime({ current: e.currentTarget.currentTime, duration: e.currentTarget.duration })
        }
      />

      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <h2 id="titulo-deck" className="flex items-center gap-3 text-xl font-bold text-ugr-blue">
          <Disc3 aria-hidden className="size-6" />
          Deck de transmisión
        </h2>
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold ${
            status === "playing"
              ? "bg-red-50 text-ugr-red"
              : status === "error"
                ? "bg-red-100 text-ugr-red"
                : "bg-slate-100 text-slate-600"
          }`}
          role="status"
        >
          {STATUS_TEXT[status]}
        </span>
      </header>

      {/* ───────── Reproductor ───────── */}
      <div className="flex flex-col gap-5 bg-slate-900 p-6 text-white">
        <div className="flex items-center gap-5">
          <div className="relative size-32 shrink-0 overflow-hidden rounded-xl bg-slate-800 shadow-lg">
            {current && <SafeImage src={current.cover} alt="" className="size-full" />}
            {status === "playing" && (
              <span className="absolute right-2 bottom-2 rounded-md bg-ugr-red px-2 py-0.5 text-xs font-bold">
                EN CURSO
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-wider text-white/60 uppercase">
              {current ? `Pista ${currentIndex + 1} de ${tracks.length}` : "Sin pistas"}
            </p>
            <p className="truncate text-3xl font-bold">{current?.title ?? "Cargá una pista para empezar"}</p>
            <p className="truncate text-lg text-white/75">{current?.artist ?? "—"}</p>
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
            aria-label="Posición de la canción"
            aria-valuetext={`${formatTime(time.current)} de ${formatTime(time.duration)}`}
            className="h-12 w-full disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="flex justify-between font-mono text-base text-white/80" aria-hidden>
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
            className={`${roundBtn} size-16 bg-white/10 hover:bg-white/20`}
          >
            <SkipBack aria-hidden className="size-7" fill="currentColor" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!current}
            aria-label={isPlaying ? "Pausar" : `Reproducir ${current?.title ?? ""}`}
            className={`${roundBtn} size-24 bg-ugr-red shadow-lg hover:bg-ugr-red-dark`}
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
            className={`${roundBtn} size-16 bg-white/10 hover:bg-white/20`}
          >
            <SkipForward aria-hidden className="size-7" fill="currentColor" />
          </button>
        </div>

        {/* Volumen */}
        <div className="rounded-xl bg-white/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor={volumeId} className="text-base font-bold">
              Volumen del deck
            </label>
            <output htmlFor={volumeId} className="rounded-lg bg-white/10 px-3 py-1 font-mono text-2xl font-bold">
              {volume}%
            </output>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => changeVolume(volume - 5)}
              aria-label="Bajar volumen del deck"
              className={`${roundBtn} size-12 shrink-0 bg-white/10 hover:bg-white/20`}
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
              aria-label="Volumen del deck"
              aria-valuetext={`${volume} por ciento`}
              className="h-12 flex-1"
            />
            <button
              type="button"
              onClick={() => changeVolume(volume + 5)}
              aria-label="Subir volumen del deck"
              className={`${roundBtn} size-12 shrink-0 bg-white/10 hover:bg-white/20`}
            >
              <Plus aria-hidden className="size-6" strokeWidth={3} />
            </button>
          </div>
          <div aria-hidden className="mt-3 flex h-4 gap-1">
            {Array.from({ length: VU_SEGMENTS }, (_, i) => (
              <span
                key={i}
                className={`flex-1 rounded-sm ${
                  i < litSegments
                    ? i >= VU_SEGMENTS * 0.85
                      ? "bg-ugr-red"
                      : i >= VU_SEGMENTS * 0.65
                        ? "bg-focus"
                        : "bg-emerald-400"
                    : "bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ───────── Lista de reproducción ───────── */}
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 id="titulo-playlist" tabIndex={-1} className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <ListMusic aria-hidden className="size-5 text-ugr-blue" />
            Lista de reproducción
            <span className="text-base font-normal text-slate-500">({tracks.length})</span>
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              aria-label="Restaurar pistas de ejemplo"
              className="flex size-12 items-center justify-center rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100"
            >
              <RotateCcw aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex min-h-12 items-center gap-2 rounded-xl bg-ugr-red px-4 text-base font-bold text-white shadow-sm hover:bg-ugr-red-dark"
            >
              <Plus aria-hidden className="size-5" strokeWidth={3} />
              Cargar pista
            </button>
          </div>
        </div>

        {tracks.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 text-center text-lg text-slate-600">
            No hay pistas. Tocá <strong>Cargar pista</strong> para agregar una.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {tracks.map((t, i) => {
              const isCurrent = t.id === current?.id;
              const confirming = confirmId === t.id;
              return (
                <li
                  key={t.id}
                  className={`flex items-center gap-3 rounded-xl border p-2 transition-shadow hover:shadow-sm ${
                    isCurrent ? "border-ugr-blue bg-blue-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void startTrack(t)}
                    aria-current={isCurrent ? "true" : undefined}
                    aria-label={`Reproducir pista ${i + 1}: ${t.title}, de ${t.artist}`}
                    className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
                  >
                    <span className="w-6 text-center font-mono text-base text-slate-500">{i + 1}</span>
                    <SafeImage src={t.cover} alt="" className="size-12 shrink-0 rounded-lg" />
                    <span className="min-w-0">
                      <span className="block truncate text-base font-bold text-slate-900">{t.title}</span>
                      <span className="block truncate text-sm text-slate-600">{t.artist}</span>
                    </span>
                    {isCurrent && isPlaying && (
                      <span className="ml-auto shrink-0 rounded-full bg-ugr-red px-2 py-0.5 text-xs font-bold text-white">
                        SONANDO
                      </span>
                    )}
                  </button>

                  {confirming ? (
                    <div role="group" aria-label={`Confirmar quitar ${t.title}`} className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleRemove(t)}
                        className="min-h-12 rounded-lg bg-ugr-red px-3 text-sm font-bold text-white hover:bg-ugr-red-dark"
                      >
                        Quitar
                      </button>
                      <button
                        type="button"
                        autoFocus
                        onClick={() => setConfirmId(null)}
                        className="min-h-12 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
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
                        className="flex size-12 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                      >
                        <ArrowUp aria-hidden className="size-5" />
                      </button>
                      <button
                        type="button"
                        data-focus-key={`${t.id}:1`}
                        onClick={() => handleMove(t, 1)}
                        disabled={i === tracks.length - 1}
                        aria-label={`Bajar ${t.title}`}
                        className="flex size-12 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                      >
                        <ArrowDown aria-hidden className="size-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(t.id)}
                        aria-label={`Quitar ${t.title} de la lista`}
                        className="flex size-12 items-center justify-center rounded-lg text-slate-600 hover:bg-red-50 hover:text-ugr-red"
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
        onClose={() => setModalOpen(false)}
        title="Cargar pista"
        description="Agregá una canción a la lista de reproducción."
      >
        <TrackForm onSubmit={handleAdd} onCancel={() => setModalOpen(false)} />
      </Modal>
    </section>
  );
}
