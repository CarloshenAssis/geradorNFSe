import "server-only";
import { PDFParse } from "pdf-parse";
import type { NfseParsed } from "@/lib/nfse/schema";
import { formatMoeda } from "@/lib/nfse/sanitize";

/**
 * Conferência XML×PDF (item 1.4 do MD complementar): o XML é sempre a
 * fonte de verdade. Extrair dados de um PDF é não-determinístico — parsing
 * de texto varia por template de DANFSe — então tratamos qualquer falha de
 * extração como "não foi possível conferir" (nao_verificavel), nunca como
 * divergência. Isso evita falso-positivo, que é o que mais corroeria a
 * confiança no produto.
 */

export interface DivergenciaCampo {
  campo: string;
  valorXml: string | null;
  valorPdf: string | null;
  status: "compativel" | "divergente" | "nao_verificavel";
}

/** Extrai o texto do PDF de referência enviado pelo usuário; null se falhar. */
async function extrairTextoPdf(pdfBuffer: Buffer): Promise<string | null> {
  try {
    const parser = new PDFParse({ data: pdfBuffer });
    const resultado = await parser.getText();
    await parser.destroy();
    return resultado.text;
  } catch {
    return null;
  }
}

function normalizarMoeda(valor: string): string {
  return valor.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3},)/g, "");
}

/** Busca um valor monetário logo após um rótulo conhecido no texto extraído (posição, não regex genérica). */
function buscarValorAposRotulo(texto: string, rotulos: string[]): string | null {
  for (const rotulo of rotulos) {
    const idx = texto.toUpperCase().indexOf(rotulo.toUpperCase());
    if (idx === -1) continue;
    const trecho = texto.slice(idx + rotulo.length, idx + rotulo.length + 60);
    const match = trecho.match(/R?\$?\s*([\d.,]+)/);
    if (match?.[1]) return normalizarMoeda(match[1]);
  }
  return null;
}

function buscarChaveAcesso(texto: string): string | null {
  const match = texto.match(/\b\d{44,46}\b/);
  return match ? match[0] : null;
}

function comparaValor(campo: string, valorXml: number | undefined, valorPdfBruto: string | null): DivergenciaCampo {
  if (valorXml === undefined) {
    return { campo, valorXml: null, valorPdf: valorPdfBruto, status: "nao_verificavel" };
  }
  if (valorPdfBruto === null) {
    return { campo, valorXml: formatMoeda(valorXml), valorPdf: null, status: "nao_verificavel" };
  }

  const pdfNumerico = Number(valorPdfBruto.replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(pdfNumerico)) {
    return { campo, valorXml: formatMoeda(valorXml), valorPdf: valorPdfBruto, status: "nao_verificavel" };
  }

  const compativel = Math.abs(pdfNumerico - valorXml) < 0.01;
  return {
    campo,
    valorXml: formatMoeda(valorXml),
    valorPdf: valorPdfBruto,
    status: compativel ? "compativel" : "divergente",
  };
}

function comparaTexto(campo: string, valorXml: string | undefined, valorPdf: string | null): DivergenciaCampo {
  if (!valorXml || !valorPdf) {
    return { campo, valorXml: valorXml ?? null, valorPdf, status: "nao_verificavel" };
  }
  const normaliza = (s: string) => s.trim().toUpperCase();
  return {
    campo,
    valorXml,
    valorPdf,
    status: normaliza(valorXml) === normaliza(valorPdf) ? "compativel" : "divergente",
  };
}

/**
 * Compara os campos principais (valor total, ISSQN, IBS, CBS, município,
 * chave de acesso) entre o XML oficial e o texto extraído do PDF de
 * referência enviado pelo usuário. Falha total de extração (PDF
 * ilegível/escaneado) resulta em todos os campos "nao_verificavel".
 */
export async function conferirXmlXPdf(nfse: NfseParsed, pdfBuffer: Buffer): Promise<DivergenciaCampo[]> {
  const infNFSe = nfse.NFSe.infNFSe;
  const infDPS = infNFSe.DPS.infDPS;
  const trib = infDPS.valores.trib;
  const g = trib?.IBSCBS?.gIBSCBS;
  const vIBS = (g?.gIBSUF?.vIBSUF ?? 0) + (g?.gIBSMun?.vIBSMun ?? 0);
  const vCBS = g?.gCBS?.vCBS;

  const texto = await extrairTextoPdf(pdfBuffer);
  if (texto === null) {
    return [
      { campo: "valor_total", valorXml: formatMoeda(infNFSe.valores.vLiq), valorPdf: null, status: "nao_verificavel" },
      { campo: "issqn", valorXml: formatMoeda(infNFSe.valores.vISSQN), valorPdf: null, status: "nao_verificavel" },
      { campo: "ibs", valorXml: vIBS ? formatMoeda(vIBS) : null, valorPdf: null, status: "nao_verificavel" },
      { campo: "cbs", valorXml: vCBS !== undefined ? formatMoeda(vCBS) : null, valorPdf: null, status: "nao_verificavel" },
      { campo: "municipio", valorXml: infNFSe.xLocPrestacao, valorPdf: null, status: "nao_verificavel" },
      { campo: "chave_acesso", valorXml: infNFSe.chaveAcesso, valorPdf: null, status: "nao_verificavel" },
    ];
  }

  const valorTotalPdf = buscarValorAposRotulo(texto, ["VALOR LÍQUIDO DA NFS-E", "VALOR LIQUIDO DA NFS-E"]);
  const issqnPdf = buscarValorAposRotulo(texto, ["ISSQN APURADO"]);
  const ibsPdf = buscarValorAposRotulo(texto, ["VALOR TOTAL APURADO - IBS"]);
  const cbsPdf = buscarValorAposRotulo(texto, ["VALOR TOTAL APURADO - CBS"]);
  const chavePdf = buscarChaveAcesso(texto);
  const municipioPdf = texto.includes(infNFSe.xLocPrestacao) ? infNFSe.xLocPrestacao : null;

  return [
    comparaValor("valor_total", infNFSe.valores.vLiq, valorTotalPdf),
    comparaValor("issqn", infNFSe.valores.vISSQN, issqnPdf),
    vIBS ? comparaValor("ibs", vIBS, ibsPdf) : { campo: "ibs", valorXml: null, valorPdf: ibsPdf, status: "nao_verificavel" },
    vCBS !== undefined
      ? comparaValor("cbs", vCBS, cbsPdf)
      : { campo: "cbs", valorXml: null, valorPdf: cbsPdf, status: "nao_verificavel" },
    comparaTexto("municipio", infNFSe.xLocPrestacao, municipioPdf),
    comparaTexto("chave_acesso", infNFSe.chaveAcesso, chavePdf),
  ];
}
