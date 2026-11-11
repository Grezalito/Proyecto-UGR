import Link from "next/link";
import { Radio, Store, type LucideIcon } from "lucide-react";

type ModuleId = "supermercado" | "radio";

const MODULES: { id: ModuleId; href: string; label: string; Icon: LucideIcon }[] = [
  { id: "supermercado", href: "/supermercado", label: "Supermercado", Icon: Store },
  { id: "radio", href: "/radio", label: "Estudio de Radio", Icon: Radio },
];

/** Selector de módulo estilo pill para el header global. */
export default function ModuleTabs({ current }: { current: ModuleId }) {
  return (
    <nav aria-label="Módulos del taller">
      <ul className="flex gap-1 rounded-full bg-white/10 p-1 ring-1 ring-white/15">
        {MODULES.map(({ id, href, label, Icon }) => {
          const active = id === current;
          return (
            <li key={id}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-base font-bold transition-[transform,background-color,color] duration-100 active:scale-[0.98] ${
                  active ? "bg-white text-ugr-blue shadow-sm" : "text-white/85 hover:bg-white/15 hover:text-white"
                }`}
              >
                <Icon aria-hidden className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
