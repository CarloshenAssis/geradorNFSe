"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";

interface DashboardData {
  creditosDisponiveis: number;
  clientesAtivos: number;
  alertasRecentes: Array<{ id: string; tipo: string; mensagem: string; criado_em: string }>;
  lotesRecentes: Array<{
    id: string;
    status: string;
    quantidade_arquivos: number;
    quantidade_sucesso: number;
    quantidade_erro: number;
    criado_em: string;
  }>;
}

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  processando: "Processando",
  concluido: "Concluído",
  concluido_com_erros: "Concluído com erros",
  falhou: "Falhou",
};

function Card({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const content = (
    <div className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-brand-200 hover:shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => null);
  }, []);

  return (
    <AppShell active="dashboard" title="Visão Geral" subtitle="Resumo do seu escritório">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card label="Créditos Disponíveis" value={data?.creditosDisponiveis ?? "-"} href="/billing" />
        <Card label="Clientes Ativos" value={data?.clientesAtivos ?? "-"} href="/clientes" />
        <Card label="Alertas Não Lidos" value={data?.alertasRecentes.length ?? "-"} href="/alertas" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Alertas Recentes</h2>
            <Link href="/alertas" className="text-xs font-medium text-brand-600 hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {(data?.alertasRecentes.length ?? 0) === 0 && (
              <p className="px-5 py-8 text-center text-sm text-slate-400">Nenhum alerta pendente.</p>
            )}
            {data?.alertasRecentes.map((alerta) => (
              <div key={alerta.id} className="px-5 py-3 text-sm">
                <p className="text-slate-800">{alerta.mensagem}</p>
                <p className="mt-0.5 text-xs text-slate-400">{new Date(alerta.criado_em).toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Lotes Recentes</h2>
            <Link href="/lotes" className="text-xs font-medium text-brand-600 hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {(data?.lotesRecentes.length ?? 0) === 0 && (
              <p className="px-5 py-8 text-center text-sm text-slate-400">Nenhum lote processado ainda.</p>
            )}
            {data?.lotesRecentes.map((lote) => (
              <div key={lote.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="text-slate-800">
                    {lote.quantidade_sucesso}/{lote.quantidade_arquivos} processados
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{new Date(lote.criado_em).toLocaleString("pt-BR")}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                  {STATUS_LABEL[lote.status] ?? lote.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
