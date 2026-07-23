import "server-only";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { formatMoeda, escapeHtml } from "@/lib/nfse/sanitize";
import { renderHtmlToPdf } from "@/lib/pdf/render";

export interface LinhaExport {
  nomeArquivoOriginal: string;
  nomeArquivoPadronizado: string | null;
  pasta: string | null;
  status: "processado" | "erro";
  erroDetalhe: string | null;
  prestador: string | null;
  numeroNfse: string | null;
  competencia: string | null;
  valorServico: number | null;
  valorIssqn: number | null;
  valorIbs: number | null;
  valorCbs: number | null;
  valorLiquido: number | null;
  chaveAcesso: string | null;
}

const COLUNAS: Array<{ chave: keyof LinhaExport; titulo: string }> = [
  { chave: "nomeArquivoOriginal", titulo: "Arquivo Original" },
  { chave: "nomeArquivoPadronizado", titulo: "Arquivo Padronizado" },
  { chave: "pasta", titulo: "Pasta" },
  { chave: "status", titulo: "Status" },
  { chave: "erroDetalhe", titulo: "Erro" },
  { chave: "prestador", titulo: "Prestador" },
  { chave: "numeroNfse", titulo: "Número NFS-e" },
  { chave: "competencia", titulo: "Competência" },
  { chave: "valorServico", titulo: "Valor Serviço" },
  { chave: "valorIssqn", titulo: "ISSQN" },
  { chave: "valorIbs", titulo: "IBS" },
  { chave: "valorCbs", titulo: "CBS" },
  { chave: "valorLiquido", titulo: "Valor Líquido" },
  { chave: "chaveAcesso", titulo: "Chave de Acesso" },
];

function celula(valor: LinhaExport[keyof LinhaExport]): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") return formatMoeda(valor);
  return String(valor);
}

export async function gerarXlsx(linhas: LinhaExport[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Lote");
  sheet.addRow(COLUNAS.map((c) => c.titulo));
  sheet.getRow(1).font = { bold: true };
  for (const linha of linhas) {
    sheet.addRow(COLUNAS.map((c) => celula(linha[c.chave])));
  }
  sheet.columns.forEach((col) => {
    col.width = 22;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function csvEscape(valor: string): string {
  if (/[";\n]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

export function gerarCsv(linhas: LinhaExport[]): Buffer {
  const cabecalho = COLUNAS.map((c) => csvEscape(c.titulo)).join(";");
  const corpo = linhas
    .map((linha) => COLUNAS.map((c) => csvEscape(celula(linha[c.chave]))).join(";"))
    .join("\n");
  return Buffer.from(`${cabecalho}\n${corpo}\n`, "utf-8");
}

export function gerarTxt(linhas: LinhaExport[]): Buffer {
  const blocos = linhas.map((linha) =>
    COLUNAS.map((c) => `${c.titulo}: ${celula(linha[c.chave]) || "-"}`).join("\n")
  );
  return Buffer.from(blocos.join("\n\n" + "-".repeat(40) + "\n\n") + "\n", "utf-8");
}

export interface ArquivoParaZip {
  path: string;
  conteudo: Buffer;
}

/** Monta o ZIP consolidado final: PDFs organizados por pasta + exports + relatório. */
export async function gerarZipConsolidado(arquivos: ArquivoParaZip[]): Promise<Buffer> {
  const zip = new JSZip();
  for (const arquivo of arquivos) {
    zip.file(arquivo.path, arquivo.conteudo);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export interface ResumoConsolidado {
  quantidadeNotas: number;
  quantidadeSucesso: number;
  quantidadeErro: number;
  valorTotalServicos: number;
  valorTotalIssqn: number;
  valorTotalIbs: number;
  valorTotalCbs: number;
}

export function calcularResumo(linhas: LinhaExport[]): ResumoConsolidado {
  const sucesso = linhas.filter((l) => l.status === "processado");
  return {
    quantidadeNotas: linhas.length,
    quantidadeSucesso: sucesso.length,
    quantidadeErro: linhas.length - sucesso.length,
    valorTotalServicos: sucesso.reduce((s, l) => s + (l.valorServico ?? 0), 0),
    valorTotalIssqn: sucesso.reduce((s, l) => s + (l.valorIssqn ?? 0), 0),
    valorTotalIbs: sucesso.reduce((s, l) => s + (l.valorIbs ?? 0), 0),
    valorTotalCbs: sucesso.reduce((s, l) => s + (l.valorCbs ?? 0), 0),
  };
}

function relatorioHtml(resumo: ResumoConsolidado, linhas: LinhaExport[]): string {
  const linhasHtml = linhas
    .map(
      (l) => `<tr>
        <td>${escapeHtml(l.nomeArquivoOriginal)}</td>
        <td>${escapeHtml(l.prestador ?? "-")}</td>
        <td>${escapeHtml(l.numeroNfse ?? "-")}</td>
        <td>${l.status === "processado" ? "OK" : "Erro"}</td>
        <td style="text-align:right">${l.valorLiquido !== null ? `R$ ${formatMoeda(l.valorLiquido)}` : "-"}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" /><style>
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; margin: 16pt; }
  h1 { font-size: 14pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 12pt; }
  th, td { border: 0.5pt solid #ccc; padding: 4pt 6pt; font-size: 8pt; text-align: left; }
  th { background: #f2f2f2; }
  .resumo { display: flex; gap: 16pt; margin-top: 8pt; }
  .resumo div { border: 0.5pt solid #ccc; padding: 6pt 10pt; border-radius: 4pt; }
</style></head>
<body>
  <h1>Relatório Consolidado do Lote</h1>
  <div class="resumo">
    <div>Notas: <b>${resumo.quantidadeNotas}</b></div>
    <div>Sucesso: <b>${resumo.quantidadeSucesso}</b></div>
    <div>Erros: <b>${resumo.quantidadeErro}</b></div>
    <div>Serviços: <b>R$ ${formatMoeda(resumo.valorTotalServicos)}</b></div>
    <div>ISSQN: <b>R$ ${formatMoeda(resumo.valorTotalIssqn)}</b></div>
    <div>IBS: <b>R$ ${formatMoeda(resumo.valorTotalIbs)}</b></div>
    <div>CBS: <b>R$ ${formatMoeda(resumo.valorTotalCbs)}</b></div>
  </div>
  <table>
    <thead><tr><th>Arquivo</th><th>Prestador</th><th>Nº NFS-e</th><th>Status</th><th>Valor Líquido</th></tr></thead>
    <tbody>${linhasHtml}</tbody>
  </table>
</body></html>`;
}

export async function gerarRelatorioPdf(resumo: ResumoConsolidado, linhas: LinhaExport[]): Promise<Buffer> {
  return renderHtmlToPdf(relatorioHtml(resumo, linhas));
}
