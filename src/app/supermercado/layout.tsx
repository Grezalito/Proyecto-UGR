import type { Metadata } from "next";

export const metadata: Metadata = { title: "Supermercado" };

export default function SupermercadoLayout({ children }: LayoutProps<"/supermercado">) {
  return children;
}
