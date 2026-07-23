import "server-only";
import { env } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Storage privado com signed URL de TTL curto (item 1.5 / 2.3 do MD).
 * Path sempre prefixado por escritorio_id.
 *
 * Todas as operações usam o client service_role (não o SSR do usuário): a
 * geração de DANFSe é server-side, o isolamento de tenant é garantido pelo
 * prefixo {escritorio_id} no path (validado a partir da sessão autenticada
 * antes de chegar aqui), e o acesso do usuário é sempre via signed URL
 * gerada no servidor. Isso evita qualquer fragilidade do client SSR ao
 * fazer upload em runtime serverless (resposta HTML -> erro de JSON).
 */

function storage() {
  return createSupabaseServiceClient().storage.from(env.danfseStorageBucket);
}

export function buildDanfsePath(escritorioId: string, generationId: string, filename: "input.xml" | "output.pdf"): string {
  return `${escritorioId}/${generationId}/${filename}`;
}

export async function uploadXml(path: string, xml: string): Promise<void> {
  const { error } = await storage().upload(path, new Blob([xml], { type: "application/xml" }), {
    contentType: "application/xml",
    upsert: true,
  });
  if (error) throw new Error(`upload_xml_falhou [path=${path}]: ${error.message}`);
}

export async function uploadPdf(path: string, pdf: Buffer): Promise<void> {
  const { error } = await storage().upload(path, new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) throw new Error(`upload_pdf_falhou [path=${path}]: ${error.message}`);
}

/**
 * `downloadFilename`: nome sugerido para o download (via Content-Disposition
 * do Supabase Storage) — sem isso o navegador usa o último segmento do path
 * de storage ("output.pdf"), que não identifica a nota nenhuma.
 */
export async function createSignedUrl(path: string, downloadFilename?: string): Promise<string> {
  const { data, error } = await storage().createSignedUrl(
    path,
    env.danfseSignedUrlTtlSeconds,
    downloadFilename ? { download: downloadFilename } : undefined
  );
  if (error || !data) throw error ?? new Error("falha_ao_gerar_signed_url");
  return data.signedUrl;
}
