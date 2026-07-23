"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

interface LoteResumo {
  id: string;
  status: string;
  quantidade_arquivos: number;
  quantidade_processados: number;
  quantidade_sucesso: number;
  quantidade_erro: number;
  criado_em: string;
  finalizado_em: string | null;
  expira_em: string;
}

interface LoteItem {
  id: string;
  nomeArquivoOriginal: string;
  nomeArquivoPadronizado: string | null;
  pasta: string | null;
  status: string;
  erroDetalhe: string | null;
  pdfUrl: string | null;
}

interface LoteExport {
  tipo: string;
  url: string | null;
}

interface LoteDetalhe {
  lote: LoteResumo;
  itens: LoteItem[];
  exports: LoteExport[];
}

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  processando: "Processando",
  concluido: "Concluído",
  concluido_com_erros: "Concluído com erros",
  falhou: "Falhou",
};

const EXPORT_LABEL: Record<string, string> = {
  xlsx: "Planilha (XLSX)",
  csv: "CSV",
  txt: "TXT",
  zip_consolidado: "ZIP consolidado (PDFs organizados + exports)",
};

export default function LotesPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [lotes, setLotes] = useState<LoteResumo[]>([]);
  const [loteSelecionadoId, setLoteSelecionadoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<LoteDetalhe | null>(null);

  const carregarLotes = useCallback(async () => {
    const response = await fetch("/api/lotes");
    if (!response.ok) return;
    const data = await response.json();
    setLotes(data.lotes ?? []);
  }, []);

  const carregarDetalhe = useCallback(async (id: string) => {
    const response = await fetch(`/api/lotes/${id}`);
    if (!response.ok) return;
    const data = await response.json();
    setDetalhe(data);
  }, []);

  useEffect(() => {
    carregarLotes();
  }, [carregarLotes]);

  // Polling: enquanto o lote selecionado está processando, cada GET também
  // avança o processamento (worker cooperativo) — ver src/lib/lote/service.ts.
  useEffect(() => {
    if (!loteSelecionadoId) return;
    carregarDetalhe(loteSelecionadoId);
    const intervalo = setInterval(() => {
      carregarDetalhe(loteSelecionadoId);
    }, 3000);
    return () => clearInterval(intervalo);
  }, [loteSelecionadoId, carregarDetalhe]);

  useEffect(() => {
    if (detalhe && (detalhe.lote.status === "concluido" || detalhe.lote.status === "concluido_com_erros" || detalhe.lote.status === "falhou")) {
      carregarLotes();
    }
  }, [detalhe, carregarLotes]);

  function selecionarArquivo(file: File | undefined) {
    if (!file) return;
    setErro(null);
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

    if (!arquivo) {
      setErro("Selecione um arquivo .zip com os XMLs.");
      return;
    }

    const formData = new FormData();
    formData.set("zip", arquivo);

    setEnviando(true);
    try {
      const response = await fetch("/api/lotes", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok) {
        setErro(data.error || "Falha ao processar o lote.");
        return;
      }

      setArquivo(null);
      setLoteSelecionadoId(data.loteId);
      await carregarLotes();
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-3">
            <Link href="/danfse" className="text-xs font-medium text-slate-500 hover:text-slate-700">
              Gerador unitário
            </Link>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              Central de Processamento Fiscal
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Processamento em Lote</h1>
        <p className="mt-1 text-sm text-slate-500">
          Envie um .zip com vários XMLs de NFS-e (opcionalmente com PDFs de referência homônimos para
          conferência) e receba os DANFSe organizados, exportações e um relatório consolidado.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Conveniência de dia a dia — não é custódia. Os arquivos deste lote ficam disponíveis por tempo
          limitado e depois são expurgados automaticamente.
        </p>

        <form onSubmit={handleSubmit} className="mt-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
              arrastando ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white hover:border-brand-400 hover:bg-slate-50"
            }`}
          >
            {arquivo ? (
              <p className="text-sm font-medium text-slate-900">{arquivo.name}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-700">Arraste o .zip aqui ou clique para selecionar</p>
                <p className="mt-1 text-xs text-slate-400">Apenas arquivos .zip contendo XMLs (e PDFs opcionais)</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => selecionarArquivo(e.target.files?.[0])}
            />
          </div>

          <button
            type="submit"
            disabled={enviando || !arquivo}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? "Enviando lote..." : "Processar Lote"}
          </button>
        </form>

        {erro && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>
        )}

        {detalhe && (
          <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Lote #{detalhe.lote.id.slice(0, 8)}</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {STATUS_LABEL[detalhe.lote.status] ?? detalhe.lote.status}
              </span>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{
                  width: `${
                    detalhe.lote.quantidade_arquivos
                      ? Math.round((detalhe.lote.quantidade_processados / detalhe.lote.quantidade_arquivos) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {detalhe.lote.quantidade_processados} de {detalhe.lote.quantidade_arquivos} processados —{" "}
              {detalhe.lote.quantidade_sucesso} com sucesso, {detalhe.lote.quantidade_erro} com erro
            </p>

            {detalhe.exports.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {detalhe.exports.map((exp) =>
                  exp.url ? (
                    <a
                      key={exp.tipo}
                      href={exp.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      {EXPORT_LABEL[exp.tipo] ?? exp.tipo}
                    </a>
                  ) : null
                )}
              </div>
            )}

            <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
              {detalhe.itens.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{item.nomeArquivoOriginal}</p>
                    {item.erroDetalhe && <p className="truncate text-xs text-red-600">{item.erroDetalhe}</p>}
                    {item.pasta && item.nomeArquivoPadronizado && (
                      <p className="truncate text-xs text-slate-400">
                        {item.pasta}/{item.nomeArquivoPadronizado}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.status === "processado"
                          ? "bg-emerald-100 text-emerald-700"
                          : item.status === "erro"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.status}
                    </span>
                    {item.pdfUrl && (
                      <a href={item.pdfUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-600 hover:underline">
                        PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-sm font-semibold text-slate-900">Histórico de lotes</h2>
          <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {lotes.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">Nenhum lote enviado ainda.</p>}
            {lotes.map((lote) => (
              <button
                key={lote.id}
                onClick={() => setLoteSelecionadoId(lote.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-800">Lote #{lote.id.slice(0, 8)}</p>
                  <p className="text-xs text-slate-400">{new Date(lote.criado_em).toLocaleString("pt-BR")}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {STATUS_LABEL[lote.status] ?? lote.status}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
