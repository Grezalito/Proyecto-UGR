"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import {
  Boxes,
  Check,
  CircleCheck,
  ClipboardList,
  Hourglass,
  Inbox,
  LayoutGrid,
  LoaderCircle,
  PackageCheck,
  PackagePlus,
  PackageSearch,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Pencil,
  Search,
  Tags,
  Truck,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import RadioPlayer from "@/components/RadioPlayer";
import CategoryIcon from "@/components/supermercado/CategoryIcon";
import ProductAdminCard from "@/components/supermercado/ProductAdminCard";
import ProductForm from "@/components/supermercado/ProductForm";
import Modal from "@/components/ui/Modal";
import ModuleTabs from "@/components/ui/ModuleTabs";
import { guessCategoryIcon } from "@/lib/category-icons";
import { RADIO_STREAM, UGR_LOGO } from "@/lib/initial-data";
import { formatARS } from "@/lib/store";
import type { Category, CategoryId, NewCategory, NewProduct, Product } from "@/lib/types";

/* ════════════════════ Tipos y constantes ════════════════════ */

type Filter = CategoryId | "todas";
type LoadState = "loading" | "ready" | "error";
type OrderStatus = "pendiente" | "despachado";

interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

interface Order {
  id: string;
  customer: string;
  city: string;
  items: OrderItem[];
  total: number;
  time: string;
  status: OrderStatus;
}

const API = "/api/products";
const CATEGORIES_API = "/api/categories";
const HIGHLIGHT_MS = 2_500;
const SUCCESS_TOAST_MS = 4_000;
const ORDER_INTERVAL = 20_000;
const MAX_ORDERS = 20;
const REGION = ["Venado Tuerto", "Firmat", "Murphy", "Chovet", "Rufino", "Rosario"] as const;
const CUSTOMERS = ["Esteban", "Marta", "Juan Cruz", "Lucía", "Don Rubén", "Sofi", "Graciela", "Nacho", "Belén", "Tito"] as const;

const press = "transition-[transform,background-color,box-shadow,color] duration-100 active:scale-[0.98]";
const card = "rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow-md";

const timeFormatter = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });
const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/* ════════════════════ API ════════════════════ */

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

async function fetchProducts(signal?: AbortSignal): Promise<Product[]> {
  const res = await fetch(API, { cache: "no-store", signal });
  if (!res.ok) throw new Error(await apiError(res));
  return (await res.json()) as Product[];
}

async function fetchCategories(signal?: AbortSignal): Promise<Category[]> {
  const res = await fetch(CATEGORIES_API, { cache: "no-store", signal });
  if (!res.ok) throw new Error(await apiError(res));
  return (await res.json()) as Category[];
}

async function sendJson<T>(url: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await apiError(res));
  return (await res.json()) as T;
}

/** Devuelve solo los campos que cambiaron respecto del producto original. */
function diffProduct(before: Product, after: NewProduct): Partial<NewProduct> {
  const patch: Partial<NewProduct> = {};
  if (after.name !== before.name) patch.name = after.name;
  if (after.categoryId !== before.categoryId) patch.categoryId = after.categoryId;
  if (after.price !== before.price) patch.price = after.price;
  if (after.image !== before.image) patch.image = after.image;
  return patch;
}

/* ════════════════════ Pedidos simulados ════════════════════ */

function createOrder(products: Product[]): Order {
  const count = Math.min(products.length, 1 + Math.floor(Math.random() * 3));
  const chosen = [...products].sort(() => Math.random() - 0.5).slice(0, count);
  const items = chosen.map((p) => ({ name: p.name, qty: 1 + Math.floor(Math.random() * 3), price: p.price }));
  return {
    id: crypto.randomUUID(),
    customer: pick(CUSTOMERS),
    city: pick(REGION),
    items,
    total: items.reduce((sum, i) => sum + i.qty * i.price, 0),
    time: timeFormatter.format(new Date()),
    status: "pendiente",
  };
}

function describeItems(items: OrderItem[]): string {
  const parts = items.map((i) => `${i.qty}x ${i.name}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}` : (parts[0] ?? "");
}

/* ════════════════════ Despachos del día (localStorage, por equipo) ════════════════════ */

const DISPATCH_KEY = "ugr-despachos-v1";
const DISPATCH_EVENT = "ugr-despachos";
const today = () => new Date().toLocaleDateString("en-CA");

let dispatchCache: { date: string; count: number } | null = null;

function readDispatches(): { date: string; count: number } {
  const date = today();
  if (dispatchCache?.date === date) return dispatchCache;
  let count = 0;
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(DISPATCH_KEY) ?? "null");
    if (typeof raw === "object" && raw !== null && "date" in raw && "count" in raw && raw.date === date) {
      count = Number.isInteger(raw.count) ? Number(raw.count) : 0;
    }
  } catch {
    /* almacenamiento bloqueado o dato corrupto: arranca en 0 */
  }
  dispatchCache = { date, count };
  return dispatchCache;
}

function addDispatch() {
  dispatchCache = { date: today(), count: readDispatches().count + 1 };
  try {
    window.localStorage.setItem(DISPATCH_KEY, JSON.stringify(dispatchCache));
  } catch {
    /* se mantiene en memoria */
  }
  window.dispatchEvent(new Event(DISPATCH_EVENT));
}

function subscribeDispatches(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== DISPATCH_KEY) return;
    dispatchCache = null;
    cb();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(DISPATCH_EVENT, cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(DISPATCH_EVENT, cb);
  };
}

const useDispatchesToday = () =>
  useSyncExternalStore(
    subscribeDispatches,
    () => readDispatches().count,
    () => 0,
  );

/* ════════════════════ Componentes de presentación ════════════════════ */

function HeaderStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
      <Icon aria-hidden className="size-5 text-white/80" />
      <dt className="text-sm font-bold text-white/80">{label}</dt>
      <dd className="font-mono text-xl font-black tabular-nums">{value}</dd>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <div className={`flex items-center gap-5 p-6 ${card}`}>
      <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-ugr-blue ring-1 ring-ugr-blue/10">
        <Icon aria-hidden className="size-7" />
      </span>
      <div className="min-w-0">
        <dt className="text-base font-bold text-slate-600">{label}</dt>
        <dd className="text-3xl font-black tracking-tight text-slate-900">{value}</dd>
        <dd className="text-sm text-slate-600">{detail}</dd>
      </div>
    </div>
  );
}

function OrderCard({ order, onDispatch }: { order: Order; onDispatch: (o: Order) => void }) {
  const done = order.status === "despachado";
  return (
    <article
      data-order-id={order.id}
      tabIndex={-1}
      aria-label={`Pedido de ${order.customer}, ${order.city}, ${done ? "completado" : "pendiente"}`}
      className={`flex flex-col gap-3 p-4 ${card} ${done ? "bg-slate-50" : "border-l-4 border-l-ugr-red"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="leading-tight">
          <span className="block text-base font-bold text-slate-900">
            {order.customer} <span className="font-normal text-slate-600">· {order.city}</span>
          </span>
          <span className="text-sm text-slate-600">{order.time}</span>
        </p>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-bold ${
            done ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/30" : "bg-amber-50 text-amber-900 ring-1 ring-amber-500/40"
          }`}
        >
          {done ? <CircleCheck aria-hidden className="size-4" /> : <Hourglass aria-hidden className="size-4" />}
          {done ? "Completado" : "Pendiente"}
        </span>
      </div>

      <p className="text-base text-slate-800">pidió {describeItems(order.items)}</p>

      <div className="flex items-center justify-between gap-3">
        <p className="text-lg font-black text-ugr-blue">
          <span className="sr-only">Total: </span>
          {formatARS(order.total)}
        </p>
        {!done && (
          <button
            type="button"
            onClick={() => onDispatch(order)}
            aria-label={`Marcar como despachado el pedido de ${order.customer}`}
            className={`flex min-h-12 items-center gap-2 rounded-xl bg-ugr-blue px-4 text-base font-bold text-white shadow-sm hover:bg-ugr-blue-dark ${press}`}
          >
            <Truck aria-hidden className="size-5" />
            Marcar como despachado
          </button>
        )}
      </div>
    </article>
  );
}

/** Pill "+ Nueva categoría" que se despliega en un mini formulario en línea. */
function NewCategoryPill({ onCreate }: { onCreate: (input: NewCategory) => Promise<Category> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const inputId = useId();
  const errorId = useId();

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (restoreFocus.current) {
      triggerRef.current?.focus();
      restoreFocus.current = false;
    }
  }, [open]);

  const close = (focusTrigger: boolean) => {
    restoreFocus.current = focusTrigger;
    setOpen(false);
    setName("");
    setError("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const clean = name.trim();
    if (clean.length < 2) {
      setError("Escribí al menos 2 letras.");
      inputRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await onCreate({ name: clean, icon: guessCategoryIcon(clean) });
      close(false);
    } catch (err) {
      setError((err as Error).message);
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={`flex min-h-12 items-center gap-2 rounded-full border-2 border-dashed border-ugr-blue/50 px-4 text-base font-bold text-ugr-blue hover:border-ugr-blue hover:bg-blue-50 ${press}`}
      >
        <Plus aria-hidden className="size-5" strokeWidth={3} />
        Nueva categoría
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      onKeyDown={(e) => e.key === "Escape" && !saving && close(true)}
      noValidate
      aria-label="Crear nueva categoría"
      className="flex flex-wrap items-center gap-2 rounded-full border-2 border-ugr-blue bg-blue-50 py-1 pr-1 pl-4"
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-ugr-blue text-white">
        <CategoryIcon name={guessCategoryIcon(name)} className="size-4" />
      </span>
      <label htmlFor={inputId} className="sr-only">
        Nombre de la nueva categoría
      </label>
      <input
        ref={inputRef}
        id={inputId}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError("");
        }}
        maxLength={30}
        autoComplete="off"
        placeholder="Ej.: Verdulería"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="min-h-10 w-44 rounded-lg bg-white px-3 text-base ring-1 ring-slate-300 outline-none focus:ring-ugr-blue"
      />
      <button
        type="submit"
        disabled={saving}
        aria-label="Guardar categoría"
        className={`flex size-10 items-center justify-center rounded-full bg-ugr-blue text-white hover:bg-ugr-blue-dark disabled:opacity-60 ${press}`}
      >
        {saving ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : <Check aria-hidden className="size-5" strokeWidth={3} />}
      </button>
      <button
        type="button"
        onClick={() => close(true)}
        disabled={saving}
        aria-label="Cancelar nueva categoría"
        className={`flex size-10 items-center justify-center rounded-full text-slate-600 hover:bg-white ${press}`}
      >
        <X aria-hidden className="size-5" />
      </button>
      {error && (
        <p id={errorId} role="alert" className="basis-full pb-1 text-sm font-bold text-ugr-red">
          {error}
        </p>
      )}
    </form>
  );
}

/* ════════════════════ Página ════════════════════ */

export default function SupermercadoAdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [editing, setEditing] = useState<Product | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<{ id: number; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("todas");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersPaused, setOrdersPaused] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [orderNotice, setOrderNotice] = useState("");
  const dispatchesToday = useDispatchesToday();

  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const ordersHeadingRef = useRef<HTMLHeadingElement>(null);
  const productsRef = useRef<Product[]>([]);
  const seeded = useRef(false);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  /* ───────── Carga desde la base ───────── */

  const apply = (data: Product[]) => {
    setProducts(data);
    setLoadState("ready");
    return data;
  };

  useEffect(() => {
    const controller = new AbortController();
    const onData = (data: Product[]) => {
      setProducts(data);
      setLoadState("ready");
      // Primeros pedidos apenas hay catálogo, para que la bandeja no arranque vacía.
      if (!seeded.current && data.length) {
        seeded.current = true;
        setOrders([createOrder(data), createOrder(data)]);
      }
    };
    fetchProducts(controller.signal).then(onData, (err: unknown) => {
      if ((err as DOMException)?.name !== "AbortError") setLoadState("error");
    });
    fetchCategories(controller.signal).then(setCategories, () => undefined);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      fetchProducts().then(onData, () => undefined);
      fetchCategories().then(setCategories, () => undefined);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const data = apply(await fetchProducts());
      setAnnouncement(`Inventario actualizado: ${data.length} productos.`);
    } catch {
      setAnnouncement("No se pudo actualizar el inventario. Probá de nuevo.");
    } finally {
      setRefreshing(false);
    }
  };

  const retry = () => {
    setLoadState("loading");
    fetchProducts().then(apply, () => setLoadState("error"));
    fetchCategories().then(setCategories, () => undefined);
  };

  /* ───────── Confirmaciones visuales ───────── */

  useEffect(() => {
    if (!highlightId) return;
    const id = window.setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(id);
  }, [highlightId]);

  useEffect(() => {
    if (!successToast) return;
    const id = window.setTimeout(() => setSuccessToast(null), SUCCESS_TOAST_MS);
    return () => window.clearTimeout(id);
  }, [successToast]);

  const notifySuccess = (text: string, productId?: string) => {
    setAnnouncement(text);
    setSuccessToast({ id: Date.now(), text });
    if (productId) setHighlightId(productId);
  };

  /* ───────── Pedidos entrantes ───────── */

  useEffect(() => {
    if (ordersPaused) return;
    const id = window.setInterval(() => {
      const list = productsRef.current;
      if (!list.length || document.visibilityState !== "visible") return;
      const order = createOrder(list);
      setOrders((prev) => [order, ...prev].slice(0, MAX_ORDERS));
      setOrderNotice(`Nuevo pedido de ${order.customer}, ${order.city}: ${describeItems(order.items)}.`);
    }, ORDER_INTERVAL);
    return () => window.clearInterval(id);
  }, [ordersPaused]);

  const dispatchOrder = (order: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "despachado" } : o)));
    addDispatch();
    setOrderNotice(`Pedido de ${order.customer} despachado. Llevás ${dispatchesToday + 1} despachos hoy.`);
    requestAnimationFrame(() => {
      const next = document.querySelector<HTMLButtonElement>("[data-order-id] button");
      (next ?? document.querySelector<HTMLElement>(`[data-order-id="${order.id}"]`) ?? ordersHeadingRef.current)?.focus();
    });
  };

  const pendingCount = orders.filter((o) => o.status === "pendiente").length;
  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => Number(a.status === "despachado") - Number(b.status === "despachado")),
    [orders],
  );

  /* ───────── Derivados del catálogo ───────── */

  const metrics = useMemo(() => {
    const active = new Set(products.map((p) => p.categoryId)).size;
    const avg = products.length ? products.reduce((a, p) => a + p.price, 0) / products.length : 0;
    return { total: products.length, active, avg: Math.round(avg) };
  }, [products]);

  const counts = useMemo(() => {
    const map = new Map<Filter, number>([["todas", products.length]]);
    for (const p of products) map.set(p.categoryId, (map.get(p.categoryId) ?? 0) + 1);
    return map;
  }, [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es-AR");
    return products.filter(
      (p) => (filter === "todas" || p.categoryId === filter) && (!q || p.name.toLocaleLowerCase("es-AR").includes(q)),
    );
  }, [products, filter, query]);

  /* ───────── Mutaciones del catálogo ───────── */

  const openCreate = () => {
    setEditing(null);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const handleSave = async (input: NewProduct) => {
    if (saving) return;
    const original = editing;
    if (original) {
      const patch = diffProduct(original, input);
      if (Object.keys(patch).length === 0) {
        setModalOpen(false);
        setAnnouncement(`Sin cambios en ${original.name}.`);
        return;
      }
    }
    setSaving(true);
    setFormError("");
    try {
      if (original) {
        const p = await sendJson<Product>(API, "PATCH", { id: original.id, ...diffProduct(original, input) });
        setProducts((list) => list.map((x) => (x.id === p.id ? p : x)));
        setModalOpen(false);
        notifySuccess(`Cambios guardados: ${p.name}, ${formatARS(p.price)}, en ${categoryLabel(p.categoryId)}.`, p.id);
      } else {
        const p = await sendJson<Product>(API, "POST", input);
        setProducts((list) => [p, ...list.filter((x) => x.id !== p.id)]);
        setModalOpen(false);
        setFilter("todas");
        setQuery("");
        notifySuccess(`Producto agregado: ${p.name}, ${formatARS(p.price)}, en ${categoryLabel(p.categoryId)}.`, p.id);
      }
    } catch (err) {
      setFormError(`No se pudo guardar el producto. ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCategory = async (input: NewCategory): Promise<Category> => {
    const c = await sendJson<Category>(CATEGORIES_API, "POST", input);
    setCategories((list) => (list.some((x) => x.id === c.id) ? list : [...list, c]));
    setFilter(c.id);
    notifySuccess(`Categoría creada: ${c.name}. Ya podés asignarla a productos.`);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-category-id="${c.id}"]`)?.focus());
    return c;
  };

  const handleDelete = async (id: string) => {
    const index = products.findIndex((x) => x.id === id);
    const prev = products[index];
    if (!prev) return;
    setProducts((list) => list.filter((p) => p.id !== id));
    listHeadingRef.current?.focus();
    try {
      const res = await fetch(`${API}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(await apiError(res));
      setAnnouncement(`${prev.name} fue eliminado del inventario.`);
    } catch {
      setProducts((list) => {
        const next = [...list];
        next.splice(Math.min(index, next.length), 0, prev);
        return next;
      });
      setAnnouncement(`No se pudo eliminar ${prev.name}. Probá de nuevo.`);
    }
  };

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const categoryLabel = (id: CategoryId) => categoryById.get(id)?.name ?? id;
  const filters: (Category | { id: "todas"; name: string; icon?: undefined })[] = [
    { id: "todas", name: "Todas" },
    ...categories,
  ];
  const loading = loadState === "loading";

  return (
    <div className="min-h-screen bg-slate-50">
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      {/* ───────── Header global ───────── */}
      <header className="sticky top-0 z-40 bg-ugr-blue text-white shadow-md">
        <div className="mx-auto flex h-header max-w-[1700px] items-center justify-between gap-6 px-8">
          <div className="flex items-center gap-5">
            <Link href="/" className="flex h-14 items-center rounded-xl bg-white px-3" aria-label="Ir al inicio">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={UGR_LOGO} alt="Universidad del Gran Rosario" className="h-10 w-auto" width={133} height={40} />
            </Link>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-wider text-white/75 uppercase">Panel de administración</p>
              <p className="text-2xl font-bold tracking-tight">Supermercado UGR</p>
            </div>
            <ModuleTabs current="supermercado" />
          </div>

          <div className="flex items-center gap-4">
            <dl aria-label="Métricas rápidas" className="flex gap-2">
              <HeaderStat icon={Boxes} label="Productos" value={metrics.total} />
              <HeaderStat icon={ClipboardList} label="Pendientes" value={pendingCount} />
              <HeaderStat icon={PackageCheck} label="Despachos hoy" value={dispatchesToday} />
            </dl>
            <RadioPlayer streamUrl={RADIO_STREAM.url} stationName={RADIO_STREAM.name} />
          </div>
        </div>
      </header>

      <div
        className={`mx-auto grid max-w-[1700px] items-start gap-8 px-8 py-10 ${
          panelOpen ? "grid-cols-[minmax(0,1fr)_26rem]" : "grid-cols-[minmax(0,1fr)_auto]"
        }`}
      >
        <main id="contenido" tabIndex={-1} className="flex min-w-0 flex-col gap-8">
          {/* ───────── Título + acción principal ───────── */}
          <div className="flex items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">Gestor de catálogo</h1>
              <p className="mt-1 text-lg text-slate-600">
                Agregá, cambiá precios o quitá productos. Los cambios se comparten con todo el taller.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              disabled={loading}
              className={`flex min-h-14 shrink-0 items-center gap-3 rounded-xl bg-ugr-red px-7 text-xl font-bold text-white shadow-sm hover:bg-ugr-red-dark hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${press}`}
            >
              <Plus aria-hidden className="size-6" strokeWidth={3} />
              Nuevo producto
            </button>
          </div>

          {/* ───────── Métricas ───────── */}
          <section aria-label="Resumen del inventario" aria-busy={loading}>
            <dl className="grid grid-cols-3 gap-6">
              <MetricCard
                icon={Boxes}
                label="Productos en inventario"
                value={loading ? "…" : String(metrics.total)}
                detail={metrics.total === 1 ? "1 artículo cargado" : `${metrics.total} artículos cargados`}
              />
              <MetricCard
                icon={Tags}
                label="Categorías activas"
                value={loading ? "…" : `${metrics.active} de ${categories.length}`}
                detail="Con al menos un producto"
              />
              <MetricCard
                icon={Wallet}
                label="Valor promedio"
                value={!loading && metrics.total ? formatARS(metrics.avg) : "—"}
                detail="Precio medio del catálogo"
              />
            </dl>
          </section>

          {/* ───────── Selector de categorías + búsqueda ───────── */}
          <section aria-label="Filtros del catálogo" className={`flex flex-col gap-4 p-5 ${card}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex min-h-12 flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 focus-within:border-ugr-blue focus-within:bg-white">
                <Search aria-hidden className="size-5 text-slate-500" />
                <span className="sr-only">Buscar producto por nombre</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar producto…"
                  className="min-h-11 w-full bg-transparent text-base outline-none"
                />
              </label>
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing || loading}
                className={`flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 px-4 text-base font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 ${press}`}
              >
                <RefreshCw aria-hidden className={`size-5 ${refreshing ? "animate-spin" : ""}`} />
                Actualizar
              </button>
            </div>

            <div role="group" aria-label="Filtrar por categoría" className="flex flex-wrap gap-2">
              {filters.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    data-category-id={f.id}
                    aria-pressed={active}
                    onClick={() => setFilter(f.id)}
                    className={`flex min-h-12 items-center gap-2 rounded-full border px-4 text-base font-bold ${press} ${
                      active
                        ? "border-ugr-blue bg-ugr-blue text-white shadow-md shadow-ugr-blue/20"
                        : "border-slate-200 bg-white text-slate-700 hover:border-ugr-blue/40 hover:bg-blue-50"
                    }`}
                  >
                    {f.id === "todas" ? <LayoutGrid aria-hidden className="size-5" /> : <CategoryIcon name={f.icon} />}
                    {f.name}
                    <span
                      className={`min-w-7 rounded-full px-2 text-center text-sm ${
                        active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {counts.get(f.id) ?? 0}
                    </span>
                  </button>
                );
              })}
              <NewCategoryPill onCreate={handleCreateCategory} />
            </div>
          </section>

          {/* ───────── Grilla ───────── */}
          <section aria-labelledby="titulo-inventario" aria-busy={loading} className="flex flex-col gap-4">
            <h2 id="titulo-inventario" ref={listHeadingRef} tabIndex={-1} className="text-2xl font-bold tracking-tight text-slate-900">
              Inventario
              {loadState === "ready" && (
                <span className="ml-3 text-lg font-normal text-slate-600" aria-live="polite">
                  {visible.length === 1 ? "1 producto" : `${visible.length} productos`}
                </span>
              )}
            </h2>

            {loadState === "loading" ? (
              <div role="status" className={`flex flex-col items-center gap-4 px-8 py-16 text-center ${card}`}>
                <LoaderCircle aria-hidden className="size-12 animate-spin text-ugr-blue" />
                <p className="text-xl font-bold text-slate-800">Cargando productos…</p>
              </div>
            ) : loadState === "error" ? (
              <div role="alert" className="flex flex-col items-center gap-4 rounded-2xl border-2 border-ugr-red/40 bg-red-50 px-8 py-16 text-center">
                <p className="text-xl font-bold text-ugr-red">No se pudieron cargar los productos.</p>
                <button
                  type="button"
                  onClick={retry}
                  className={`flex min-h-12 items-center gap-2 rounded-xl bg-ugr-blue px-6 text-lg font-bold text-white ${press}`}
                >
                  <RefreshCw aria-hidden className="size-5" />
                  Reintentar
                </button>
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-8 py-16 text-center">
                <PackageSearch aria-hidden className="size-14 text-slate-400" />
                <p className="text-xl font-bold text-slate-800">
                  {products.length === 0 ? "El inventario está vacío" : "No hay productos con ese filtro"}
                </p>
                <button
                  type="button"
                  onClick={openCreate}
                  className={`flex min-h-12 items-center gap-2 rounded-xl bg-ugr-red px-6 text-lg font-bold text-white hover:bg-ugr-red-dark ${press}`}
                >
                  <Plus aria-hidden className="size-5" strokeWidth={3} />
                  Cargar un producto
                </button>
              </div>
            ) : (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-6">
                {visible.map((p) => (
                  <li key={p.id} className="flex flex-col">
                    <ProductAdminCard
                      product={p}
                      category={categoryById.get(p.categoryId)}
                      highlighted={highlightId === p.id}
                      onEdit={openEdit}
                      onDelete={(id) => void handleDelete(id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>

        {/* ───────── Bandeja de pedidos en vivo ───────── */}
        <aside aria-labelledby="titulo-pedidos" className="sticky top-[calc(var(--spacing-header)+1.5rem)]">
          <p aria-live="polite" aria-atomic="true" className="sr-only">
            {ordersPaused ? "" : orderNotice}
          </p>

          {panelOpen ? (
            <div className={`flex max-h-[calc(100vh-var(--spacing-header)-3rem)] flex-col overflow-hidden ${card}`}>
              <div className="flex flex-col gap-3 border-b border-slate-200 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2
                    id="titulo-pedidos"
                    ref={ordersHeadingRef}
                    tabIndex={-1}
                    className="flex items-center gap-2 text-xl leading-tight font-bold tracking-tight text-slate-900"
                  >
                    <Inbox aria-hidden className="size-6 text-ugr-blue" />
                    Gestión de pedidos entrantes
                  </h2>
                  <button
                    type="button"
                    onClick={() => setPanelOpen(false)}
                    aria-expanded
                    aria-controls="bandeja-pedidos"
                    aria-label="Ocultar bandeja de pedidos"
                    className={`flex size-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 ${press}`}
                  >
                    <PanelRightClose aria-hidden className="size-5" />
                  </button>
                </div>

                <dl className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-500/30">
                    <dt className="text-sm font-bold text-amber-900">Pendientes</dt>
                    <dd className="text-2xl font-black text-amber-950 tabular-nums">{pendingCount}</dd>
                  </div>
                  <div className="rounded-xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-600/30">
                    <dt className="text-sm font-bold text-emerald-800">Despachos del día</dt>
                    <dd className="text-2xl font-black text-emerald-950 tabular-nums">{dispatchesToday}</dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={() => setOrdersPaused((v) => !v)}
                  aria-pressed={ordersPaused}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-base font-bold text-slate-700 hover:bg-slate-100 ${press}`}
                >
                  {ordersPaused ? <Play aria-hidden className="size-5" /> : <Pause aria-hidden className="size-5" />}
                  {ordersPaused ? "Reanudar pedidos entrantes" : "Pausar pedidos entrantes"}
                </button>
              </div>

              <div id="bandeja-pedidos" className="flex-1 overflow-y-auto bg-slate-50 p-4">
                {sortedOrders.length === 0 ? (
                  <p className="flex flex-col items-center gap-2 py-10 text-center text-base text-slate-600">
                    <Inbox aria-hidden className="size-10 text-slate-400" />
                    {loading ? "Esperando el catálogo…" : "Todavía no entraron pedidos."}
                  </p>
                ) : (
                  <ul aria-label="Pedidos" className="flex flex-col gap-3">
                    {sortedOrders.map((o) => (
                      <li key={o.id}>
                        <OrderCard order={o} onDispatch={dispatchOrder} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              aria-expanded={false}
              className={`flex flex-col items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-5 font-bold text-ugr-blue shadow-sm hover:shadow-md ${press}`}
            >
              <PanelRightOpen aria-hidden className="size-6" />
              <span id="titulo-pedidos" className="[writing-mode:vertical-rl]">
                Pedidos entrantes
              </span>
              {pendingCount > 0 && (
                <span className="rounded-full bg-ugr-red px-2 py-0.5 text-sm text-white">
                  {pendingCount}
                  <span className="sr-only"> pendientes</span>
                </span>
              )}
            </button>
          )}
        </aside>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        busy={saving}
        icon={editing ? Pencil : PackagePlus}
        title={editing ? "Editar producto" : "Nuevo producto"}
        description={
          editing ? `Cambiá los datos de ${editing.name} y guardá.` : "Completá los datos. Los campos con * son obligatorios."
        }
      >
        <div className="flex flex-col gap-4">
          {formError && (
            <p role="alert" className="rounded-xl border border-ugr-red/40 bg-red-50 px-4 py-3 text-base font-bold text-ugr-red">
              {formError}
            </p>
          )}
          <ProductForm
            key={editing?.id ?? "nuevo"}
            categories={categories}
            initial={editing ?? undefined}
            submitting={saving}
            onSubmit={(p) => void handleSave(p)}
            onCancel={closeModal}
          />
        </div>
      </Modal>

      {/* ───────── Confirmación visual (la auditiva va por la región viva) ───────── */}
      <div aria-hidden className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
        {successToast && (
          <p
            key={successToast.id}
            className="flex items-center gap-3 rounded-2xl bg-emerald-700 px-5 py-3 text-base font-bold text-white shadow-xl ring-1 ring-emerald-900/20 transition-[opacity,transform] duration-200 starting:translate-y-2 starting:opacity-0"
          >
            <CircleCheck className="size-6 shrink-0" />
            {successToast.text}
          </p>
        )}
      </div>
    </div>
  );
}
