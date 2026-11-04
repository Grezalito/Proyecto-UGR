import type { Category, ImagePreset, Product, Track } from "./types";

/** URL de Unsplash recortada y optimizada. */
const unsplash = (id: string, w = 640) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${Math.round(w * 0.75)}&q=75`;

/* ───────── Institucional ───────── */

export const UGR_LOGO = "https://ugr.edu.ar/wp-content/uploads/2023/07/logo-ugr-color.png";

export const RADIO_STREAM = {
  name: "Radio UGR",
  url: "https://stream.zeno.fm/f3qwmd567xquv",
};

/* ───────── Supermercado ───────── */

export const CATEGORIES: Category[] = [
  { id: "almacen", name: "Almacén" },
  { id: "lacteos", name: "Lácteos" },
  { id: "bebidas", name: "Bebidas" },
  { id: "limpieza", name: "Limpieza" },
  { id: "panaderia", name: "Panadería" },
];

export const PRODUCT_IMAGE_PRESETS: ImagePreset[] = [
  { id: "yerba", label: "Yerba", url: unsplash("1784475844948-e9abada34215") },
  { id: "leche", label: "Leche", url: unsplash("1550583724-b2692b85b150") },
  { id: "gaseosa", label: "Gaseosa", url: unsplash("1568657624422-1b8713e79461") },
  { id: "fideos", label: "Fideos", url: unsplash("1551462147-ff29053bfc14") },
];

const SEED_TIME = Date.UTC(2026, 0, 1);

export const SEED_PRODUCTS: Product[] = [
  {
    id: "seed-yerba",
    name: "Yerba mate con palo 1 kg",
    categoryId: "almacen",
    price: 450000,
    image: PRODUCT_IMAGE_PRESETS[0].url,
    createdAt: SEED_TIME,
  },
  {
    id: "seed-leche",
    name: "Leche entera sachet 1 L",
    categoryId: "lacteos",
    price: 150000,
    image: PRODUCT_IMAGE_PRESETS[1].url,
    createdAt: SEED_TIME + 1,
  },
  {
    id: "seed-gaseosa",
    name: "Gaseosa sabor cola 2,25 L",
    categoryId: "bebidas",
    price: 320000,
    image: PRODUCT_IMAGE_PRESETS[2].url,
    createdAt: SEED_TIME + 2,
  },
  {
    id: "seed-fideos",
    name: "Fideos spaghetti 500 g",
    categoryId: "almacen",
    price: 120000,
    image: PRODUCT_IMAGE_PRESETS[3].url,
    createdAt: SEED_TIME + 3,
  },
  {
    id: "seed-pan",
    name: "Pan francés por kilo",
    categoryId: "panaderia",
    price: 350000,
    image: unsplash("1509440159596-0249088772ff"),
    createdAt: SEED_TIME + 4,
  },
  {
    id: "seed-limpiador",
    name: "Limpiador multiuso 500 ml",
    categoryId: "limpieza",
    price: 210000,
    image: unsplash("1563453392212-326f5e854473"),
    createdAt: SEED_TIME + 5,
  },
];

/* ───────── Radio ───────── */

export const COVER_PRESETS: ImagePreset[] = [
  { id: "escenario", label: "Escenario", url: unsplash("1493225457124-a3eb161ffa5f", 400) },
  { id: "dj", label: "Consola DJ", url: unsplash("1470225620780-dba8ba36b745", 400) },
  { id: "radio", label: "Radio retro", url: unsplash("1487180144351-b8472da7d491", 400) },
  { id: "piano", label: "Piano", url: unsplash("1520523839897-bd0b52f945a0", 400) },
];

/** Pistas de demostración libres de derechos (SoundHelix). */
export const SEED_TRACKS: Track[] = [
  {
    id: "seed-t1",
    title: "Apertura del programa",
    artist: "SoundHelix",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    cover: COVER_PRESETS[0].url,
  },
  {
    id: "seed-t2",
    title: "Ritmo de la tarde",
    artist: "SoundHelix",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    cover: COVER_PRESETS[1].url,
  },
  {
    id: "seed-t3",
    title: "Camino al trabajo",
    artist: "SoundHelix",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    cover: COVER_PRESETS[2].url,
  },
  {
    id: "seed-t4",
    title: "Cierre con piano",
    artist: "SoundHelix",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    cover: COVER_PRESETS[3].url,
  },
];

/* ───────── Chat simulado ───────── */

export const LISTENERS: { name: string; city: string }[] = [
  { name: "Marta", city: "Venado Tuerto" },
  { name: "Juan Cruz", city: "Firmat" },
  { name: "Lucía", city: "Rosario" },
  { name: "Don Rubén", city: "Venado Tuerto" },
  { name: "Sofi", city: "Rosario" },
  { name: "Carlos", city: "Firmat" },
  { name: "Ana", city: "Casilda" },
];

export const LISTENER_MESSAGES = [
  "¡Un saludo a los chicos de la UGR!",
  "¡Pongan rock nacional!",
  "Los escucho desde el trabajo, ¡muy lindo el programa!",
  "¿Pueden pasar un tema de cumbia?",
  "¡Qué buena música! ¿Cómo se llama esta canción?",
  "Saludos a mi sobrino que estudia en la UGR.",
  "¿A qué hora termina el programa?",
  "¡Se escucha bárbaro desde la ruta 33!",
  "Ayer me perdí el programa, ¿lo repiten?",
  "¡Mándenle un abrazo a todo el equipo!",
];

/** Mensajes que el operador debería moderar. */
export const INAPPROPRIATE_MESSAGES = [
  "¡¡¡GANÁ PLATA FÁCIL!!! Entrá a mi link ya",
  "Este programa es horrible, apaguen todo",
  "Vendo seguidores baratos, escribime por privado",
];
