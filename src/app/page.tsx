import Link from "next/link";
import { ArrowRight, Radio, ShoppingCart } from "lucide-react";

const MODULES = [
  {
    href: "/supermercado",
    title: "Entrar al Supermercado",
    description: "Elegí productos, armá tu carrito y enviá el pedido por WhatsApp.",
    Icon: ShoppingCart,
  },
  {
    href: "/radio",
    title: "Entrar al Estudio de Radio",
    description: "Salí al aire, pasá música, usá efectos y respondé a los oyentes.",
    Icon: Radio,
  },
] as const;

export default function Home() {
  return (
    <main
      id="contenido"
      className="flex min-h-screen flex-col items-center justify-center gap-12 bg-ugr-blue px-8 py-16 text-white"
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="rounded-2xl bg-white px-6 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://ugr.edu.ar/wp-content/uploads/2023/07/logo-ugr-color.png"
            alt="Universidad del Gran Rosario"
            className="h-16 w-auto"
            width={213}
            height={64}
          />
        </div>
        <h1 className="text-5xl font-bold">¡Hola! ¿A dónde querés entrar?</h1>
        <p className="max-w-3xl text-2xl text-white/90">
          Servicio de Aprestamiento y Formación Laboral
        </p>
      </div>

      <nav aria-label="Elegí un módulo" className="w-full max-w-6xl">
        <ul className="grid grid-cols-2 gap-10">
          {MODULES.map(({ href, title, description, Icon }) => (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-describedby={`desc-${href.slice(1)}`}
                className="group flex w-full flex-col items-center gap-6 rounded-3xl border-4 border-white bg-white p-12 text-center text-ugr-blue shadow-2xl transition-transform hover:-translate-y-1 hover:border-ugr-red"
              >
                <span className="flex size-32 items-center justify-center rounded-full bg-ugr-red text-white">
                  <Icon aria-hidden className="size-16" strokeWidth={2} />
                </span>
                <span className="text-4xl font-bold">{title}</span>
                <span id={`desc-${href.slice(1)}`} className="text-xl text-muted">
                  {description}
                </span>
                <span
                  aria-hidden
                  className="mt-auto flex items-center gap-3 rounded-xl bg-ugr-blue px-8 py-4 text-2xl font-bold text-white group-hover:bg-ugr-blue-dark"
                >
                  Entrar <ArrowRight className="size-7" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
