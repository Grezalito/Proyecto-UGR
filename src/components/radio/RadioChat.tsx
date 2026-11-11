"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  Check,
  ListPlus,
  LoaderCircle,
  MessageSquareReply,
  MessagesSquare,
  Music,
  Pause,
  Play,
  Send,
  ShieldAlert,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { COVER_PRESETS } from "@/lib/initial-data";
import type { ChatMessageDTO, NewChatMessage } from "@/lib/turso";
import type { NewTrack, Track } from "@/lib/types";

type Props = {
  /** Se llama cuando un pedido del chat se guardó como pista en la base. */
  onTrackAdded?: (track: Track) => void;
};

const CHAT_API = "/api/chat";
const TRACKS_API = "/api/tracks";
const TRAFFIC_API = "/api/traffic";
const POLL_INTERVAL = 4_000;
const TRAFFIC_INTERVAL = 20_000;
const MAX_LENGTH = 280;
const MAX_VISIBLE = 30;
const HOST_NAME = "Conducción UGR";

/** "…tema de Soda Stereo?" → "Soda Stereo" (patrones que genera /api/traffic). */
const SONG_REQUEST_RE = /\b(?:tema|temita|canción|clásico) de (.+?)(?=[?!.,]| para |$)/i;

/** Demora con la que el oyente "contesta" al operador. */
const REPLY_MIN_MS = 3_000;
const REPLY_MAX_MS = 6_000;

/* ───────── Motor de diálogo: respuestas reactivas de los oyentes ───────── */

const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const REACTIONS: { test: RegExp; replies: readonly string[] }[] = [
  {
    test: /\b(tema|temazo|cancion|musica|pongo|pasamos|suena|sonando|disco)\b/,
    replies: [
      "¡Qué temazo metiste, sos un genio!",
      "¡Gracias! Ya subí el volumen a full acá en {city}.",
      "¡Ese tema me encanta! Lo estamos cantando todos.",
      "¡Uff, qué buena elección! Me hiciste el día.",
    ],
  },
  {
    test: /\b(precio|super|oferta|envio|stock|cuesta|sale|pesos)\b/,
    replies: [
      "¡Genial, gracias por averiguar! Mañana paso por el súper.",
      "¡Bárbaro! Ya le aviso a mi señora así hacemos la compra.",
      "¡Qué buena atención, chicos! Así da gusto comprar.",
    ],
  },
  {
    test: /\b(saludo|saludos|abrazo|beso|besos|mando)\b/,
    replies: [
      "¡Muchas gracias chicos! Acá los estamos escuchando en familia.",
      "¡Gracias por el saludo! Me alegraron la tarde en {city}.",
      "¡Qué lindo! Ya le cuento a todos en {city} que me saludaron por la radio.",
      "¡Otro abrazo grande para todo el equipo de la UGR!",
    ],
  },
  {
    test: /\b(gracias|agradezco|genio|grande)\b/,
    replies: ["¡Gracias a ustedes por hacer este programa!", "¡No, por favor! Ustedes son los genios."],
  },
  {
    test: /\?/,
    replies: [
      "¡Sí, claro! Los sigo todos los días desde {city}.",
      "¡Buena pregunta! Te respondo: acá en {city} está todo tranqui, escuchando la radio.",
    ],
  },
];

const DEFAULT_REPLIES = [
  "¡Gracias por leerme! Excelente programa.",
  "¡Me leyeron al aire! Ya le aviso a mi familia.",
  "¡Gracias chicos, sigan así que lo hacen bárbaro!",
] as const;

function buildReaction(operatorText: string, city: string | undefined, avoid: string | undefined): string {
  const text = normalize(operatorText);
  const pool = REACTIONS.find((r) => r.test.test(text))?.replies ?? DEFAULT_REPLIES;
  const options = pool.length > 1 ? pool.filter((r) => r !== avoid) : pool;
  return options[Math.floor(Math.random() * options.length)].replaceAll("{city}", city ?? "casa");
}

/** Busca al oyente aludido: el mensaje respondido o una mención "@Nombre" en el texto. */
function findAddressee(text: string, replyTo: ChatMessageDTO | null, messages: ChatMessageDTO[]): ChatMessageDTO | null {
  if (replyTo && replyTo.role === "oyente") return replyTo.flagged ? null : replyTo;
  const lower = normalize(text);
  const candidates = messages
    .filter((m) => m.role === "oyente" && !m.flagged)
    .sort((a, b) => b.author.length - a.author.length);
  return candidates.find((m) => lower.includes(`@${normalize(m.author)}`)) ?? null;
}

const press = "transition-[transform,background-color] duration-100 active:scale-[0.98]";

type LoadState = "loading" | "ready" | "error";
type RequestState = "saving" | "added";

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

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiError(res));
  return (await res.json()) as T;
}

async function fetchChat(): Promise<ChatMessageDTO[]> {
  const res = await fetch(CHAT_API, { cache: "no-store" });
  if (!res.ok) throw new Error(await apiError(res));
  return (await res.json()) as ChatMessageDTO[];
}

function songRequestArtist(m: ChatMessageDTO): string | null {
  if (m.role !== "oyente" || m.flagged) return null;
  return SONG_REQUEST_RE.exec(m.text)?.[1].trim() || null;
}

/** Pista de demostración libre de derechos asociada al pedido (estable por artista). */
function requestToTrack(m: ChatMessageDTO, artist: string): NewTrack {
  const hash = [...artist].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return {
    title: `Pedido de ${m.author}${m.city ? ` (${m.city})` : ""}`,
    artist,
    src: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(hash % 16) + 1}.mp3`,
    cover: COVER_PRESETS[hash % COVER_PRESETS.length].url,
  };
}

const isVisible = () => document.visibilityState === "visible";

export default function RadioChat({ onTrackAdded }: Props) {
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [paused, setPaused] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessageDTO | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [lastDeleted, setLastDeleted] = useState<ChatMessageDTO | null>(null);
  const [requests, setRequests] = useState<Record<string, RequestState>>({});
  /** Oyentes que están "escribiendo" una respuesta al operador. */
  const [typing, setTyping] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");

  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  /** Se incrementa en cada mutación local: descarta respuestas de polling que quedaron viejas. */
  const generation = useRef(0);
  const inFlight = useRef(false);
  const replyTimers = useRef(new Set<number>());
  const lastReaction = useRef(new Map<string, string>());
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();

  /* ───────── Lectura en vivo ───────── */

  const fetchMessages = useCallback((force = false) => {
    if (inFlight.current && !force) return;
    inFlight.current = true;
    const gen = generation.current;
    fetchChat()
      .then(
        (data) => {
          if (gen === generation.current) setMessages(data);
          setLoadState("ready");
        },
        () => setLoadState((s) => (s === "loading" ? "error" : s)),
      )
      .finally(() => {
        inFlight.current = false;
      });
  }, []);

  useEffect(() => {
    let active = true;
    fetchChat().then(
      (data) => {
        if (!active) return;
        setMessages(data);
        setLoadState("ready");
      },
      () => active && setLoadState("error"),
    );
    return () => {
      active = false;
    };
  }, []);

  // Polling cada 4 s (se pausa junto con los entrantes: WCAG 2.2.2).
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      if (isVisible()) fetchMessages();
    }, POLL_INTERVAL);
    return () => window.clearInterval(id);
  }, [paused, fetchMessages]);

  // Tráfico simulado: un oyente de la región escribe cada 20 s.
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(async () => {
      if (!isVisible()) return;
      try {
        const res = await fetch(TRAFFIC_API, { method: "POST" });
        if (!res.ok) return;
        const msg = (await res.json()) as ChatMessageDTO;
        setMessages((list) => (list.some((m) => m.id === msg.id) ? list : [...list, msg].slice(-MAX_VISIBLE)));
      } catch {
        /* la simulación es opcional: se reintenta en el próximo ciclo */
      }
    }, TRAFFIC_INTERVAL);
    return () => window.clearInterval(id);
  }, [paused]);

  useEffect(() => {
    const timers = replyTimers.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  // Autodesplazamiento si el operador ya estaba al final.
  useEffect(() => {
    const el = listRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 200) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const flaggedCount = messages.filter((m) => m.flagged).length;
  const pendingRequests = messages.filter((m) => songRequestArtist(m) && !requests[m.id]).length;

  /* ───────── Pedidos musicales ───────── */

  const addRequestToDeck = async (m: ChatMessageDTO, artist: string) => {
    if (requests[m.id]) return;
    setRequests((r) => ({ ...r, [m.id]: "saving" }));
    try {
      const track = await postJson<Track>(TRACKS_API, requestToTrack(m, artist));
      setRequests((r) => ({ ...r, [m.id]: "added" }));
      onTrackAdded?.(track);
      setAnnouncement(`Pedido de ${m.author} sumado al deck: ${artist}.`);
    } catch (err) {
      setRequests((r) => {
        const next = { ...r };
        delete next[m.id];
        return next;
      });
      setAnnouncement(`No se pudo sumar el pedido de ${m.author}. ${(err as Error).message}`);
    }
  };

  /* ───────── Moderación ───────── */

  const startReply = (msg: ChatMessageDTO) => {
    setReplyTo(msg);
    setError("");
    inputRef.current?.focus();
  };

  const remove = async (msg: ChatMessageDTO) => {
    generation.current++;
    setMessages((list) => list.filter((m) => m.id !== msg.id));
    if (replyTo?.id === msg.id) setReplyTo(null);
    listRef.current?.focus();
    try {
      const res = await fetch(`${CHAT_API}?id=${encodeURIComponent(msg.id)}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(await apiError(res));
      setLastDeleted(msg);
      setAnnouncement(`Mensaje de ${msg.author} borrado.`);
    } catch {
      setAnnouncement(`No se pudo borrar el mensaje de ${msg.author}.`);
      fetchMessages(true);
    }
  };

  const undo = async () => {
    if (!lastDeleted) return;
    const msg = lastDeleted;
    setLastDeleted(null);
    generation.current++;
    try {
      const body: NewChatMessage = {
        id: msg.id,
        createdAt: msg.createdAt,
        role: msg.role,
        author: msg.author,
        city: msg.city,
        text: msg.text,
      };
      await postJson<ChatMessageDTO>(CHAT_API, body);
      setAnnouncement(`Mensaje de ${msg.author} restaurado.`);
    } catch {
      setAnnouncement(`No se pudo restaurar el mensaje de ${msg.author}.`);
    }
    fetchMessages(true);
  };

  /* ───────── Diálogo: el oyente aludido contesta a los 3–6 s ───────── */

  const scheduleListenerReply = (listener: ChatMessageDTO, operatorText: string) => {
    const key = `${listener.author}|${listener.city ?? ""}`;
    setTyping((t) => (t.includes(listener.author) ? t : [...t, listener.author]));
    const delay = REPLY_MIN_MS + Math.random() * (REPLY_MAX_MS - REPLY_MIN_MS);
    const timer = window.setTimeout(async () => {
      replyTimers.current.delete(timer);
      const text = buildReaction(operatorText, listener.city, lastReaction.current.get(key));
      lastReaction.current.set(key, text);
      try {
        generation.current++;
        const payload: NewChatMessage = { role: "oyente", author: listener.author, city: listener.city, text };
        const msg = await postJson<ChatMessageDTO>(CHAT_API, payload);
        setMessages((list) => (list.some((m) => m.id === msg.id) ? list : [...list, msg].slice(-MAX_VISIBLE)));
      } catch {
        /* si falla, el oyente simplemente no contesta */
      } finally {
        setTyping((t) => t.filter((name) => name !== listener.author));
      }
    }, delay);
    replyTimers.current.add(timer);
  };

  /* ───────── Envío ───────── */

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const body = draft.trim();
    if (!body) {
      setError("Escribí un mensaje antes de enviar.");
      inputRef.current?.focus();
      return;
    }
    const text = (replyTo ? `@${replyTo.author} ${body}` : body).slice(0, MAX_LENGTH);
    const addressee = findAddressee(text, replyTo, messages);
    setSending(true);
    generation.current++;
    try {
      const payload: NewChatMessage = { role: "conduccion", author: HOST_NAME, text };
      const msg = await postJson<ChatMessageDTO>(CHAT_API, payload);
      setMessages((list) => [...list.filter((m) => m.id !== msg.id), msg].slice(-MAX_VISIBLE));
      if (addressee) scheduleListenerReply(addressee, body);
      setDraft("");
      setError("");
      setReplyTo(null);
      requestAnimationFrame(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      });
    } catch (err) {
      setError(`No se pudo enviar el mensaje. ${(err as Error).message}`);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <section
      aria-labelledby="titulo-chat"
      className="flex max-h-[calc(100vh-var(--spacing-header)-4rem)] min-h-[36rem] flex-col self-start overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-800/60 shadow-sm transition-shadow hover:shadow-md"
    >
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      <header className="flex flex-col gap-3 border-b border-slate-700/80 px-5 py-4">
        <h2 id="titulo-chat" className="flex items-center gap-3 text-xl font-bold tracking-tight text-white">
          <MessagesSquare aria-hidden className="size-6 text-sky-300" />
          Chat de oyentes
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ul aria-label="Estado de la moderación" className="flex flex-wrap gap-2 text-sm font-bold">
            <li
              className={`flex items-center gap-1 rounded-full px-3 py-1 ${
                flaggedCount ? "bg-red-950 text-red-200 ring-1 ring-red-400/60" : "bg-slate-700 text-slate-200"
              }`}
            >
              <ShieldAlert aria-hidden className="size-4" />
              {flaggedCount === 1 ? "1 para revisar" : `${flaggedCount} para revisar`}
            </li>
            <li className="flex items-center gap-1 rounded-full bg-ugr-blue px-3 py-1 text-white ring-1 ring-sky-300/50">
              <Music aria-hidden className="size-4" />
              {pendingRequests === 1 ? "1 pedido" : `${pendingRequests} pedidos`}
            </li>
          </ul>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
            className={`flex min-h-12 items-center gap-2 rounded-xl border border-slate-500 px-3 text-sm font-bold text-slate-100 hover:bg-slate-700 ${press}`}
          >
            {paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
            {paused ? "Reanudar entrantes" : "Pausar entrantes"}
          </button>
        </div>
      </header>

      {loadState === "loading" ? (
        <p role="status" className="flex flex-1 items-center justify-center gap-3 bg-slate-900 px-4 py-10 text-base text-slate-300">
          <LoaderCircle aria-hidden className="size-6 animate-spin text-sky-300" />
          Conectando con el chat…
        </p>
      ) : loadState === "error" ? (
        <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 bg-red-950/40 px-4 py-10 text-center">
          <p className="text-base font-bold text-red-200">No se pudo conectar con el chat.</p>
          <button
            type="button"
            onClick={() => {
              setLoadState("loading");
              fetchMessages(true);
            }}
            className={`min-h-12 rounded-xl bg-ugr-blue px-5 text-base font-bold text-white ${press}`}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <ol
          ref={listRef}
          role="log"
          aria-live={paused ? "off" : "polite"}
          aria-label="Mensajes del chat"
          tabIndex={0}
          className="flex flex-1 flex-col gap-3 overflow-y-auto bg-slate-900 px-4 py-4"
        >
          {messages.length === 0 && <li className="self-center py-8 text-base text-slate-300">Todavía no hay mensajes.</li>}
          {messages.map((m) => {
            const host = m.role === "conduccion";
            const artist = songRequestArtist(m);
            const request = requests[m.id];
            return (
              <li
                key={m.id}
                className={`flex max-w-[92%] flex-col gap-2 rounded-2xl border px-4 py-3 shadow-sm ${
                  host
                    ? "self-end border-sky-300/40 bg-ugr-blue text-white"
                    : m.flagged
                      ? "self-start border-red-400/60 bg-red-950/60"
                      : artist
                        ? "self-start border-sky-300/40 bg-slate-800"
                        : "self-start border-slate-700 bg-slate-800"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {host ? (
                    <span className="rounded-full bg-ugr-red px-2 py-0.5 text-xs font-black tracking-wide text-white uppercase">
                      {HOST_NAME}
                    </span>
                  ) : (
                    <span className="font-bold text-white">
                      {m.author}
                      {m.city && <span className="font-normal text-slate-300"> · {m.city}</span>}
                    </span>
                  )}
                  {m.flagged && (
                    <span className="flex items-center gap-1 rounded-full border border-red-300 px-2 py-0.5 text-xs font-bold text-red-200">
                      <ShieldAlert aria-hidden className="size-3.5" />
                      Revisar
                    </span>
                  )}
                  {artist && (
                    <span className="flex items-center gap-1 rounded-full bg-sky-300/15 px-2 py-0.5 text-xs font-bold text-sky-200">
                      <Music aria-hidden className="size-3.5" />
                      Pedido musical
                    </span>
                  )}
                  <span className={`ml-auto text-xs ${host ? "text-blue-100" : "text-slate-300"}`}>
                    <span className="sr-only">, </span>
                    {m.time}
                  </span>
                </div>

                <p className="text-base text-white">
                  <span className="sr-only">{host ? "La conducción dice:" : `${m.author} dice:`} </span>
                  {m.text}
                </p>

                <div className="flex flex-wrap gap-2">
                  {artist && (
                    <button
                      type="button"
                      onClick={() => void addRequestToDeck(m, artist)}
                      disabled={Boolean(request)}
                      aria-label={
                        request === "added"
                          ? `${artist} ya está en el deck`
                          : `Sumar al deck el pedido de ${m.author}: ${artist}`
                      }
                      className={`flex min-h-12 items-center gap-2 rounded-lg px-3 text-sm font-bold ${press} ${
                        request === "added"
                          ? "bg-emerald-900/60 text-emerald-200"
                          : "bg-ugr-blue text-white ring-1 ring-sky-300/60 hover:bg-ugr-blue-dark disabled:opacity-70"
                      }`}
                    >
                      {request === "saving" ? (
                        <LoaderCircle aria-hidden className="size-4 animate-spin" />
                      ) : request === "added" ? (
                        <Check aria-hidden className="size-4" strokeWidth={3} />
                      ) : (
                        <ListPlus aria-hidden className="size-4" />
                      )}
                      {request === "saving" ? "Sumando…" : request === "added" ? "En el deck" : "Sumar al Deck"}
                    </button>
                  )}
                  {!host && (
                    <button
                      type="button"
                      onClick={() => startReply(m)}
                      aria-label={`Responder a ${m.author}`}
                      className={`flex min-h-12 items-center gap-1 rounded-lg px-3 text-sm font-bold text-sky-200 hover:bg-white/10 ${press}`}
                    >
                      <MessageSquareReply aria-hidden className="size-4" />
                      Responder
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void remove(m)}
                    aria-label={`Borrar mensaje de ${m.author}`}
                    className={`flex min-h-12 items-center gap-1 rounded-lg px-3 text-sm font-bold text-slate-200 hover:bg-red-950 hover:text-red-200 ${press}`}
                  >
                    <Trash2 aria-hidden className="size-4" />
                    Borrar
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {lastDeleted && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-700 bg-slate-800 px-5 py-2 text-sm text-slate-100">
          <span>Mensaje de {lastDeleted.author} borrado.</span>
          <button
            type="button"
            onClick={() => void undo()}
            className={`flex min-h-12 items-center gap-1 rounded-lg px-3 font-bold text-sky-200 hover:bg-white/10 ${press}`}
          >
            <Undo2 aria-hidden className="size-4" />
            Deshacer
          </button>
        </div>
      )}

      <p aria-live="polite" className="flex min-h-8 items-center gap-2 border-t border-slate-700/80 bg-slate-900 px-5 text-sm text-sky-200 empty:min-h-0 empty:border-t-0">
        {typing.length > 0 && (
          <>
            <span aria-hidden className="flex gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-sky-300" />
              <span className="size-1.5 animate-bounce rounded-full bg-sky-300 [animation-delay:150ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-sky-300 [animation-delay:300ms]" />
            </span>
            {typing.length === 1 ? `${typing[0]} está escribiendo…` : `${typing.join(" y ")} están escribiendo…`}
          </>
        )}
      </p>

      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-3 border-t border-slate-700/80 p-4">
        {replyTo && (
          <div className="flex items-start justify-between gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm ring-1 ring-sky-300/40">
            <p className="min-w-0 text-slate-100">
              Respondiendo a <strong>{replyTo.author}</strong>:{" "}
              <span className="line-clamp-1 text-slate-300">{replyTo.text}</span>
            </p>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Cancelar respuesta"
              className="flex size-12 shrink-0 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
        )}
        <label htmlFor={inputId} className="text-base font-bold text-slate-100">
          {replyTo ? `Tu respuesta para ${replyTo.author}` : "Mensaje para todos los oyentes"}
        </label>
        <textarea
          ref={inputRef}
          id={inputId}
          rows={2}
          maxLength={MAX_LENGTH - (replyTo ? replyTo.author.length + 2 : 0)}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          placeholder="Escribí y apretá Enter…"
          className="min-h-14 w-full resize-none rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-base text-white placeholder:text-slate-400"
        />
        <p id={hintId} className="text-sm text-slate-300">
          Tip: tocá <strong className="text-white">Responder</strong> o escribí <strong className="text-white">@Nombre</strong> y el oyente te va a contestar.
        </p>
        {error && (
          <p id={errorId} role="alert" className="text-sm font-bold text-red-300">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={sending}
          aria-busy={sending}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ugr-red px-5 text-base font-bold text-white shadow-sm hover:bg-ugr-red-dark disabled:opacity-60 ${press}`}
        >
          {sending ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : <Send aria-hidden className="size-5" />}
          {sending ? "Enviando…" : replyTo ? "Responder al oyente" : "Enviar al aire"}
        </button>
      </form>
    </section>
  );
}
