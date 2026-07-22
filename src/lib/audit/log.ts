import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Auditoria (Parte 2.7 do MD): log imutável de quem fez o quê, quando,
 * sobre qual recurso — nunca o conteúdo do dado em si. Usado tanto pelas
 * funções RPC (ações do usuário, já auditadas em SQL) quanto por jobs de
 * background (ações do sistema, usuario_id null), via service_role.
 */
export interface AuditEntry {
  escritorioId: string;
  usuarioId?: string | null;
  acao: string;
  recursoTipo?: string;
  recursoId?: string;
}

export async function registrarAuditoria(
  supabase: SupabaseClient<Database>,
  entry: AuditEntry
): Promise<void> {
  await supabase.from("audit_log").insert({
    escritorio_id: entry.escritorioId,
    usuario_id: entry.usuarioId ?? null,
    acao: entry.acao,
    recurso_tipo: entry.recursoTipo ?? null,
    recurso_id: entry.recursoId ?? null,
  });
}
