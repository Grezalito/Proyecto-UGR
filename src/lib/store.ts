"use client";

import { useSyncExternalStore } from "react";
import { CATEGORIES, SEED_PRODUCTS, SEED_TRACKS } from "./initial-data";
import type { CategoryId, NewProduct, NewTrack, Product, Track } from "./types";

/* ════════════════════ Formato ARS ════════════════════ */

const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 150000 → "$ 1.500,00" */
export function formatARS(cents: number): string {
  return arsFormatter.format(cents / 100);
}

const MAX_PRICE_CENTS = 100_000_000_00; // $ 100.000.000

/**
 * Interpreta lo que escribe el usuario en pesos y devuelve centavos.
 * Acepta "1500", "1.500", "1500,50", "$ 1.500,50" o "1500.5".
 * Devuelve null si no es un precio válido.
 */
export function parseARSInput(input: string): number | null {
  let s = input.replace(/ars/gi, "").replace(/[$\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return cents > 0 && cents <= MAX_PRICE_CENTS ? cents : null;
}

/** 150050 → "1500,50" (para precargar campos de edición). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/* ════════════════════ Utilidades ════════════════════ */

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function categoryName(id: CategoryId): string {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id;
}

/* ════════════════════ Store persistente genérico ════════════════════ */

type Updater<T> = (prev: T) => T;

function createPersistentStore<T>(key: string, seed: T, sanitize: (raw: unknown) => T | null) {
  let state = seed;
  let hydrated = false;
  const listeners = new Set<() => void>();

  const read = (): T => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return seed;
      return sanitize(JSON.parse(raw)) ?? seed;
    } catch {
      return seed;
    }
  };

  const write = (value: T) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* cuota llena o almacenamiento bloqueado: se mantiene en memoria */
    }
  };

  const emit = () => listeners.forEach((l) => l());

  const onStorage = (e: StorageEvent) => {
    if (e.key !== key) return;
    state = read();
    emit();
  };

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => seed,
    subscribe(listener: () => void) {
      if (!hydrated) {
        hydrated = true;
        state = read();
      }
      if (listeners.size === 0) window.addEventListener("storage", onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener("storage", onStorage);
      };
    },
    set(updater: Updater<T>) {
      state = updater(state);
      write(state);
      emit();
    },
    reset() {
      state = seed;
      write(state);
      emit();
    },
  };
}

/* ════════════════════ Validación de datos guardados ════════════════════ */

const CATEGORY_IDS = new Set<string>(CATEGORIES.map((c) => c.id));
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function sanitizeProducts(raw: unknown): Product[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter(
    (p): p is Product =>
      typeof p === "object" &&
      p !== null &&
      isStr(p.id) &&
      isStr(p.name) &&
      CATEGORY_IDS.has(p.categoryId) &&
      Number.isInteger(p.price) &&
      p.price > 0 &&
      typeof p.image === "string" &&
      typeof p.createdAt === "number",
  );
}

function sanitizeTracks(raw: unknown): Track[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter(
    (t): t is Track =>
      typeof t === "object" &&
      t !== null &&
      isStr(t.id) &&
      isStr(t.title) &&
      typeof t.artist === "string" &&
      isStr(t.src) &&
      typeof t.cover === "string",
  );
}

/* ════════════════════ Inventario (supermercado) ════════════════════ */

const inventoryStore = createPersistentStore<Product[]>(
  "ugr-inventario-v1",
  SEED_PRODUCTS,
  sanitizeProducts,
);

export function useInventory() {
  const products = useSyncExternalStore(
    inventoryStore.subscribe,
    inventoryStore.getSnapshot,
    inventoryStore.getServerSnapshot,
  );

  return {
    products,
    addProduct(input: NewProduct): Product {
      const product: Product = { ...input, name: input.name.trim(), id: newId(), createdAt: Date.now() };
      inventoryStore.set((list) => [product, ...list]);
      return product;
    },
    updateProduct(id: string, patch: Partial<NewProduct>) {
      inventoryStore.set((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    },
    removeProduct(id: string) {
      inventoryStore.set((list) => list.filter((p) => p.id !== id));
    },
    resetProducts: inventoryStore.reset,
  };
}

/* ════════════════════ Playlist (radio) ════════════════════ */

const playlistStore = createPersistentStore<Track[]>("ugr-playlist-v1", SEED_TRACKS, sanitizeTracks);

export function usePlaylist() {
  const tracks = useSyncExternalStore(
    playlistStore.subscribe,
    playlistStore.getSnapshot,
    playlistStore.getServerSnapshot,
  );

  return {
    tracks,
    addTrack(input: NewTrack): Track {
      const track: Track = {
        ...input,
        title: input.title.trim(),
        artist: input.artist.trim(),
        id: newId(),
      };
      playlistStore.set((list) => [...list, track]);
      return track;
    },
    removeTrack(id: string) {
      playlistStore.set((list) => list.filter((t) => t.id !== id));
    },
    /** Mueve una pista una posición arriba (-1) o abajo (+1). */
    moveTrack(id: string, direction: -1 | 1) {
      playlistStore.set((list) => {
        const from = list.findIndex((t) => t.id === id);
        const to = from + direction;
        if (from < 0 || to < 0 || to >= list.length) return list;
        const next = [...list];
        [next[from], next[to]] = [next[to], next[from]];
        return next;
      });
    },
    resetPlaylist: playlistStore.reset,
  };
}
