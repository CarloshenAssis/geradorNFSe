"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

interface Alerta {
  id: string;
  cliente_id: string | null;
  tipo: string;
  mensagem: string;
  lido: boolean;
  criado_em: string;
}

const TIPO_LABEL: Record<string, string> = {
  certificado_vencendo: "Certificado vencendo",
  certificado_vencido: "Certificado vencido",
  situacao_cadastral_alterada: "Situação cadastral alterada",
  obrigacao_proxima: "Obrigação próxima",
  nova_nota_fiscal: "Nova nota fiscal",
  danfse_fora_padrao: "DANFSe fora do padrão",
};

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | "nao_lidos">("nao_lidos");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const response = await fetch("/api/alertas");
    if (response.ok) {
      const data = await response.json();
      setAlertas(data.alertas ?? []);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function marcarLido(alerta: Alerta) {
    setAlertas((prev) => prev.map((a) => (a.id === alerta.id ? { ...a, lido: !a.lido } : a)));
    await fetch(`/api/alertas/${alerta.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lido: !alerta.lido }),
    });
  }

  const alertasFiltrados = filtro === "todos" ? alertas : alertas.filter((a) => !a.lido);

  return (
    <AppShell active="alertas" title="Alertas" subtitle="Certificados, situação cadastral e obrigações">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFiltro("nao_lidos")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            filtro === "nao_lidos" ? "bg-brand-600 text-white" : "bg-white text-slate-600 border border-slate-200"
          }`}
        >
          Não lidos
        </button>
        <button
          onClick={() => setFiltro("todos")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            filtro === "todos" ? "bg-brand-600 text-white" : "bg-white text-slate-600 border border-slate-200"
          }`}
        >
          Todos
        </button>
      </div>

      <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {carregando && <p className="px-5 py-8 text-center text-sm text-slate-400">Carregando...</p>}
        {!carregando && alertasFiltrados.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            {filtro === "nao_lidos" ? "Nenhum alerta não lido. Tudo em dia." : "Nenhum alerta registrado ainda."}
          </p>
        )}
        {alertasFiltrados.map((alerta) => (
          <div key={alerta.id} className="flex items-start justify-between gap-4 px-5 py-3">
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-brand-600">
                {TIPO_LABEL[alerta.tipo] ?? alerta.tipo}
              </span>
              <p className="mt-0.5 text-sm text-slate-800">{alerta.mensagem}</p>
              <p className="mt-0.5 text-xs text-slate-400">{new Date(alerta.criado_em).toLocaleString("pt-BR")}</p>
            </div>
            <button
              onClick={() => marcarLido(alerta)}
              className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              {alerta.lido ? "Marcar não lido" : "Marcar lido"}
            </button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
