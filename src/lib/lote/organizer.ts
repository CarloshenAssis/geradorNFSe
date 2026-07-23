import type { NfseParsed } from "@/lib/nfse/schema";

/**
 * Organizador (item 1.3 do MD complementar): conveniência de dia a dia,
 * NÃO custódia — só mapeamento puro de nome/pasta a partir dos campos já
 * extraídos do XML, sem I/O. O ciclo de vida desses arquivos termina
 * quando o usuário baixa o ZIP de saída (ver política de retenção curta).
 */

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function sanitizarSegmento(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (após normalize NFD)
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "SEM_NOME";
}

export interface InfoOrganizacao {
  /** Nome de arquivo padronizado, sem extensão. */
  nomeBase: string;
  /** Caminho de pasta dentro do ZIP de saída (sem barra inicial/final). */
  pasta: string;
}

/**
 * Deriva nome padronizado (`2026-07_NF_12345_EMPRESA_ABC`) e pasta
 * (`2026/Julho/EMPRESA_ABC/`) a partir da competência, número da NFS-e e
 * prestador. Usa o prestador (não o tomador) como "cliente" de referência
 * do escritório de contabilidade — é quem contratou o serviço de geração.
 */
export function derivarOrganizacao(nfse: NfseParsed): InfoOrganizacao {
  const infNFSe = nfse.NFSe.infNFSe;
  const infDPS = infNFSe.DPS.infDPS;

  const competencia = infDPS.dCompet ? new Date(infDPS.dCompet) : null;
  const ano = competencia && !Number.isNaN(competencia.getTime()) ? competencia.getFullYear() : new Date().getFullYear();
  const mesIndex = competencia && !Number.isNaN(competencia.getTime()) ? competencia.getMonth() : new Date().getMonth();
  const mesNumero = String(mesIndex + 1).padStart(2, "0");
  const mesNome = MESES[mesIndex];

  const numeroNota = sanitizarSegmento(infNFSe.nNFSe || "SN");
  const nomePrestador = sanitizarSegmento(infDPS.prest.xNome || "PRESTADOR");

  const nomeBase = `${ano}-${mesNumero}_NF_${numeroNota}_${nomePrestador}`;
  const pasta = `${ano}/${mesNome}/${nomePrestador}`;

  return { nomeBase, pasta };
}
