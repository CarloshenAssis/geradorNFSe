import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Storage privado com signed URL de TTL curto (item 1.5 / 2.3 do MD).
 * Path sempre prefixado por escritorio_id — é o que a policy de RLS de
 * storage.objects usa para isolar tenants (ver 0004_storage.sql).
 */

export function buildDanfsePath(escritorioId: string, generationId: string, filename: "input.xml" | "output.pdf"): string {
  return `${escritorioId}/${generationId}/${filename}`;
}

export async function uploadXml(
  supabase: SupabaseClient<Database>,
  path: string,
  xml: string
): Promise<void> {
  const { error } = await supabase.storage
    .from(env.danfseStorageBucket)
    .upload(path, new Blob([xml], { type: "application/xml" }), {
      contentType: "application/xml",
      upsert: false,
    });
  if (error) throw error;
}

export async function uploadPdf(
  supabase: SupabaseClient<Database>,
  path: string,
  pdf: Buffer
): Promise<void> {
  const { error } = await supabase.storage.from(env.danfseStorageBucket).upload(path, pdf, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) throw error;
}

export async function createSignedUrl(supabase: SupabaseClient<Database>, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(env.danfseStorageBucket)
    .createSignedUrl(path, env.danfseSignedUrlTtlSeconds);
  if (error || !data) throw error ?? new Error("falha_ao_gerar_signed_url");
  return data.signedUrl;
}
