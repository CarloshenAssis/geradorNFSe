import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { CertificadoDecodificado } from "@/lib/nfe/types";

/**
 * Acesso ao certificado A1 (item 2.1 do MD — o ativo mais crítico do
 * sistema). O `.pfx` e a senha NUNCA existem em texto puro nas tabelas da
 * aplicação: `certificado_a1.arquivo_criptografado_ref` /
 * `senha_criptografada_ref` são apenas IDs de segredo no Supabase Vault.
 * A decriptação só acontece aqui, dentro do processo de job, nunca exposta
 * via API pública, e o valor decriptado nunca é logado.
 *
 * Supabase Vault expõe os segredos decriptados pela view
 * `vault.decrypted_secrets` — acessível apenas com a service_role key.
 */
export class CertificadoVaultError extends Error {}

export async function obterCertificadoDecodificado(
  arquivoRef: string,
  senhaRef: string
): Promise<CertificadoDecodificado> {
  // Client sem o tipo Database (que só cobre o schema `public`): o schema
  // `vault` do Supabase Vault é acessado fora da tipagem gerada da app.
  const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .schema("vault")
    .from("decrypted_secrets")
    .select("id, decrypted_secret")
    .in("id", [arquivoRef, senhaRef]);

  if (error) {
    // Nunca logar o erro cru: pode conter fragmento do segredo em alguns drivers.
    throw new CertificadoVaultError("falha_ao_acessar_vault");
  }

  const arquivo = data?.find((row) => row.id === arquivoRef)?.decrypted_secret;
  const senha = data?.find((row) => row.id === senhaRef)?.decrypted_secret;

  if (!arquivo || !senha) {
    throw new CertificadoVaultError("segredo_do_certificado_nao_encontrado");
  }

  return {
    pfx: Buffer.from(arquivo, "base64"),
    senha,
  };
}
