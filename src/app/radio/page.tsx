"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import RadioChat from "@/components/radio/RadioChat";
import RadioDeck, { type RadioDeckHandle } from "@/components/radio/RadioDeck";
import Soundboard from "@/components/radio/Soundboard";
import ModuleTabs from "@/components/ui/ModuleTabs";
import { UGR_LOGO } from "@/lib/initial-data";
import type { Track } from "@/lib/types";

const BASE_LISTENERS = 142;
const LISTENER_DRIFT = 3;
const LISTENER_TICK = 4_000;
const VU_LEDS = 16;
const VU_TICK = 110;

function formatElapsed(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

/* ───────── Preferencia de movimiento reducido ───────── */

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

const useReducedMotion = () =>
  useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );

/* ───────── Vúmetro estéreo simulado ───────── */

function ledColor(i: number, lit: boolean) {
  if (!lit) return "bg-slate-800";
  if (i >= VU_LEDS - 2) return "bg-ugr-red shadow-[0_0_8px_rgba(227,0,15,0.9)]";
  if (i >= VU_LEDS - 5) return "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]";
  return "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]";
}

function VuMeter({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const [levels, setLevels] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    if (!active || reduced) return;
    const id = window.setInterval(() => {
      setLevels(([l, r]) => {
        const target = 0.45 + Math.random() * 0.5;
        const next = (prev: number) => Math.min(1, Math.max(0.15, prev * 0.45 + (target + (Math.random() - 0.5) * 0.25) * 0.55));
        return [next(l), next(r)];
      });
    }, VU_TICK);
    return () => window.clearInterval(id);
  }, [active, reduced]);

  // Con movimiento reducido se muestra un nivel fijo en lugar de animar.
  const shown: [number, number] = !active ? [0, 0] : reduced ? [0.62, 0.58] : levels;

  return (
    <div
      role="img"
      aria-label={active ? "Vúmetro: hay señal de audio" : "Vúmetro: sin señal"}
      className="flex flex-col gap-1.5 rounded-xl bg-slate-950 px-3 py-2 ring-1 ring-slate-700"
    >
      {(["L", "R"] as const).map((ch, c) => {
        const lit = Math.round(shown[c] * VU_LEDS);
        return (
          <div key={ch} className="flex items-center gap-2" aria-hidden>
            <span className="w-3 font-mono text-xs font-bold text-slate-300">{ch}</span>
            <div className="flex gap-[3px]">
              {Array.from({ length: VU_LEDS }, (_, i) => (
                <span key={i} className={`h-3 w-2.5 rounded-[2px] transition-colors duration-75 ${ledColor(i, i < lit)}`} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────── Página ───────── */

export default function RadioConsolePage() {
  const [onAir, setOnAir] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [listeners, setListeners] = useState(0);
  const [deckPlaying, setDeckPlaying] = useState(false);
  const deckRef = useRef<RadioDeckHandle>(null);

  useEffect(() => {
    if (!onAir) return;
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [onAir]);

  // Oyentes en vivo: oscilan ±3 alrededor de 142 mientras se está al aire.
  useEffect(() => {
    if (!onAir) return;
    const id = window.setInterval(() => {
      setListeners((n) => {
        const delta = Math.floor(Math.random() * (LISTENER_DRIFT * 2 + 1)) - LISTENER_DRIFT;
        return Math.min(BASE_LISTENERS + 15, Math.max(BASE_LISTENERS - 15, n + delta));
      });
    }, LISTENER_TICK);
    return () => window.clearInterval(id);
  }, [onAir]);

  const toggle = () => {
    const next = !onAir;
    setElapsed(0);
    setListeners(next ? BASE_LISTENERS : 0);
    setOnAir(next);
  };

  const handleTrackAdded = useCallback((track: Track) => deckRef.current?.appendTrack(track), []);

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-slate-100">
      {/* ───────── Master Control ───────── */}
      <header className="sticky top-0 z-40 border-b border-slate-700/80 bg-slate-950 shadow-lg">
        <div className="mx-auto flex h-header max-w-[1800px] items-center justify-between gap-6 px-8">
          <div className="flex items-center gap-5">
            <Link href="/" className="flex h-14 items-center rounded-xl bg-white px-3" aria-label="Ir al inicio">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={UGR_LOGO} alt="Universidad del Gran Rosario" className="h-10 w-auto" width={133} height={40} />
            </Link>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-wider text-slate-400 uppercase">Master control</p>
              <h1 className="text-2xl font-bold tracking-tight text-white">Estudio Radio UGR</h1>
            </div>
            <ModuleTabs current="radio" />
          </div>

          <div className="flex items-center gap-4">
            <VuMeter active={onAir || deckPlaying} />

            {/* Oyentes en vivo */}
            <p
              className={`flex min-h-12 items-center gap-2 rounded-full px-4 text-base font-bold ring-1 ${
                onAir ? "bg-red-950/70 text-white ring-red-400/50" : "bg-slate-800 text-slate-300 ring-slate-700"
              }`}
            >
              <span aria-hidden className={`size-3 rounded-full ${onAir ? "animate-pulse bg-ugr-red" : "bg-slate-500"}`} />
              <span className="font-mono text-xl tabular-nums">{listeners}</span>
              {listeners === 1 ? "oyente en vivo" : "oyentes en vivo"}
            </p>

            {/* Baliza + switch AL AIRE */}
            <div
              className={`flex items-center gap-4 rounded-2xl border-2 px-4 py-2 transition-colors ${
                onAir ? "border-red-300 bg-ugr-red shadow-[0_0_28px_rgba(227,0,15,0.55)]" : "border-slate-600 bg-slate-800"
              }`}
            >
              <div className="min-w-36 leading-tight" aria-hidden>
                <p className="text-xl font-black tracking-wide text-white">{onAir ? "AL AIRE" : "FUERA DE AIRE"}</p>
                <p className="font-mono text-base text-white/85">{onAir ? formatElapsed(elapsed) : "Micrófono cerrado"}</p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={onAir}
                aria-label="Transmisión al aire"
                onClick={toggle}
                className={`relative h-12 w-24 shrink-0 rounded-full border-2 border-white transition-[transform,background-color] duration-100 active:scale-[0.98] ${
                  onAir ? "bg-white/30" : "bg-white/10"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute top-1 left-1 size-9 rounded-full bg-white shadow transition-transform ${onAir ? "translate-x-12" : ""}`}
                />
              </button>
            </div>

            <p role="status" className="sr-only">
              {onAir ? `Estás al aire con ${BASE_LISTENERS} oyentes.` : "Estás fuera de aire."}
            </p>
          </div>
        </div>
      </header>

      {/* ───────── Consola ───────── */}
      <main
        id="contenido"
        tabIndex={-1}
        aria-label="Consola del operador"
        className="mx-auto grid w-full max-w-[1800px] flex-1 grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(22rem,26rem)] items-start gap-6 px-8 py-8"
      >
        <RadioDeck ref={deckRef} onPlayingChange={setDeckPlaying} />
        <Soundboard />
        <RadioChat onTrackAdded={handleTrackAdded} />
      </main>
    </div>
  );
}
