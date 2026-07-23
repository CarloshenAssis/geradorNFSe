import "server-only";
import { env } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Storage do módulo de lote (item 3.2 do MD complementar): bucket privado
 * próprio (`lotes-files`), nunca junto com os arquivos avulsos do gerador
 * unitário — facilita o expurgo dentro do prazo curto de retenção (2.3).
 *   lotes-files/{escritorio_id}/{lote_id}/origem.zip
 *   lotes-files/{escritorio_id}/{lote_id}/itens/{lote_item_id}/input.xml
 *   lotes-files/{escritorio_id}/{lote_id}/itens/{lote_item_id}/danfse.pdf
 *   lotes-files/{escritorio_id}/{lote_id}/itens/{lote_item_id}/referencia.pdf
 *   lotes-files/{escritorio_id}/{lote_id}/exports/{arquivo}
 *
 * Todas as operações de storage usam o client service_role (não o client
 * SSR do usuário): o processamento de lote é server-side/background (o job
 * de cron de retomada nem tem sessão de usuário para usar), e o isolamento
 * de tenant é garantido pelo prefixo {escritorio_id} no path — validado a
 * partir da sessão autenticada antes de chegar aqui. Isso evita qualquer
 * fragilidade do client SSR ao fazer upload em runtime serverless.
 */

function storage() {
  return createSupabaseServiceClient().storage.from(env.loteStorageBucket);
}

export function buildOrigemPath(escritorioId: string, loteId: string): string {
  return `${escritorioId}/${loteId}/origem.zip`;
}

export function buildItemPath(
  escritorioId: string,
  loteId: string,
  itemId: string,
  filename: "input.xml" | "danfse.pdf" | "referencia.pdf"
): string {
  return `${escritorioId}/${loteId}/itens/${itemId}/${filename}`;
}

export function buildExportPath(escritorioId: string, loteId: string, filename: string): string {
  return `${escritorioId}/${loteId}/exports/${filename}`;
}

export async function uploadLoteArquivo(path: string, conteudo: Buffer | Blob, contentType: string): Promise<void> {
  const corpo = conteudo instanceof Blob ? conteudo : new Blob([new Uint8Array(conteudo)], { type: contentType });
  try {
    const { error } = await storage().upload(path, corpo, { contentType, upsert: true });
    if (error) throw error;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`upload_storage_falhou [bucket=${env.loteStorageBucket} path=${path}]: ${msg}`);
  }
}

export async function createLoteSignedUrl(path: string): Promise<string> {
  const { data, error } = await storage().createSignedUrl(path, env.loteSignedUrlTtlSeconds);
  if (error || !data) throw error ?? new Error("falha_ao_gerar_signed_url");
  return data.signedUrl;
}

export async function downloadLoteArquivo(path: string): Promise<Buffer> {
  const { data, error } = await storage().download(path);
  if (error || !data) throw error ?? new Error("falha_ao_baixar_arquivo_do_lote");
  return Buffer.from(await data.arrayBuffer());
}
