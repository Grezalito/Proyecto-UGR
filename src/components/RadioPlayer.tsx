"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, Pause, Play, Radio, Volume2, VolumeX } from "lucide-react";

type Status = "stopped" | "loading" | "playing" | "error";

type Props = { streamUrl: string; stationName: string };

const STATUS_TEXT: Record<Status, string> = {
  stopped: "En pausa",
  loading: "Conectando…",
  playing: "En vivo",
  error: "No se pudo conectar. Probá de nuevo.",
};

export default function RadioPlayer({ streamUrl, stationName }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const statusRef = useRef<Status>("stopped");
  const [status, setStatusState] = useState<Status>("stopped");
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const volumeId = useId();

  const setStatus = (s: Status) => {
    statusRef.current = s;
    setStatusState(s);
  };

  // Sincroniza volumen y silencio con el elemento <audio>.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
    audio.muted = muted;
  }, [volume, muted]);

  /** Corta la descarga del stream por completo. */
  const releaseStream = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  };

  const play = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setStatus("loading");
    // Recarga siempre el stream en vivo (evita reproducir audio viejo del buffer).
    audio.src = streamUrl;
    audio.load();
    try {
      await audio.play();
    } catch {
      if (statusRef.current === "loading") {
        releaseStream();
        setStatus("error");
      }
    }
  };

  const stop = () => {
    setStatus("stopped");
    releaseStream();
  };

  const toggle = () => (status === "playing" || status === "loading" ? stop() : play());

  // Libera la conexión si el componente se desmonta.
  useEffect(() => () => releaseStream(), []);

  const isActive = status === "playing" || status === "loading";
  const isSilent = muted || volume === 0;

  return (
    <section aria-label={`Reproductor de ${stationName}`} className="flex items-center gap-5">
      <audio
        ref={audioRef}
        preload="none"
        onPlaying={() => setStatus("playing")}
        onWaiting={() => statusRef.current === "playing" && setStatus("loading")}
        onPause={() => {
          // Pausa externa (teclas multimedia, sistema operativo): también cortamos la descarga.
          if (statusRef.current === "playing" || statusRef.current === "loading") stop();
        }}
        onError={() => {
          if (statusRef.current === "playing" || statusRef.current === "loading") {
            releaseStream();
            setStatus("error");
          }
        }}
      />

      <div className="flex flex-col items-end leading-tight">
        <span className="flex items-center gap-2 text-lg font-bold">
          <Radio aria-hidden className="size-5" />
          {stationName}
        </span>
        <span role="status" className="flex items-center gap-2 text-base">
          {status === "playing" && (
            <span aria-hidden className="inline-block size-3 rounded-full bg-ugr-red ring-2 ring-white" />
          )}
          {STATUS_TEXT[status]}
        </span>
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-label={isActive ? `Pausar ${stationName}` : `Escuchar ${stationName} en vivo`}
        className="flex size-16 items-center justify-center rounded-full bg-white text-ugr-blue shadow transition-transform hover:scale-105"
      >
        {status === "loading" ? (
          <LoaderCircle aria-hidden className="size-8 animate-spin" />
        ) : isActive ? (
          <Pause aria-hidden className="size-8" fill="currentColor" />
        ) : (
          <Play aria-hidden className="size-8 translate-x-0.5" fill="currentColor" />
        )}
      </button>

      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        aria-pressed={muted}
        aria-label={muted ? "Activar sonido" : "Silenciar"}
        className="flex size-14 items-center justify-center rounded-full border-2 border-white/70 text-white hover:bg-white/15"
      >
        {isSilent ? <VolumeX aria-hidden className="size-7" /> : <Volume2 aria-hidden className="size-7" />}
      </button>

      <div className="flex flex-col">
        <label htmlFor={volumeId} className="text-sm font-bold">
          Volumen: {muted ? "silenciado" : `${volume}%`}
        </label>
        <input
          id={volumeId}
          type="range"
          min={0}
          max={100}
          step={5}
          value={volume}
          aria-valuetext={muted ? "Silenciado" : `${volume} por ciento`}
          onChange={(e) => {
            setVolume(Number(e.target.value));
            if (muted) setMuted(false);
          }}
          className="h-8 w-40"
        />
      </div>
    </section>
  );
}
