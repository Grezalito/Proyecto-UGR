"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Bell, Grid2x2, Hand, Megaphone, Minus, Plus, Sparkles, Square, type LucideIcon } from "lucide-react";
import { playEffect, setEffectsVolume, stopAllEffects, type EffectId } from "@/lib/audio-synth";

type Pad = { id: EffectId; label: string; Icon: LucideIcon; base: string; glow: string };

const PADS: Pad[] = [
  { id: "aplausos", label: "Aplausos", Icon: Hand, base: "bg-[#c2410c]", glow: "shadow-[0_0_32px_8px_rgba(249,115,22,0.75)]" },
  { id: "bocina", label: "Bocina de aire", Icon: Megaphone, base: "bg-ugr-red", glow: "shadow-[0_0_32px_8px_rgba(227,0,15,0.75)]" },
  { id: "campana", label: "Campana", Icon: Bell, base: "bg-[#047857]", glow: "shadow-[0_0_32px_8px_rgba(16,185,129,0.75)]" },
  { id: "cortina", label: "Cortina", Icon: Sparkles, base: "bg-[#6d28d9]", glow: "shadow-[0_0_32px_8px_rgba(139,92,246,0.75)]" },
];

type Active = { duration: number; nonce: number };

export default function Soundboard() {
  const [active, setActive] = useState<Partial<Record<EffectId, Active>>>({});
  const [volume, setVolume] = useState(80);
  const [error, setError] = useState("");
  const timers = useRef(new Map<EffectId, number>());
  const nonce = useRef(0);
  const volumeId = useId();

  useEffect(() => setEffectsVolume(volume / 100), [volume]);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => window.clearTimeout(t));
  }, []);

  const clearPad = (id: EffectId) =>
    setActive((a) => {
      const next = { ...a };
      delete next[id];
      return next;
    });

  const trigger = async (id: EffectId) => {
    try {
      const duration = await playEffect(id);
      setError("");
      setActive((a) => ({ ...a, [id]: { duration, nonce: ++nonce.current } }));
      window.clearTimeout(timers.current.get(id));
      timers.current.set(id, window.setTimeout(() => clearPad(id), duration * 1000));
    } catch {
      setError("Tu navegador no permitió reproducir el efecto.");
    }
  };

  const stopAll = () => {
    stopAllEffects();
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current.clear();
    setActive({});
  };

  const changeVolume = (v: number) => setVolume(Math.min(100, Math.max(0, v)));
  const anyActive = Object.keys(active).length > 0;

  return (
    <section
      aria-labelledby="titulo-cartuchera"
      className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <h2 id="titulo-cartuchera" className="flex items-center gap-3 text-xl font-bold text-ugr-blue">
          <Grid2x2 aria-hidden className="size-6" />
          Cartuchera de efectos
        </h2>
        <span role="status" className="text-sm font-bold text-slate-600">
          {anyActive ? "Efecto en curso" : "Lista"}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-6 bg-slate-900 p-6">
        {/* Pads */}
        <ul className="grid grid-cols-2 gap-4">
          {PADS.map(({ id, label, Icon, base, glow }) => {
            const state = active[id];
            const on = Boolean(state);
            return (
              <li key={id} className="flex">
                <button
                  type="button"
                  onClick={() => void trigger(id)}
                  aria-label={`Disparar efecto: ${label}`}
                  aria-describedby={on ? `${id}-sonando` : undefined}
                  className={`relative flex aspect-square w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 text-white transition-all duration-150 active:scale-95 ${base} ${
                    on ? `scale-[1.02] border-white brightness-110 ${glow}` : "border-white/10 hover:brightness-110"
                  }`}
                >
                  <Icon aria-hidden className="size-14" strokeWidth={2} />
                  <span className="text-xl font-bold">{label}</span>
                  {state && (
                    <>
                      <span id={`${id}-sonando`} className="sr-only">
                        sonando
                      </span>
                      <span
                        key={state.nonce}
                        aria-hidden
                        className="absolute inset-x-0 bottom-0 h-2 origin-left animate-pad-drain bg-white/90"
                        style={{ animationDuration: `${state.duration}s` }}
                      />
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Fader master */}
        <div className="rounded-xl bg-white/5 p-4 text-white">
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor={volumeId} className="text-base font-bold">
              Master de efectos
            </label>
            <output htmlFor={volumeId} className="rounded-lg bg-white/10 px-3 py-1 font-mono text-2xl font-bold">
              {volume}%
            </output>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => changeVolume(volume - 5)}
              aria-label="Bajar master de efectos"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
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
              aria-label="Volumen master de efectos"
              aria-valuetext={`${volume} por ciento`}
              className="h-12 flex-1"
            />
            <button
              type="button"
              onClick={() => changeVolume(volume + 5)}
              aria-label="Subir master de efectos"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            >
              <Plus aria-hidden className="size-6" strokeWidth={3} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={stopAll}
          disabled={!anyActive}
          className="flex min-h-14 items-center justify-center gap-3 rounded-xl border-2 border-white/30 text-lg font-bold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Square aria-hidden className="size-5" fill="currentColor" />
          Cortar todos los efectos
        </button>

        <p role="alert" className="text-base font-bold text-red-300 empty:hidden">
          {error}
        </p>
      </div>
    </section>
  );
}
