import type { Metadata } from "next";

export const metadata: Metadata = { title: "Estudio de Radio" };

export default function RadioLayout({ children }: LayoutProps<"/radio">) {
  return children;
}
