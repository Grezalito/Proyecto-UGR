"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import RadioChat from "@/components/radio/RadioChat";
import RadioDeck from "@/components/radio/RadioDeck";
import Soundboard from "@/components/radio/Soundboard";
import { UGR_LOGO } from "@/lib/initial-data";

function formatElapsed(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export default function RadioConsolePage() {
  const [onAir, setOnAir] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!onAir) return;
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [onAir]);

  const toggle = () => {
    setElapsed(0);
    setOnAir((v) => !v);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* ───────── Master Control ───────── */}
      <header className="sticky top-0 z-40 bg-ugr-blue text-white shadow-md">
        <div className="mx-auto flex h-header max-w-[1800px] items-center justify-between gap-8 px-8">
          <div className="flex items-center gap-5">
            <div className="flex h-14 items-center rounded-xl bg-white px-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={UGR_LOGO} alt="Universidad del Gran Rosario" className="h-10 w-auto" width={133} height={40} />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-wider text-white/70 uppercase">Master control</p>
              <h1 className="text-2xl font-bold">Estudio Radio UGR</h1>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Baliza + switch AL AIRE */}
            <div
              className={`flex items-center gap-5 rounded-2xl border-2 px-5 py-2 transition-colors ${
                onAir ? "border-white bg-ugr-red" : "border-white/30 bg-ugr-blue-dark"
              }`}
            >
              <span aria-hidden className="relative flex size-6">
                {onAir && <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/80" />}
                <span
                  className={`relative inline-flex size-6 rounded-full border-2 border-white ${
                    onAir ? "bg-white" : "bg-slate-500"
                  }`}
                />
              </span>

              <div className="min-w-44 leading-tight">
                <p aria-hidden className="text-2xl font-bold tracking-wide">
                  {onAir ? "AL AIRE" : "FUERA DE AIRE"}
                </p>
                <p aria-hidden className="font-mono text-base text-white/85">
                  {onAir ? formatElapsed(elapsed) : "Micrófono cerrado"}
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={onAir}
                aria-label="Transmisión al aire"
                onClick={toggle}
                className={`relative h-12 w-24 shrink-0 rounded-full border-2 border-white transition-colors ${
                  onAir ? "bg-white/30" : "bg-white/10"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute top-1 left-1 size-9 rounded-full bg-white shadow transition-transform ${
                    onAir ? "translate-x-12" : ""
                  }`}
                />
              </button>
            </div>

            <p role="status" className="sr-only">
              {onAir ? "Estás al aire." : "Estás fuera de aire."}
            </p>

            <Link
              href="/"
              className="flex min-h-12 items-center gap-2 rounded-xl border border-white/60 px-4 text-base font-bold hover:bg-white hover:text-ugr-blue"
            >
              <LogOut aria-hidden className="size-5" />
              Volver al selector
            </Link>
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
        <RadioDeck />
        <Soundboard />
        <RadioChat />
      </main>
    </div>
  );
}
