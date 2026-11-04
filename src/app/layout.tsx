import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-atkinson",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Inicio · UGR Formación Laboral",
    template: "%s · UGR Formación Laboral",
  },
  description: "Práctica de Supermercado y Estudio de Radio – Servicio de Aprestamiento y Formación Laboral, UGR.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#0033a0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${atkinson.variable} antialiased`}>
      <body className="min-h-screen bg-white text-ink">
        <a href="#contenido" className="skip-link">
          Saltar al contenido principal
        </a>
        {children}
      </body>
    </html>
  );
}
