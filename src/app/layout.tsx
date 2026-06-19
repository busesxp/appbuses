import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buses XP — Gestión de Flota",
  description: "Sistema de gestión operativa de flota — Grupo XP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
