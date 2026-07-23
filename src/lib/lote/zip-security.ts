import "server-only";
import JSZip from "jszip";
import { env } from "@/lib/env";

/**
 * Guardrails de segurança para upload de ZIP (item 2.1 do MD complementar):
 * zip bomb, zip slip / path traversal, validação de tipo real, limite de
 * quantidade de arquivos. Nunca extrair sem checar isso antes.
 */
export class ZipSecurityError extends Error {}

export interface ArquivoExtraido {
  /** Nome de arquivo já normalizado e confinado (nunca o path bruto do ZIP). */
  nome: string;
  conteudo: Buffer;
}

/** Path traversal / zip slip: rejeita qualquer entrada que escape do diretório do lote. */
function normalizarNomeSeguro(rawPath: string): string {
  const semBarraInicial = rawPath.replace(/^\/+/, "");
  const partes = semBarraInicial.split("/").filter((p) => p.length > 0 && p !== ".");

  if (partes.some((p) => p === "..")) {
    throw new ZipSecurityError(`path_traversal_detectado: ${rawPath}`);
  }
  if (partes.length === 0) {
    throw new ZipSecurityError(`nome_de_arquivo_invalido: ${rawPath}`);
  }

  // Só o nome final importa para o lote (pasta original do ZIP é ignorada,
  // a organização de pasta de saída é responsabilidade do organizer.ts).
  return partes[partes.length - 1] as string;
}

/** Sniff de tipo real por assinatura de bytes/heurística de conteúdo — nunca confiar só na extensão. */
function pareceXml(conteudo: Buffer): boolean {
  const inicio = conteudo.subarray(0, 512).toString("utf-8").trimStart();
  return inicio.startsWith("<?xml") || inicio.startsWith("<");
}

function pareceePdf(conteudo: Buffer): boolean {
  return conteudo.subarray(0, 5).toString("latin1") === "%PDF-";
}

/** Nome sem extensão, em minúsculas — chave usada para casar XML com o PDF de referência homônimo. */
function chaveBase(nome: string): string {
  return nome.toLowerCase().replace(/\.[^.]+$/, "");
}

export interface ExtracaoResult {
  arquivos: ArquivoExtraido[];
  /** PDFs de referência enviados junto (mesmo nome-base do XML), para a conferência XML×PDF. */
  pdfsReferencia: Map<string, ArquivoExtraido>;
  ignorados: Array<{ nome: string; motivo: string }>;
}

/**
 * Extrai um ZIP com guardrails completos. Aborta o lote inteiro (exceção)
 * apenas em caso de abuso estrutural (zip bomb, path traversal, excesso de
 * arquivos) — arquivos individuais que não parecem XML são apenas
 * ignorados (vão para `ignorados`), não derrubam o lote.
 */
export async function extrairZipComGuardrails(zipBuffer: Buffer): Promise<ExtracaoResult> {
  if (zipBuffer.byteLength > env.loteMaxZipBytes) {
    throw new ZipSecurityError("arquivo_zip_excede_tamanho_maximo");
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch (err) {
    throw new ZipSecurityError(`zip_invalido_ou_corrompido: ${(err as Error).message}`);
  }

  const entradas = Object.values(zip.files).filter((f) => !f.dir);

  if (entradas.length === 0) {
    throw new ZipSecurityError("zip_vazio");
  }
  if (entradas.length > env.loteMaxArquivos) {
    throw new ZipSecurityError(
      `zip_excede_limite_de_arquivos: ${entradas.length} > ${env.loteMaxArquivos}`
    );
  }

  // Checagem de zip bomb usando o tamanho descomprimido declarado no
  // central directory (metadado do próprio ZIP), antes de descomprimir
  // qualquer byte.
  const tamanhoDeclaradoTotal = entradas.reduce((soma, f) => {
    const declarado = (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    return soma + declarado;
  }, 0);

  if (tamanhoDeclaradoTotal > env.loteMaxDescompactadoBytes) {
    throw new ZipSecurityError(
      `zip_bomb_suspeita: tamanho_descomprimido_declarado_excede_limite (${tamanhoDeclaradoTotal} bytes)`
    );
  }

  const arquivos: ArquivoExtraido[] = [];
  const pdfsReferencia = new Map<string, ArquivoExtraido>();
  const ignorados: Array<{ nome: string; motivo: string }> = [];
  let tamanhoRealAcumulado = 0;

  for (const entrada of entradas) {
    const nome = normalizarNomeSeguro(entrada.name);

    const conteudo = await entrada.async("nodebuffer");

    // Defesa em profundidade: reconfere o tamanho real após descomprimir
    // (o metadado declarado pode ser inconsistente em ZIPs adulterados).
    tamanhoRealAcumulado += conteudo.byteLength;
    if (tamanhoRealAcumulado > env.loteMaxDescompactadoBytes) {
      throw new ZipSecurityError("zip_bomb_suspeita: tamanho_descomprimido_real_excede_limite");
    }

    const nomeLower = nome.toLowerCase();

    if (nomeLower.endsWith(".pdf")) {
      if (pareceePdf(conteudo)) {
        pdfsReferencia.set(chaveBase(nome), { nome, conteudo });
      } else {
        ignorados.push({ nome, motivo: "conteudo_nao_parece_pdf" });
      }
      continue;
    }

    if (!nomeLower.endsWith(".xml")) {
      ignorados.push({ nome, motivo: "extensao_nao_suportada" });
      continue;
    }
    if (!pareceXml(conteudo)) {
      ignorados.push({ nome, motivo: "conteudo_nao_parece_xml" });
      continue;
    }

    arquivos.push({ nome, conteudo });
  }

  if (arquivos.length === 0) {
    throw new ZipSecurityError("nenhum_xml_valido_encontrado_no_zip");
  }

  return { arquivos, pdfsReferencia, ignorados };
}
