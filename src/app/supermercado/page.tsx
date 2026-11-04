"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Boxes, LayoutGrid, LogOut, PackageSearch, Plus, RotateCcw, Search, Tags, Wallet } from "lucide-react";
import RadioPlayer from "@/components/RadioPlayer";
import ProductAdminCard from "@/components/supermercado/ProductAdminCard";
import ProductForm from "@/components/supermercado/ProductForm";
import Modal from "@/components/ui/Modal";
import { CATEGORIES, RADIO_STREAM, UGR_LOGO } from "@/lib/initial-data";
import { categoryName, formatARS, useInventory } from "@/lib/store";
import type { CategoryId, NewProduct } from "@/lib/types";

type Filter = CategoryId | "todas";

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-ugr-blue">
        <Icon aria-hidden className="size-7" />
      </span>
      <div>
        <dt className="text-base font-bold text-slate-600">{label}</dt>
        <dd className="text-3xl font-bold text-slate-900">{value}</dd>
        <dd className="text-sm text-slate-500">{detail}</dd>
      </div>
    </div>
  );
}

export default function SupermercadoAdminPage() {
  const { products, addProduct, updateProduct, removeProduct, resetProducts } = useInventory();
  const [filter, setFilter] = useState<Filter>("todas");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const listHeadingRef = useRef<HTMLHeadingElement>(null);

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
      (p) =>
        (filter === "todas" || p.categoryId === filter) &&
        (!q || p.name.toLocaleLowerCase("es-AR").includes(q)),
    );
  }, [products, filter, query]);

  const handleCreate = (input: NewProduct) => {
    const p = addProduct(input);
    setModalOpen(false);
    setFilter("todas");
    setQuery("");
    setAnnouncement(`Producto agregado: ${p.name}, ${formatARS(p.price)}, en ${categoryName(p.categoryId)}.`);
  };

  const handleUpdatePrice = (id: string, cents: number) => {
    const p = products.find((x) => x.id === id);
    updateProduct(id, { price: cents });
    if (p) setAnnouncement(`Nuevo precio de ${p.name}: ${formatARS(cents)}.`);
  };

  const handleDelete = (id: string) => {
    const p = products.find((x) => x.id === id);
    removeProduct(id);
    if (p) setAnnouncement(`${p.name} fue eliminado del inventario.`);
    listHeadingRef.current?.focus();
  };

  const handleReset = () => {
    if (!window.confirm("¿Restaurar los 6 productos de ejemplo? Se pierden los cambios hechos.")) return;
    resetProducts();
    setAnnouncement("Inventario restaurado con los productos de ejemplo.");
  };

  const filters: { id: Filter; name: string }[] = [{ id: "todas", name: "Todas" }, ...CATEGORIES];

  return (
    <div className="min-h-screen bg-slate-50">
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      {/* ───────── Header ───────── */}
      <header className="sticky top-0 z-40 bg-ugr-blue text-white shadow-md">
        <div className="mx-auto flex h-header max-w-[1600px] items-center justify-between gap-8 px-8">
          <div className="flex items-center gap-5">
            <div className="flex h-14 items-center rounded-xl bg-white px-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={UGR_LOGO} alt="Universidad del Gran Rosario" className="h-10 w-auto" width={133} height={40} />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-wider text-white/70 uppercase">Panel de administración</p>
              <p className="text-2xl font-bold">Supermercado UGR</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <RadioPlayer streamUrl={RADIO_STREAM.url} stationName={RADIO_STREAM.name} />
            <Link
              href="/"
              className="flex min-h-12 items-center gap-2 rounded-xl border border-white/60 px-4 text-base font-bold hover:bg-white hover:text-ugr-blue"
            >
              <LogOut aria-hidden className="size-5" />
              Volver al inicio
            </Link>
          </div>
        </div>
      </header>

      <main id="contenido" tabIndex={-1} className="mx-auto flex max-w-[1600px] flex-col gap-8 px-8 py-10">
        {/* ───────── Título + acción principal ───────── */}
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Gestor de catálogo</h1>
            <p className="mt-1 text-lg text-slate-600">
              Agregá, cambiá precios o quitá productos. Los cambios se guardan solos en este equipo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex min-h-14 shrink-0 items-center gap-3 rounded-xl bg-ugr-red px-7 text-xl font-bold text-white shadow-sm transition-shadow hover:bg-ugr-red-dark hover:shadow-md"
          >
            <Plus aria-hidden className="size-6" strokeWidth={3} />
            Nuevo producto
          </button>
        </div>

        {/* ───────── Métricas ───────── */}
        <section aria-label="Resumen del inventario">
          <dl className="grid grid-cols-3 gap-6">
            <MetricCard
              icon={Boxes}
              label="Productos en inventario"
              value={String(metrics.total)}
              detail={metrics.total === 1 ? "1 artículo cargado" : `${metrics.total} artículos cargados`}
            />
            <MetricCard
              icon={Tags}
              label="Categorías activas"
              value={`${metrics.active} de ${CATEGORIES.length}`}
              detail="Con al menos un producto"
            />
            <MetricCard
              icon={Wallet}
              label="Valor promedio"
              value={metrics.total ? formatARS(metrics.avg) : "—"}
              detail="Precio medio del catálogo"
            />
          </dl>
        </section>

        {/* ───────── Filtros ───────── */}
        <section
          aria-label="Filtros del catálogo"
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div role="group" aria-label="Filtrar por categoría" className="flex flex-wrap gap-2">
            {filters.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f.id)}
                  className={`flex min-h-12 items-center gap-2 rounded-xl px-4 text-base font-bold transition-colors ${
                    active ? "bg-ugr-blue text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {f.id === "todas" && <LayoutGrid aria-hidden className="size-5" />}
                  {f.name}
                  <span
                    className={`rounded-full px-2 text-sm ${active ? "bg-white/20" : "bg-white text-slate-600"}`}
                  >
                    {counts.get(f.id) ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 px-4 focus-within:border-ugr-blue">
              <Search aria-hidden className="size-5 text-slate-500" />
              <span className="sr-only">Buscar producto por nombre</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar producto…"
                className="min-h-11 w-56 text-base outline-none"
              />
            </label>
            <button
              type="button"
              onClick={handleReset}
              className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 px-4 text-base font-bold text-slate-700 hover:bg-slate-100"
            >
              <RotateCcw aria-hidden className="size-5" />
              Restaurar ejemplos
            </button>
          </div>
        </section>

        {/* ───────── Grilla ───────── */}
        <section aria-labelledby="titulo-inventario" className="flex flex-col gap-4">
          <h2
            id="titulo-inventario"
            ref={listHeadingRef}
            tabIndex={-1}
            className="text-2xl font-bold text-slate-900"
          >
            Inventario
            <span className="ml-3 text-lg font-normal text-slate-500" aria-live="polite">
              {visible.length === 1 ? "1 producto" : `${visible.length} productos`}
            </span>
          </h2>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-8 py-16 text-center">
              <PackageSearch aria-hidden className="size-14 text-slate-400" />
              <p className="text-xl font-bold text-slate-800">
                {products.length === 0 ? "El inventario está vacío" : "No hay productos con ese filtro"}
              </p>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="flex min-h-12 items-center gap-2 rounded-xl bg-ugr-red px-6 text-lg font-bold text-white hover:bg-ugr-red-dark"
              >
                <Plus aria-hidden className="size-5" strokeWidth={3} />
                Cargar un producto
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-6">
              {visible.map((p) => (
                <li key={p.id} className="flex flex-col">
                  <ProductAdminCard product={p} onUpdatePrice={handleUpdatePrice} onDelete={handleDelete} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nuevo producto"
        description="Completá los datos. Los campos con * son obligatorios."
      >
        <ProductForm onSubmit={handleCreate} onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}
