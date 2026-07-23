"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type NavKey =
  | "dashboard"
  | "clientes"
  | "danfse"
  | "lotes"
  | "monitoramento"
  | "alertas"
  | "billing";

interface NavItem {
  key: NavKey;
  label: string;
  href: string;
  icon: ReactNode;
}

function IconDashboard() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M3 3h6v6H3V3zm8 0h6v10h-6V3zM3 11h6v6H3v-6z" />
    </svg>
  );
}
function IconClientes() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10 9a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM3 17c0-3 3-5.5 7-5.5S17 14 17 17v.5H3V17z" />
    </svg>
  );
}
function IconDanfse() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M5 2h7l3 3v13a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1zm6 1.5V6h2.5L11 3.5zM6 10h8v1.2H6V10zm0 3h8v1.2H6V13z" />
    </svg>
  );
}
function IconLote() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M3 4a1 1 0 011-1h4l1.5 1.5H16a1 1 0 011 1V15a1 1 0 01-1 1H4a1 1 0 01-1-1V4z" />
    </svg>
  );
}
function IconMonitor() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10 2a8 8 0 108 8 8 8 0 00-8-8zm.75 4v4.4l3.4 2-0.75 1.24-4.15-2.46V6h1.5z" />
    </svg>
  );
}
function IconAlerta() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10 2a1 1 0 011 1v.6a6 6 0 015 5.9v2.6l1.3 2.4a.8.8 0 01-.7 1.2H3.4a.8.8 0 01-.7-1.2L4 12.1V9.5a6 6 0 015-5.9V3a1 1 0 011-1zm0 16a2 2 0 002-2H8a2 2 0 002 2z" />
    </svg>
  );
}
function IconBilling() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm2 2v1.5h10V7H5zm0 3.5V15h4v-4.5H5z" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Visão Geral", href: "/dashboard", icon: <IconDashboard /> },
  { key: "clientes", label: "Clientes", href: "/clientes", icon: <IconClientes /> },
  { key: "danfse", label: "Gerador de DANFSe", href: "/danfse", icon: <IconDanfse /> },
  { key: "lotes", label: "Processamento em Lote", href: "/lotes", icon: <IconLote /> },
  { key: "monitoramento", label: "Monitoramento de CNPJ", href: "/monitoramento", icon: <IconMonitor /> },
  { key: "alertas", label: "Alertas", href: "/alertas", icon: <IconAlerta /> },
  { key: "billing", label: "Créditos", href: "/billing", icon: <IconBilling /> },
];

interface Me {
  email: string;
  papel: string;
  escritorioNome: string | null;
}

export function AppShell({ active, title, subtitle, children }: { active: NavKey; title: string; subtitle?: string; children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => null);
  }, []);

  async function handleLogout() {
    setSaindo(true);
    try {
      await createSupabaseBrowserClient().auth.signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center border-b border-slate-100 px-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className={isActive ? "text-brand-600" : "text-slate-400"}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <button
            onClick={handleLogout}
            disabled={saindo}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M7 3a1 1 0 00-1 1v12a1 1 0 001 1h4a1 1 0 100-2H8V5h3a1 1 0 100-2H7zm7.3 3.3a1 1 0 10-1.4 1.4L14.6 9H9a1 1 0 100 2h5.6l-1.7 1.7a1 1 0 101.4 1.4l3.4-3.4a1 1 0 000-1.4l-3.4-3.4z" />
            </svg>
            {saindo ? "Saindo..." : "Sair"}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
          <div>
            <h1 className="text-base font-semibold text-slate-900">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          {me && (
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{me.escritorioNome ?? "Escritório"}</p>
              <p className="text-xs text-slate-400">
                {me.email} · {me.papel === "admin" ? "Administrador" : "Operador"}
              </p>
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
