"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";

interface ResultadoGeracao {
  generationId: string;
  signedUrl: string;
}

interface ClienteOpcao {
  id: string;
  cnpj: string;
  razao_social: string | null;
}

export default function DanfsePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoGeracao | null>(null);
  const [clientes, setClientes] = useState<ClienteOpcao[]>([]);
  const [clienteId, setClienteId] = useState("");

  useEffect(() => {
    fetch("/api/clientes")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setClientes(data?.clientes ?? []))
      .catch(() => null);
  }, []);

  function selecionarArquivo(file: File | undefined) {
    if (!file) return;
    setErro(null);
    setResultado(null);
    setArquivo(file);
  }

  const onDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setArrastando(false);
    selecionarArquivo(event.dataTransfer.files?.[0]);
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setResultado(null);

    if (!arquivo) {
      setErro("Selecione um arquivo XML.");
      return;
    }

    const formData = new FormData();
    formData.set("xml", arquivo);
    if (clienteId) formData.set("clienteId", clienteId);

    setCarregando(true);
    try {
      const response = await fetch("/api/danfse", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok) {
        setErro(data.error || "Falha ao gerar o DANFSe.");
        return;
      }

      setResultado(data);
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <AppShell active="danfse" title="Gerador de DANFSe" subtitle="Documento auxiliar unitário a partir de um XML de NFS-e">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-slate-500">Envie o XML da NFS-e (layout NT 008/2026) para gerar o PDF do documento auxiliar.</p>

        <form onSubmit={handleSubmit} className="mt-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
              arrastando
                ? "border-brand-500 bg-brand-50"
                : "border-slate-300 bg-white hover:border-brand-400 hover:bg-slate-50"
            }`}
          >
            <svg
              className="h-10 w-10 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
              />
            </svg>

            {arquivo ? (
              <p className="mt-3 text-sm font-medium text-slate-900">{arquivo.name}</p>
            ) : (
              <>
                <p className="mt-3 text-sm font-medium text-slate-700">
                  Arraste o XML aqui ou clique para selecionar
                </p>
                <p className="mt-1 text-xs text-slate-400">Apenas arquivos .xml</p>
              </>
            )}

            <input
              ref={inputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={(e) => selecionarArquivo(e.target.files?.[0])}
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700">Cliente (opcional)</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Uso avulso (sem associar a um cliente)</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razao_social ?? c.cnpj}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={carregando || !arquivo}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {carregando && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {carregando ? "Gerando DANFSe..." : "Gerar DANFSe"}
          </button>
        </form>

        {erro && (
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.28 11.18c.75 1.334-.213 2.98-1.742 2.98H3.72c-1.53 0-2.492-1.646-1.743-2.98l6.28-11.18zM11 14a1 1 0 11-2 0 1 1 0 012 0zm-.25-6.5a.75.75 0 00-1.5 0v3a.75.75 0 001.5 0v-3z"
                clipRule="evenodd"
              />
            </svg>
            <span>{erro}</span>
          </div>
        )}

        {resultado && (
          <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-medium">DANFSe gerado com sucesso</p>
              <p className="mt-0.5 text-emerald-700/80">Geração #{resultado.generationId}</p>
              <a
                href={resultado.signedUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
              >
                Baixar PDF
              </a>
              <p className="mt-1 text-xs text-emerald-700/70">O link expira em poucos minutos.</p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
