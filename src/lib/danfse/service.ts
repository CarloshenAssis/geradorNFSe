import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseNfseXml, XmlParseError } from "@/lib/nfse/parser";
import { validateNfse, NfseValidationError } from "@/lib/nfse/schema";
import { renderDanfseHtml } from "@/lib/pdf/template";
import { gerarQrCodeConsulta } from "@/lib/pdf/qrcode";
import { renderHtmlToPdf, PdfRenderError } from "@/lib/pdf/render";
import { buildDanfsePath, uploadXml, uploadPdf, createSignedUrl } from "@/lib/storage/danfse-storage";
import { sanitizarSegmento } from "@/lib/lote/organizer";
import { env } from "@/lib/env";
import type { SessionContext } from "@/lib/auth/context";
import type { NfseParsed } from "@/lib/nfse/schema";

/** Nome de download amigável: número da NFS-e + nome do prestador (ex: "202600001234_EMPRESA_LTDA.pdf"). */
function nomeArquivoDanfse(nfse: NfseParsed): string {
  const infNFSe = nfse.NFSe.infNFSe;
  const numero = sanitizarSegmento(infNFSe.nNFSe || "SN");
  const prestador = sanitizarSegmento(infNFSe.DPS.infDPS.prest.xNome || "PRESTADOR");
  return `${numero}_${prestador}.pdf`;
}

export class DanfseError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export interface GerarDanfseResult {
  generationId: string;
  signedUrl: string;
}

/**
 * Fluxo completo de geração de DANFSe (item 1.3 do MD):
 * validar XML → debitar crédito atomicamente → renderizar PDF →
 * armazenar com signed URL → auditar. Nunca gera PDF sem debitar,
 * nem debita sem gerar — se o render falhar depois do débito, o
 * registro fica marcado como 'erro' (rastreável), sem estorno automático.
 */
export async function gerarDanfse(
  ctx: SessionContext,
  xmlBuffer: Buffer,
  clienteId: string | null
): Promise<GerarDanfseResult> {
  if (xmlBuffer.byteLength === 0) {
    throw new DanfseError("arquivo_xml_vazio", 400);
  }
  if (xmlBuffer.byteLength > env.danfseMaxXmlSizeBytes) {
    throw new DanfseError("arquivo_xml_excede_tamanho_maximo", 413);
  }

  const xml = xmlBuffer.toString("utf-8");

  let raw: unknown;
  try {
    raw = parseNfseXml(xml);
  } catch (err) {
    if (err instanceof XmlParseError) throw new DanfseError(err.message, 400);
    throw err;
  }

  let nfse;
  try {
    nfse = validateNfse(raw);
  } catch (err) {
    if (err instanceof NfseValidationError) throw new DanfseError(err.message, 422);
    throw err;
  }

  const supabase = await createSupabaseServerClient();
  const generationId = randomUUID();
  const xmlPath = buildDanfsePath(ctx.escritorioId, generationId, "input.xml");
  const pdfPath = buildDanfsePath(ctx.escritorioId, generationId, "output.pdf");

  const { data: generation, error: rpcError } = await supabase.rpc("consume_credit_and_start_generation", {
    p_generation_id: generationId,
    p_cliente_id: clienteId,
    p_xml_storage_ref: xmlPath,
  });

  if (rpcError || !generation) {
    const message = rpcError?.message ?? "";
    if (message.includes("saldo_insuficiente")) {
      throw new DanfseError("saldo_de_creditos_insuficiente", 402);
    }
    if (message.includes("cliente_fora_do_escritorio")) {
      throw new DanfseError("cliente_invalido", 400);
    }
    throw new DanfseError(message || "falha_ao_iniciar_geracao", 500);
  }

  try {
    await uploadXml(xmlPath, xml);

    const qrCodeDataUrl = await gerarQrCodeConsulta(nfse.NFSe.infNFSe.chaveAcesso);
    const html = renderDanfseHtml({ nfse, qrCodeDataUrl });
    const pdf = await renderHtmlToPdf(html);

    await uploadPdf(pdfPath, pdf);
    await supabase.rpc("complete_generation", { p_generation_id: generationId, p_pdf_storage_ref: pdfPath });

    const signedUrl = await createSignedUrl(pdfPath, nomeArquivoDanfse(nfse));

    return { generationId, signedUrl };
  } catch (err) {
    const detalhe = err instanceof Error ? `${err.name}: ${err.message}` : "erro_desconhecido";
    await supabase.rpc("fail_generation", { p_generation_id: generationId, p_erro_detalhe: detalhe });

    if (err instanceof PdfRenderError) {
      throw new DanfseError(err.message, 500);
    }
    // Propaga a causa real (upload, RPC, QR Code, etc.) em vez de mascarar
    // com uma mensagem genérica — facilita diagnosticar sem depender dos
    // logs de runtime da Vercel.
    throw new DanfseError(`falha_ao_gerar_danfse: ${detalhe}`, 500);
  }
}
