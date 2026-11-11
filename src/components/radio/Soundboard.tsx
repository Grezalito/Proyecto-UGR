"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell, Grid2x2, Hand, Keyboard, Megaphone, Minus, Plus, Sparkles, Square, type LucideIcon } from "lucide-react";
import { playEffect, setEffectsVolume, stopAllEffects, type EffectId } from "@/lib/audio-synth";

type Pad = {
  id: EffectId;
  label: string;
  key: string;
  Icon: LucideIcon;
  /** Borde y texto del pad apagado. */
  idle: string;
  /** Relleno y halo neón del pad encendido. */
  lit: string;
};

const PADS: Pad[] = [
  {
    id: "aplausos",
    label: "Aplausos",
    key: "1",
    Icon: Hand,
    idle: "border-orange-400/70 text-orange-200 shadow-[0_0_14px_rgba(251,146,60,0.25),inset_0_0_18px_rgba(251,146,60,0.15)]",
    lit: "border-orange-200 bg-orange-600 text-white shadow-[0_0_36px_10px_rgba(251,146,60,0.7)]",
  },
  {
    id: "bocina",
    label: "Bocina de aire",
    key: "2",
    Icon: Megaphone,
    idle: "border-red-400/70 text-red-200 shadow-[0_0_14px_rgba(248,113,113,0.25),inset_0_0_18px_rgba(227,0,15,0.18)]",
    lit: "border-red-200 bg-ugr-red text-white shadow-[0_0_36px_10px_rgba(227,0,15,0.7)]",
  },
  {
    id: "campana",
    label: "Campana",
    key: "3",
    Icon: Bell,
    idle: "border-emerald-400/70 text-emerald-200 shadow-[0_0_14px_rgba(52,211,153,0.25),inset_0_0_18px_rgba(52,211,153,0.15)]",
    lit: "border-emerald-200 bg-emerald-700 text-white shadow-[0_0_36px_10px_rgba(16,185,129,0.7)]",
  },
  {
    id: "cortina",
    label: "Cortina",
    key: "4",
    Icon: Sparkles,
    idle: "border-violet-400/70 text-violet-200 shadow-[0_0_14px_rgba(167,139,250,0.25),inset_0_0_18px_rgba(139,92,246,0.18)]",
    lit: "border-violet-200 bg-violet-700 text-white shadow-[0_0_36px_10px_rgba(139,92,246,0.7)]",
  },
];

const PAD_BY_KEY = new Map(PADS.map((p) => [p.key, p.id]));

type Active = { duration: number; nonce: number };

/** No dispara atajos mientras se escribe en un campo. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && !["range", "checkbox", "radio", "button"].includes(target.type);
}

export default function Soundboard() {
  const [active, setActive] = useState<Partial<Record<EffectId, Active>>>({});
  const [volume, setVolume] = useState(80);
  const [error, setError] = useState("");
  const timers = useRef(new Map<EffectId, number>());
  const nonce = useRef(0);
  const volumeId = useId();
  const hintId = useId();

  useEffect(() => setEffectsVolume(volume / 100), [volume]);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => window.clearTimeout(t));
  }, []);

  const trigger = useCallback(async (id: EffectId) => {
    try {
      const duration = await playEffect(id);
      setError("");
      setActive((a) => ({ ...a, [id]: { duration, nonce: ++nonce.current } }));
      window.clearTimeout(timers.current.get(id));
      timers.current.set(
        id,
        window.setTimeout(
          () =>
            setActive((a) => {
              const next = { ...a };
              delete next[id];
              return next;
            }),
          duration * 1000,
        ),
      );
    } catch {
      setError("Tu navegador no permitió reproducir el efecto.");
    }
  }, []);

  // Atajos de teclado 1–4 (WCAG 2.1.4: solo sin modificadores y fuera de campos de texto).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const id = PAD_BY_KEY.get(e.key);
      if (!id) return;
      e.preventDefault();
      void trigger(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trigger]);

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
      className="flex flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-800/60 shadow-sm transition-shadow hover:shadow-md"
    >
      <header className="flex items-center justify-between gap-4 border-b border-slate-700/80 px-6 py-4">
        <h2 id="titulo-cartuchera" className="flex items-center gap-3 text-xl font-bold tracking-tight text-white">
          <Grid2x2 aria-hidden className="size-6 text-sky-300" />
          Cartuchera de efectos
        </h2>
        <span
          role="status"
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${
            anyActive ? "bg-ugr-red text-white" : "bg-slate-700 text-slate-200"
          }`}
        >
          <span aria-hidden className={`size-2 rounded-full ${anyActive ? "animate-pulse bg-white" : "bg-slate-400"}`} />
          {anyActive ? "Efecto en curso" : "Lista"}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6">
        <p id={hintId} className="flex items-center gap-2 text-sm text-slate-300">
          <Keyboard aria-hidden className="size-4" />
          Atajos: teclas 1 a 4 (fuera de los campos de texto).
        </p>

        {/* Pads MPC */}
        <ul className="grid grid-cols-2 gap-4 rounded-2xl bg-slate-950 p-4 ring-1 ring-slate-700">
          {PADS.map(({ id, label, key, Icon, idle, lit }) => {
            const state = active[id];
            const on = Boolean(state);
            return (
              <li key={id} className="flex">
                <button
                  type="button"
                  onClick={() => void trigger(id)}
                  aria-label={`Disparar efecto: ${label}`}
                  aria-keyshortcuts={key}
                  aria-describedby={`${hintId}${on ? ` ${id}-sonando` : ""}`}
                  className={`relative flex aspect-square w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border-2 bg-slate-900 transition-[transform,box-shadow,background-color] duration-100 active:scale-[0.98] ${
                    on ? lit : `${idle} hover:bg-slate-800`
                  }`}
                >
                  <kbd
                    aria-hidden
                    className="absolute top-2 left-2 flex size-8 items-center justify-center rounded-md border border-current/50 bg-black/40 font-mono text-base font-bold"
                  >
                    {key}
                  </kbd>
                  <Icon aria-hidden className="size-12" strokeWidth={2} />
                  <span className="px-2 text-center text-lg leading-tight font-bold">{label}</span>
                  {state && (
                    <>
                      <span id={`${id}-sonando`} className="sr-only">
                        sonando
                      </span>
                      <span
                        key={state.nonce}
                        aria-hidden
                        className="absolute inset-x-0 bottom-0 h-1.5 origin-left animate-pad-drain bg-white/90"
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
        <div className="rounded-xl bg-slate-900 p-4 ring-1 ring-slate-700">
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor={volumeId} className="text-base font-bold text-slate-100">
              Master de efectos
            </label>
            <output htmlFor={volumeId} className="rounded-lg bg-slate-800 px-3 py-1 font-mono text-2xl font-bold text-white">
              {volume}%
            </output>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => changeVolume(volume - 5)}
              aria-label="Bajar master de efectos"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white transition-transform duration-100 hover:bg-slate-700 active:scale-[0.98]"
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
              aria-label="Subir master de efectos"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white transition-transform duration-100 hover:bg-slate-700 active:scale-[0.98]"
            >
              <Plus aria-hidden className="size-6" strokeWidth={3} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={stopAll}
          disabled={!anyActive}
          className="flex min-h-14 items-center justify-center gap-3 rounded-xl border-2 border-slate-500 text-lg font-bold text-white transition-transform duration-100 hover:bg-slate-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
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
