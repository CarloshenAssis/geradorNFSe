"use client";

import { useRef, useState, type FormEvent } from "react";

interface ResultadoGeracao {
  generationId: string;
  signedUrl: string;
}

export default function DanfsePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoGeracao | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setResultado(null);

    const file = inputRef.current?.files?.[0];
    if (!file) {
      setErro("Selecione um arquivo XML.");
      return;
    }

    const formData = new FormData();
    formData.set("xml", file);

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
    <main style={{ maxWidth: 480, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>Gerador de DANFSe</h1>
      <p>Envie o XML da NFS-e (layout NT 008/2026) para gerar o PDF.</p>

      <form onSubmit={handleSubmit}>
        <input ref={inputRef} type="file" accept=".xml,text/xml,application/xml" />
        <button type="submit" disabled={carregando} style={{ marginLeft: 12 }}>
          {carregando ? "Gerando..." : "Gerar DANFSe"}
        </button>
      </form>

      {erro && <p style={{ color: "crimson" }}>{erro}</p>}

      {resultado && (
        <p>
          Geração concluída (#{resultado.generationId}).{" "}
          <a href={resultado.signedUrl} target="_blank" rel="noreferrer">
            Baixar PDF
          </a>{" "}
          — o link expira em poucos minutos.
        </p>
      )}
    </main>
  );
}
