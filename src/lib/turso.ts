import { createClient, type Client, type Row } from "@libsql/client";
import { DEFAULT_CATEGORY_ICON, guessCategoryIcon, isCategoryIconName, slugify } from "./category-icons";
import { INAPPROPRIATE_MESSAGES } from "./initial-data";
import type { Category, ChatMessage, ChatRole, NewCategory, NewProduct, NewTrack, Product, Track } from "./types";

/* ════════════════════ Cliente ════════════════════ */

const globalForTurso = globalThis as unknown as { turso?: Client };

function db(): Client {
  if (globalForTurso.turso) return globalForTurso.turso;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("Falta la variable de entorno TURSO_DATABASE_URL.");
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  globalForTurso.turso = client;
  return client;
}

/* ════════════════════ Tipos públicos ════════════════════ */

/** Mensaje de chat tal como lo devuelve la API (incluye marca de tiempo para restaurar). */
export type ChatMessageDTO = ChatMessage & { createdAt: number };

export interface NewChatMessage {
  role: ChatRole;
  author: string;
  city?: string;
  text: string;
  /** Solo para restaurar un mensaje borrado (deshacer). */
  id?: string;
  createdAt?: number;
}

/* ════════════════════ Validación ════════════════════ */

const CATEGORY_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PRICE_CENTS = 100_000_000_00;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const CITY_SEPARATOR = " · ";

export class ValidationError extends Error {}
export class ConflictError extends Error {}

/** Respuesta de error homogénea para los Route Handlers. */
export function errorResponse(err: unknown): Response {
  if (err instanceof ValidationError) return Response.json({ error: err.message }, { status: 400 });
  if (err instanceof ConflictError) return Response.json({ error: err.message }, { status: 409 });
  console.error("[turso]", err);
  return Response.json({ error: "Error interno de la base de datos." }, { status: 500 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("El cuerpo debe ser JSON válido.");
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function text(v: unknown, field: string, min: number, max: number): string {
  if (typeof v !== "string") throw new ValidationError(`El campo "${field}" es obligatorio.`);
  const s = v.trim();
  if (s.length < min || s.length > max) {
    throw new ValidationError(`El campo "${field}" debe tener entre ${min} y ${max} caracteres.`);
  }
  return s;
}

function httpUrl(v: unknown, field: string, optional: boolean): string {
  if (optional && (v === undefined || v === "")) return "";
  if (typeof v !== "string") throw new ValidationError(`El campo "${field}" debe ser una URL.`);
  try {
    const u = new URL(v);
    if (u.protocol === "https:" || u.protocol === "http:") return u.toString();
  } catch {
    /* cae al error */
  }
  throw new ValidationError(`El campo "${field}" debe ser una URL http(s).`);
}

export function parseId(v: unknown): string {
  if (typeof v !== "string" || !ID_RE.test(v)) throw new ValidationError("Identificador inválido.");
  return v;
}

export function parsePrice(v: unknown): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0 || v > MAX_PRICE_CENTS) {
    throw new ValidationError("El precio debe ser un entero positivo en centavos.");
  }
  return v;
}

function parseCategoryId(v: unknown): string {
  if (typeof v !== "string" || v.length > 40 || !CATEGORY_ID_RE.test(v)) {
    throw new ValidationError("Categoría inválida.");
  }
  return v;
}

export function parseNewProduct(body: unknown): NewProduct {
  if (!isRecord(body)) throw new ValidationError("Cuerpo inválido.");
  return {
    name: text(body.name, "name", 2, 60),
    categoryId: parseCategoryId(body.categoryId),
    price: parsePrice(body.price),
    image: httpUrl(body.image, "image", true),
  };
}

/** PATCH parcial: acepta cualquier subconjunto de campos editables (al menos uno). */
export function parseProductPatch(body: unknown): { id: string; patch: Partial<NewProduct> } {
  if (!isRecord(body)) throw new ValidationError("Cuerpo inválido.");
  const patch: Partial<NewProduct> = {};
  if (body.name !== undefined) patch.name = text(body.name, "name", 2, 60);
  if (body.categoryId !== undefined) patch.categoryId = parseCategoryId(body.categoryId);
  if (body.price !== undefined) patch.price = parsePrice(body.price);
  if (body.image !== undefined) patch.image = httpUrl(body.image, "image", true);
  if (Object.keys(patch).length === 0) throw new ValidationError("No hay cambios para guardar.");
  return { id: parseId(body.id), patch };
}

export function parseNewCategory(body: unknown): NewCategory {
  if (!isRecord(body)) throw new ValidationError("Cuerpo inválido.");
  const name = text(body.name, "name", 2, 30);
  if (!slugify(name)) throw new ValidationError("El nombre debe tener letras o números.");
  if (body.icon !== undefined && !isCategoryIconName(body.icon)) throw new ValidationError("Ícono inválido.");
  return { name, icon: body.icon as string | undefined };
}

export function parseNewTrack(body: unknown): NewTrack {
  if (!isRecord(body)) throw new ValidationError("Cuerpo inválido.");
  const artist = typeof body.artist === "string" ? body.artist.trim().slice(0, 80) : "";
  return {
    title: text(body.title, "title", 1, 80),
    artist: artist || "Artista desconocido",
    src: httpUrl(body.src, "src", false),
    cover: httpUrl(body.cover, "cover", true),
  };
}

export function parseNewChatMessage(body: unknown): NewChatMessage {
  if (!isRecord(body)) throw new ValidationError("Cuerpo inválido.");
  const role: ChatRole = body.role === "conduccion" ? "conduccion" : "oyente";
  const city = typeof body.city === "string" && body.city.trim() ? text(body.city, "city", 1, 40) : undefined;
  const msg: NewChatMessage = {
    role,
    author: text(body.author, "author", 1, 40).replaceAll(CITY_SEPARATOR, " "),
    city,
    text: text(body.text, "text", 1, 280),
  };
  if (body.id !== undefined) msg.id = parseId(body.id);
  if (body.createdAt !== undefined) {
    if (typeof body.createdAt !== "number" || !Number.isFinite(body.createdAt) || body.createdAt > Date.now() + 60_000) {
      throw new ValidationError("Fecha inválida.");
    }
    msg.createdAt = body.createdAt;
  }
  return msg;
}

/* ════════════════════ Mapeo de filas ════════════════════ */

/** SQLite guarda CURRENT_TIMESTAMP como "YYYY-MM-DD HH:MM:SS" en UTC. */
function parseSqliteDate(v: unknown): number {
  if (typeof v !== "string") return Date.now();
  const ms = Date.parse(`${v.replace(" ", "T")}Z`);
  return Number.isNaN(ms) ? Date.now() : ms;
}

function toSqliteDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

const INAPPROPRIATE = new Set(INAPPROPRIATE_MESSAGES);

function rowToProduct(r: Row): Product {
  return {
    id: String(r.id),
    name: String(r.title),
    categoryId: String(r.category_id),
    price: Number(r.price),
    image: String(r.image ?? ""),
    createdAt: parseSqliteDate(r.created_at),
  };
}

function rowToTrack(r: Row): Track {
  return {
    id: String(r.id),
    title: String(r.title),
    artist: String(r.artist),
    src: String(r.audio_url),
    cover: String(r.cover_url ?? ""),
  };
}

function rowToChatMessage(r: Row): ChatMessageDTO {
  const sender = String(r.sender);
  const sep = sender.lastIndexOf(CITY_SEPARATOR);
  const author = sep > 0 ? sender.slice(0, sep) : sender;
  const city = sep > 0 ? sender.slice(sep + CITY_SEPARATOR.length) : undefined;
  const role: ChatRole = Number(r.is_admin) === 1 ? "conduccion" : "oyente";
  const body = String(r.text);
  const createdAt = parseSqliteDate(r.created_at);
  return {
    id: String(r.id),
    role,
    author,
    city,
    text: body,
    time: timeFormatter.format(createdAt),
    flagged: role === "oyente" && INAPPROPRIATE.has(body),
    createdAt,
  };
}

/* ════════════════════ Categorías ════════════════════ */

function rowToCategory(r: Row): Category {
  return { id: String(r.id), name: String(r.name), icon: String(r.icon ?? DEFAULT_CATEGORY_ICON) };
}

export async function getCategories(): Promise<Category[]> {
  const rs = await db().execute("SELECT id, name, icon FROM categories ORDER BY rowid ASC");
  return rs.rows.map(rowToCategory);
}

export async function createCategory(input: NewCategory): Promise<Category> {
  const name = input.name.trim();
  const id = slugify(name);
  const icon = input.icon && isCategoryIconName(input.icon) ? input.icon : guessCategoryIcon(name);
  const rs = await db().execute({
    sql: `INSERT INTO categories (id, name, icon) VALUES (?, ?, ?)
          ON CONFLICT(id) DO NOTHING
          RETURNING id, name, icon`,
    args: [id, name, icon],
  });
  if (!rs.rows[0]) throw new ConflictError(`Ya existe una categoría llamada "${name}".`);
  return rowToCategory(rs.rows[0]);
}

async function assertCategoryExists(id: string): Promise<void> {
  const rs = await db().execute({ sql: "SELECT 1 FROM categories WHERE id = ?", args: [id] });
  if (!rs.rows.length) throw new ValidationError("La categoría elegida no existe.");
}

/* ════════════════════ Productos ════════════════════ */

export async function getProducts(): Promise<Product[]> {
  const rs = await db().execute(
    "SELECT id, title, category_id, price, image, created_at FROM products ORDER BY created_at DESC, rowid DESC",
  );
  return rs.rows.map(rowToProduct);
}

export async function createProduct(product: NewProduct): Promise<Product> {
  await assertCategoryExists(product.categoryId);
  const rs = await db().execute({
    sql: `INSERT INTO products (id, title, category_id, price, image)
          VALUES (?, ?, ?, ?, ?)
          RETURNING id, title, category_id, price, image, created_at`,
    args: [crypto.randomUUID(), product.name, product.categoryId, product.price, product.image],
  });
  return rowToProduct(rs.rows[0]);
}

const PRODUCT_COLUMNS: Record<keyof NewProduct, string> = {
  name: "title",
  categoryId: "category_id",
  price: "price",
  image: "image",
};

export async function updateProduct(id: string, patch: Partial<NewProduct>): Promise<Product | null> {
  if (patch.categoryId !== undefined) await assertCategoryExists(patch.categoryId);
  const entries = (Object.keys(PRODUCT_COLUMNS) as (keyof NewProduct)[])
    .filter((k) => patch[k] !== undefined)
    .map((k) => [PRODUCT_COLUMNS[k], patch[k] as string | number] as const);
  if (!entries.length) throw new ValidationError("No hay cambios para guardar.");
  const rs = await db().execute({
    sql: `UPDATE products SET ${entries.map(([col]) => `${col} = ?`).join(", ")} WHERE id = ?
          RETURNING id, title, category_id, price, image, created_at`,
    args: [...entries.map(([, v]) => v), id],
  });
  return rs.rows[0] ? rowToProduct(rs.rows[0]) : null;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const rs = await db().execute({ sql: "DELETE FROM products WHERE id = ?", args: [id] });
  return rs.rowsAffected > 0;
}

/* ════════════════════ Pistas ════════════════════ */

export async function getTracks(): Promise<Track[]> {
  const rs = await db().execute(
    "SELECT id, title, artist, audio_url, cover_url FROM tracks ORDER BY created_at ASC, rowid ASC",
  );
  return rs.rows.map(rowToTrack);
}

export async function createTrack(track: NewTrack): Promise<Track> {
  const rs = await db().execute({
    sql: `INSERT INTO tracks (id, title, artist, audio_url, cover_url)
          VALUES (?, ?, ?, ?, ?)
          RETURNING id, title, artist, audio_url, cover_url`,
    args: [crypto.randomUUID(), track.title, track.artist, track.src, track.cover],
  });
  return rowToTrack(rs.rows[0]);
}

export async function deleteTrack(id: string): Promise<boolean> {
  const rs = await db().execute({ sql: "DELETE FROM tracks WHERE id = ?", args: [id] });
  return rs.rowsAffected > 0;
}

/* ════════════════════ Chat ════════════════════ */

export async function getChatMessages(limit = 30): Promise<ChatMessageDTO[]> {
  const rs = await db().execute({
    sql: `SELECT id, sender, text, is_admin, created_at FROM (
            SELECT id, sender, text, is_admin, created_at, rowid AS rid FROM chat_messages
            ORDER BY created_at DESC, rowid DESC LIMIT ?
          ) ORDER BY created_at ASC, rid ASC`,
    args: [Math.min(Math.max(1, Math.trunc(limit)), 100)],
  });
  return rs.rows.map(rowToChatMessage);
}

export async function sendChatMessage(msg: NewChatMessage): Promise<ChatMessageDTO> {
  const sender = msg.city ? `${msg.author}${CITY_SEPARATOR}${msg.city}` : msg.author;
  const createdAt = toSqliteDate(msg.createdAt ?? Date.now());
  const rs = await db().execute({
    sql: `INSERT INTO chat_messages (id, sender, text, is_admin, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING
          RETURNING id, sender, text, is_admin, created_at`,
    args: [msg.id ?? crypto.randomUUID(), sender, msg.text, msg.role === "conduccion" ? 1 : 0, createdAt],
  });
  if (!rs.rows[0]) throw new ValidationError("Ese mensaje ya existe.");
  return rowToChatMessage(rs.rows[0]);
}

export async function deleteChatMessage(id: string): Promise<boolean> {
  const rs = await db().execute({ sql: "DELETE FROM chat_messages WHERE id = ?", args: [id] });
  return rs.rowsAffected > 0;
}
