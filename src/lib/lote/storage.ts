import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Storage do módulo de lote (item 3.2 do MD complementar): bucket privado
 * próprio (`lotes-files`), nunca junto com os arquivos avulsos do gerador
 * unitário — facilita o expurgo dentro do prazo curto de retenção (2.3).
 *   lotes-files/{escritorio_id}/{lote_id}/origem.zip
 *   lotes-files/{escritorio_id}/{lote_id}/itens/{lote_item_id}/input.xml
 *   lotes-files/{escritorio_id}/{lote_id}/itens/{lote_item_id}/danfse.pdf
 *   lotes-files/{escritorio_id}/{lote_id}/itens/{lote_item_id}/referencia.pdf
 *   lotes-files/{escritorio_id}/{lote_id}/exports/{arquivo}
 */

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

export async function uploadLoteArquivo(
  supabase: SupabaseClient<Database>,
  path: string,
  conteudo: Buffer | Blob,
  contentType: string
): Promise<void> {
  const { error } = await supabase.storage
    .from(env.loteStorageBucket)
    .upload(path, conteudo, { contentType, upsert: true });
  if (error) throw error;
}

export async function createLoteSignedUrl(
  supabase: SupabaseClient<Database>,
  path: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(env.loteStorageBucket)
    .createSignedUrl(path, env.loteSignedUrlTtlSeconds);
  if (error || !data) throw error ?? new Error("falha_ao_gerar_signed_url");
  return data.signedUrl;
}

export async function downloadLoteArquivo(
  supabase: SupabaseClient<Database>,
  path: string
): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(env.loteStorageBucket).download(path);
  if (error || !data) throw error ?? new Error("falha_ao_baixar_arquivo_do_lote");
  return Buffer.from(await data.arrayBuffer());
}
