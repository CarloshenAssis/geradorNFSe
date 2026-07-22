import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sistema Unificado — ContaDoc / CNPJTrack / Gerador DANFSe",
  description: "Motor de notas, monitoramento de CNPJ e gerador de DANFSe.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased text-slate-900">{children}</body>
    </html>
  );
}
