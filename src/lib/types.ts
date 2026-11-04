/* ───────── Supermercado ───────── */

export type CategoryId = "almacen" | "lacteos" | "bebidas" | "limpieza" | "panaderia";

export interface Category {
  id: CategoryId;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  categoryId: CategoryId;
  /** Precio en centavos de ARS (150000 = $ 1.500,00). */
  price: number;
  /** URL absoluta de la imagen. */
  image: string;
  createdAt: number;
}

export type NewProduct = Omit<Product, "id" | "createdAt">;

export interface ImagePreset {
  id: string;
  label: string;
  url: string;
}

/* ───────── Radio ───────── */

export interface Track {
  id: string;
  title: string;
  artist: string;
  /** URL del archivo o stream de audio. */
  src: string;
  /** URL de la portada. */
  cover: string;
}

export type NewTrack = Omit<Track, "id">;

export type ChatRole = "oyente" | "conduccion";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  author: string;
  /** Ciudad del oyente (solo para role = "oyente"). */
  city?: string;
  text: string;
  /** Hora ya formateada (hh:mm) o "Recién". */
  time: string;
  /** Marcado por el sistema como posible mensaje inadecuado. */
  flagged?: boolean;
  /** Mensaje al que responde la conducción. */
  replyTo?: { author: string; text: string };
}
