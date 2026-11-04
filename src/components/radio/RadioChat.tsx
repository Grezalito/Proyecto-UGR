"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { MessageSquareReply, MessagesSquare, Pause, Play, Send, ShieldAlert, Trash2, Undo2, Users, X } from "lucide-react";
import { INAPPROPRIATE_MESSAGES, LISTENER_MESSAGES, LISTENERS } from "@/lib/initial-data";
import { newId } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";

const MIN_DELAY = 15_000;
const MAX_DELAY = 20_000;
const MAX_MESSAGES = 80;
const FLAG_PROBABILITY = 0.18;

const timeFormatter = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });

const INITIAL: ChatMessage[] = [
  { id: "m1", role: "oyente", author: "Marta", city: "Venado Tuerto", text: "¡Hola! Ya estoy escuchando la radio.", time: "Recién" },
  { id: "m2", role: "oyente", author: "Juan Cruz", city: "Firmat", text: "¡Un saludo a los chicos de la UGR!", time: "Recién" },
  { id: "m3", role: "oyente", author: "Usuario123", city: "Rosario", text: INAPPROPRIATE_MESSAGES[0], time: "Recién", flagged: true },
];

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

function randomListenerMessage(): ChatMessage {
  const flagged = Math.random() < FLAG_PROBABILITY;
  const who = pick(LISTENERS);
  return {
    id: newId(),
    role: "oyente",
    author: flagged ? `Usuario${Math.floor(100 + Math.random() * 900)}` : who.name,
    city: who.city,
    text: flagged ? pick(INAPPROPRIATE_MESSAGES) : pick(LISTENER_MESSAGES),
    time: timeFormatter.format(new Date()),
    flagged,
  };
}

export default function RadioChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL);
  const [paused, setPaused] = useState(false);
  const [listeners, setListeners] = useState(128);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [lastDeleted, setLastDeleted] = useState<{ msg: ChatMessage; index: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  const errorId = useId();

  // Oyentes simulados cada 15–20 s (se puede pausar: WCAG 2.2.2).
  useEffect(() => {
    if (paused) return;
    let timeout: number;
    const schedule = () => {
      timeout = window.setTimeout(() => {
        const msg = randomListenerMessage();
        setMessages((list) => [...list, msg].slice(-MAX_MESSAGES));
        setListeners((n) => Math.max(40, n + Math.floor(Math.random() * 15) - 6));
        schedule();
      }, MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY));
    };
    schedule();
    return () => window.clearTimeout(timeout);
  }, [paused]);

  // Autodesplazamiento si el operador ya estaba al final.
  useEffect(() => {
    const el = listRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 200) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const flaggedCount = messages.filter((m) => m.flagged).length;

  const startReply = (msg: ChatMessage) => {
    setReplyTo(msg);
    setError("");
    inputRef.current?.focus();
  };

  const remove = (msg: ChatMessage) => {
    const index = messages.findIndex((m) => m.id === msg.id);
    setMessages((list) => list.filter((m) => m.id !== msg.id));
    setLastDeleted({ msg, index });
    if (replyTo?.id === msg.id) setReplyTo(null);
    setAnnouncement(`Mensaje de ${msg.author} borrado.`);
    listRef.current?.focus();
  };

  const undo = () => {
    if (!lastDeleted) return;
    const { msg, index } = lastDeleted;
    setMessages((list) => {
      const next = [...list];
      next.splice(Math.min(index, next.length), 0, msg);
      return next;
    });
    setLastDeleted(null);
    setAnnouncement(`Mensaje de ${msg.author} restaurado.`);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) {
      setError("Escribí un mensaje antes de enviar.");
      inputRef.current?.focus();
      return;
    }
    const msg: ChatMessage = {
      id: newId(),
      role: "conduccion",
      author: "Conducción UGR",
      text,
      time: timeFormatter.format(new Date()),
      replyTo: replyTo ? { author: replyTo.author, text: replyTo.text } : undefined,
    };
    setMessages((list) => [...list, msg].slice(-MAX_MESSAGES));
    setDraft("");
    setError("");
    setReplyTo(null);
    inputRef.current?.focus();
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  };

  return (
    <section
      aria-labelledby="titulo-chat"
      className="flex max-h-[calc(100vh-var(--spacing-header)-4rem)] min-h-[36rem] flex-col self-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 id="titulo-chat" className="flex items-center gap-3 text-xl font-bold text-ugr-blue">
            <MessagesSquare aria-hidden className="size-6" />
            Chat de oyentes
          </h2>
          <span className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
            <Users aria-hidden className="size-4" />
            <span className="sr-only">Oyentes conectados:</span> {listeners}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {flaggedCount > 0 ? (
              <span className="font-bold text-ugr-red">
                {flaggedCount === 1 ? "1 mensaje para revisar" : `${flaggedCount} mensajes para revisar`}
              </span>
            ) : (
              "Modo moderador activo"
            )}
          </p>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
            className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            {paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
            {paused ? "Reanudar entrantes" : "Pausar entrantes"}
          </button>
        </div>
      </header>

      <ol
        ref={listRef}
        role="log"
        aria-live={paused ? "off" : "polite"}
        aria-label="Mensajes del chat"
        tabIndex={0}
        className="flex flex-1 flex-col gap-3 overflow-y-auto bg-slate-50 px-4 py-4"
      >
        {messages.map((m) => {
          const host = m.role === "conduccion";
          return (
            <li
              key={m.id}
              className={`flex max-w-[92%] flex-col gap-2 rounded-2xl border px-4 py-3 shadow-sm ${
                host
                  ? "self-end border-ugr-blue bg-ugr-blue text-white"
                  : m.flagged
                    ? "self-start border-ugr-red/50 bg-red-50"
                    : "self-start border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {host ? (
                  <span className="rounded-full bg-ugr-red px-2 py-0.5 text-xs font-bold tracking-wide text-white uppercase">
                    Conducción UGR
                  </span>
                ) : (
                  <span className="font-bold text-slate-900">
                    {m.author}
                    <span className="font-normal text-slate-600"> · {m.city}</span>
                  </span>
                )}
                {m.flagged && (
                  <span className="flex items-center gap-1 rounded-full border border-ugr-red px-2 py-0.5 text-xs font-bold text-ugr-red">
                    <ShieldAlert aria-hidden className="size-3.5" />
                    Revisar
                  </span>
                )}
                <span className={`ml-auto text-xs ${host ? "text-white/75" : "text-slate-500"}`}>
                  <span className="sr-only">, </span>
                  {m.time}
                </span>
              </div>

              {m.replyTo && (
                <p className="rounded-lg border-l-4 border-white/60 bg-white/10 px-3 py-1 text-sm text-white/90">
                  <span className="sr-only">En respuesta a </span>
                  <strong>{m.replyTo.author}:</strong> {m.replyTo.text}
                </p>
              )}

              <p className={`text-base ${host ? "text-white" : "text-slate-900"}`}>
                <span className="sr-only">{host ? "La conducción dice:" : `${m.author} dice:`} </span>
                {m.text}
              </p>

              <div className="flex gap-2">
                {!host && (
                  <button
                    type="button"
                    onClick={() => startReply(m)}
                    aria-label={`Responder a ${m.author}`}
                    className="flex min-h-12 items-center gap-1 rounded-lg px-3 text-sm font-bold text-ugr-blue hover:bg-blue-50"
                  >
                    <MessageSquareReply aria-hidden className="size-4" />
                    Responder
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(m)}
                  aria-label={`Borrar mensaje de ${m.author}`}
                  className={`flex min-h-12 items-center gap-1 rounded-lg px-3 text-sm font-bold ${
                    host ? "text-white/90 hover:bg-white/10" : "text-slate-600 hover:bg-red-100 hover:text-ugr-red"
                  }`}
                >
                  <Trash2 aria-hidden className="size-4" />
                  Borrar
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {lastDeleted && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-100 px-5 py-2 text-sm">
          <span>Mensaje de {lastDeleted.msg.author} borrado.</span>
          <button
            type="button"
            onClick={undo}
            className="flex min-h-12 items-center gap-1 rounded-lg px-3 font-bold text-ugr-blue hover:bg-white"
          >
            <Undo2 aria-hidden className="size-4" />
            Deshacer
          </button>
        </div>
      )}

      <form onSubmit={submit} noValidate className="flex flex-col gap-3 border-t border-slate-200 p-4">
        {replyTo && (
          <div className="flex items-start justify-between gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm">
            <p className="min-w-0 text-slate-800">
              Respondiendo a <strong>{replyTo.author}</strong>:{" "}
              <span className="line-clamp-1 text-slate-600">{replyTo.text}</span>
            </p>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Cancelar respuesta"
              className="flex size-12 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-white"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
        )}
        <label htmlFor={inputId} className="text-base font-bold">
          {replyTo ? `Tu respuesta para ${replyTo.author}` : "Mensaje para todos los oyentes"}
        </label>
        <textarea
          ref={inputRef}
          id={inputId}
          rows={2}
          maxLength={280}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder="Escribí y apretá Enter…"
          className="min-h-14 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-base"
        />
        {error && (
          <p id={errorId} role="alert" className="text-sm font-bold text-ugr-red">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ugr-red px-5 text-base font-bold text-white shadow-sm hover:bg-ugr-red-dark"
        >
          <Send aria-hidden className="size-5" />
          {replyTo ? "Responder al oyente" : "Enviar al aire"}
        </button>
      </form>
    </section>
  );
}
