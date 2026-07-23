"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";

interface Cliente {
  id: string;
  cnpj: string;
  razao_social: string | null;
  ativo: boolean;
  criado_em: string;
}

function formatCnpj(digits: string): string {
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [filtro, setFiltro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const response = await fetch("/api/clientes");
    if (response.ok) {
      const data = await response.json();
      setClientes(data.clientes ?? []);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);

    const cnpjDigits = cnpj.replace(/\D/g, "");
    if (cnpjDigits.length !== 14) {
      setErro("CNPJ deve ter 14 dígitos.");
      return;
    }

    setSalvando(true);
    try {
      const response = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj: cnpjDigits, razaoSocial: razaoSocial || undefined }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErro(
          data.error === "cliente_ja_cadastrado" ? "Este CNPJ já está cadastrado neste escritório." : "Falha ao cadastrar cliente."
        );
        return;
      }

      setCnpj("");
      setRazaoSocial("");
      setModalAberto(false);
      await carregar();
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo(cliente: Cliente) {
    await fetch(`/api/clientes/${cliente.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !cliente.ativo }),
    });
    await carregar();
  }

  const clientesFiltrados = clientes.filter((c) => {
    const termo = filtro.toLowerCase();
    return c.cnpj.includes(termo) || (c.razao_social ?? "").toLowerCase().includes(termo);
  });

  return (
    <AppShell active="clientes" title="Clientes" subtitle="Empresas atendidas pelo seu escritório">
      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          placeholder="Buscar por CNPJ ou razão social..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-80 rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          onClick={() => setModalAberto(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Novo Cliente
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3">CNPJ</th>
              <th className="px-5 py-3">Razão Social</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Cadastrado em</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {carregando && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                  Carregando...
                </td>
              </tr>
            )}
            {!carregando && clientesFiltrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                  {clientes.length === 0 ? "Nenhum cliente cadastrado ainda." : "Nenhum cliente encontrado."}
                </td>
              </tr>
            )}
            {clientesFiltrados.map((cliente) => (
              <tr key={cliente.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-slate-700">{formatCnpj(cliente.cnpj)}</td>
                <td className="px-5 py-3 text-slate-800">{cliente.razao_social ?? "-"}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      cliente.ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {cliente.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500">{new Date(cliente.criado_em).toLocaleDateString("pt-BR")}</td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => toggleAtivo(cliente)} className="text-xs font-medium text-brand-600 hover:underline">
                    {cliente.ativo ? "Desativar" : "Reativar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Novo Cliente</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">CNPJ</label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Razão Social</label>
                <input
                  type="text"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="Opcional"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {erro && <p className="text-sm text-red-600">{erro}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
