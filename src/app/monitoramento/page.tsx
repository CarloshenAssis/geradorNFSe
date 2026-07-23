"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

interface ClienteMonitorado {
  id: string;
  cnpj: string;
  razao_social: string | null;
  monitoramento: {
    situacao_cadastral: string | null;
    ultima_verificacao: string | null;
    proxima_obrigacao: string | null;
    proxima_obrigacao_data: string | null;
  } | null;
}

function formatCnpj(digits: string): string {
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export default function MonitoramentoPage() {
  const [clientes, setClientes] = useState<ClienteMonitorado[] | null>(null);

  useEffect(() => {
    fetch("/api/monitoramento")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setClientes(data?.clientes ?? []))
      .catch(() => setClientes([]));
  }, []);

  return (
    <AppShell active="monitoramento" title="Monitoramento de CNPJ" subtitle="Situação cadastral e próximas obrigações dos clientes ativos">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3">Cliente</th>
              <th className="px-5 py-3">Situação Cadastral</th>
              <th className="px-5 py-3">Próxima Obrigação</th>
              <th className="px-5 py-3">Última Verificação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clientes === null && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                  Carregando...
                </td>
              </tr>
            )}
            {clientes?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                  Nenhum cliente ativo para monitorar. Cadastre clientes na seção Clientes.
                </td>
              </tr>
            )}
            {clientes?.map((cliente) => (
              <tr key={cliente.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-800">{cliente.razao_social ?? "-"}</p>
                  <p className="font-mono text-xs text-slate-400">{formatCnpj(cliente.cnpj)}</p>
                </td>
                <td className="px-5 py-3 text-slate-700">
                  {cliente.monitoramento?.situacao_cadastral ?? (
                    <span className="text-slate-400">Ainda não verificado</span>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-700">
                  {cliente.monitoramento?.proxima_obrigacao
                    ? `${cliente.monitoramento.proxima_obrigacao}${
                        cliente.monitoramento.proxima_obrigacao_data
                          ? ` — ${new Date(cliente.monitoramento.proxima_obrigacao_data).toLocaleDateString("pt-BR")}`
                          : ""
                      }`
                    : "-"}
                </td>
                <td className="px-5 py-3 text-slate-500">
                  {cliente.monitoramento?.ultima_verificacao
                    ? new Date(cliente.monitoramento.ultima_verificacao).toLocaleString("pt-BR")
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
