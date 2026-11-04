/**
 * Efectos de cartuchera generados en tiempo real con Web Audio API.
 * No usa archivos externos: todo se sintetiza, así que suena al instante.
 * Solo debe usarse en el navegador (Client Components).
 */

export type EffectId = "aplausos" | "bocina" | "campana" | "cortina";

type Graph = { ctx: AudioContext; master: GainNode; bus: DynamicsCompressorNode; noise: AudioBuffer };

let graph: Graph | null = null;
let effectsVolume = 0.8;

function getGraph(): Graph {
  if (graph) return graph;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();

  // Compresor para evitar saturación cuando se disparan varios efectos juntos.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.ratio.value = 12;
  limiter.connect(ctx.destination);

  const master = ctx.createGain();
  master.gain.value = effectsVolume;
  master.connect(limiter);

  // Ruido blanco reutilizable (2 s) para los aplausos.
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const channel = noise.getChannelData(0);
  for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;

  graph = { ctx, master, bus: limiter, noise };
  return graph;
}

/** Volumen general de la cartuchera, de 0 a 1. */
export function setEffectsVolume(value: number) {
  effectsVolume = Math.min(1, Math.max(0, value));
  if (graph) graph.master.gain.setTargetAtTime(effectsVolume, graph.ctx.currentTime, 0.02);
}

/**
 * Corta en seco todos los efectos que están sonando:
 * desconecta el bus master actual y crea uno nuevo.
 */
export function stopAllEffects() {
  if (!graph) return;
  const { ctx, bus } = graph;
  const old = graph.master;
  old.gain.cancelScheduledValues(ctx.currentTime);
  old.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
  window.setTimeout(() => old.disconnect(), 200);

  const master = ctx.createGain();
  master.gain.value = effectsVolume;
  master.connect(bus);
  graph.master = master;
}

/* ───────── Utilidades ───────── */

function envelope(
  param: AudioParam,
  t: number,
  peak: number,
  attack: number,
  hold: number,
  release: number,
) {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(peak, t + attack);
  param.setValueAtTime(peak, t + attack + hold);
  param.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
}

/* ───────── Efectos ───────── */

function applause({ ctx, master, noise }: Graph, t0: number): number {
  const duration = 3;
  const claps = 160;

  const bus = ctx.createGain();
  bus.gain.value = 0.9;
  bus.connect(master);

  for (let i = 0; i < claps; i++) {
    // Más densidad en el centro: crece, se mantiene y se apaga.
    const t = t0 + duration * Math.pow(Math.random(), 0.9) * 0.92;
    const progress = (t - t0) / duration;
    const intensity = Math.sin(Math.PI * Math.min(1, progress * 1.15)) * 0.6 + 0.15;

    const src = ctx.createBufferSource();
    src.buffer = noise;

    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 900 + Math.random() * 1800;
    band.Q.value = 0.8 + Math.random() * 1.2;

    const gain = ctx.createGain();
    envelope(gain.gain, t, intensity, 0.002, 0.004, 0.03 + Math.random() * 0.05);

    src.connect(band).connect(gain).connect(bus);
    src.start(t, Math.random() * 1.5, 0.12);
  }
  return duration;
}

function airHorn({ ctx, master }: Graph, t0: number): number {
  // Patrón clásico de bocina: corto, corto, largo.
  const blasts: [number, number][] = [
    [0, 0.22],
    [0.3, 0.22],
    [0.6, 1.1],
  ];
  const freqs = [349, 440, 523]; // Fa – La – Do: acorde brillante

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 3200;
  lowpass.connect(master);

  for (const [offset, length] of blasts) {
    const t = t0 + offset;
    const gain = ctx.createGain();
    envelope(gain.gain, t, 0.22, 0.015, length, 0.08);
    gain.connect(lowpass);

    for (const f of freqs) {
      for (const detune of [-8, 8]) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(f * 0.94, t);
        osc.frequency.exponentialRampToValueAtTime(f, t + 0.06);
        osc.detune.value = detune;
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + length + 0.12);
      }
    }
  }
  return 1.9;
}

function bell({ ctx, master }: Graph, t0: number): number {
  const base = 784; // Sol5
  // Parciales inarmónicos típicos de una campana.
  const partials: [number, number, number][] = [
    [0.5, 0.35, 3.2],
    [1, 0.5, 2.6],
    [2.0, 0.25, 1.8],
    [2.76, 0.22, 1.4],
    [5.4, 0.12, 0.9],
    [8.93, 0.06, 0.5],
  ];
  for (const [ratio, amp, decay] of partials) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = base * ratio;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(amp * 0.5, t0 + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + decay + 0.05);
  }
  return 3.2;
}

function curtain({ ctx, master }: Graph, t0: number): number {
  // Cortina institucional: arpegio ascendente + acorde final.
  const bus = ctx.createGain();
  bus.gain.value = 0.5;
  bus.connect(master);

  const note = (freq: number, t: number, length: number, type: OscillatorType, peak: number) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    envelope(gain.gain, t, peak, 0.01, length * 0.4, length * 0.6);
    osc.connect(gain).connect(bus);
    osc.start(t);
    osc.stop(t + length + 0.05);
  };

  const arpeggio = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // Do mayor
  arpeggio.forEach((f, i) => {
    note(f, t0 + i * 0.11, 0.25, "square", 0.12);
    note(f / 2, t0 + i * 0.11, 0.25, "triangle", 0.25);
  });

  const chordAt = t0 + arpeggio.length * 0.11 + 0.05;
  for (const f of [523.25, 659.25, 783.99, 1046.5]) {
    note(f, chordAt, 1.4, "triangle", 0.3);
    note(f * 1.003, chordAt, 1.4, "sawtooth", 0.05);
  }
  note(130.81, chordAt, 1.4, "sine", 0.5); // bajo

  return chordAt - t0 + 1.5;
}

const EFFECTS: Record<EffectId, (g: Graph, t0: number) => number> = {
  aplausos: applause,
  bocina: airHorn,
  campana: bell,
  cortina: curtain,
};

/**
 * Dispara un efecto y devuelve su duración aproximada en segundos.
 * Debe llamarse desde un gesto del usuario (click / tecla) la primera vez.
 */
export async function playEffect(id: EffectId): Promise<number> {
  const g = getGraph();
  if (g.ctx.state === "suspended") await g.ctx.resume();
  return EFFECTS[id](g, g.ctx.currentTime + 0.01);
}
