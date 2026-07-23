"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

interface Transacao {
  id: string;
  tipo: string;
  valor: number;
  status: string;
  criado_em: string;
}

interface BillingData {
  creditosDisponiveis: number;
  atualizadoEm: string | null;
  transacoes: Transacao[];
}

const TIPO_LABEL: Record<string, string> = {
  assinatura: "Assinatura",
  credito_avulso: "Crédito avulso",
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  falhou: "Falhou",
};

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null);

  useEffect(() => {
    fetch("/api/billing")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => null);
  }, []);

  return (
    <AppShell active="billing" title="Créditos" subtitle="Saldo e histórico de transações do escritório">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Créditos Disponíveis</p>
        <p className="mt-2 text-3xl font-semibold text-slate-900">{data?.creditosDisponiveis ?? "-"}</p>
        {data?.atualizadoEm && (
          <p className="mt-1 text-xs text-slate-400">
            Atualizado em {new Date(data.atualizadoEm).toLocaleString("pt-BR")}
          </p>
        )}
      </div>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-900">Histórico de Transações</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Valor</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data && data.transacoes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                    Nenhuma transação registrada ainda.
                  </td>
                </tr>
              )}
              {data?.transacoes.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-800">{TIPO_LABEL[t.tipo] ?? t.tipo}</td>
                  <td className="px-5 py-3 text-slate-800">
                    {t.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        t.status === "confirmado"
                          ? "bg-emerald-100 text-emerald-700"
                          : t.status === "falhou"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{new Date(t.criado_em).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
