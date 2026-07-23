import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";

export interface ResumoRetencao {
  lotesExpurgados: number;
  lotesMarcadosComoFalha: number;
  falhas: Array<{ loteId: string; motivo: string }>;
}

// A continuação do processamento em chunks depende da sessão do usuário
// (consume_credit_and_start_generation usa auth.uid() internamente — não
// pode ser chamada com service_role). Sem uma sessão para retomar, este
// job apenas marca como 'falhou' lotes abandonados no meio do
// processamento (usuário fechou a página antes de o polling terminar),
// para não deixá-los presos em 'processando' indefinidamente.
const TEMPO_LIMITE_PROCESSANDO_MS = 2 * 60 * 60 * 1000;

/**
 * Expurgo de retenção (item 2.3 do MD complementar): lotes ficam
 * disponíveis por `LOTE_RETENCAO_DIAS` (padrão 30) e depois são removidos
 * automaticamente — reforça que este módulo é conveniência, não custódia.
 * Roda com service_role (bypassa RLS), como o padrão dos demais jobs.
 */
export async function runLoteRetencaoJob(): Promise<ResumoRetencao> {
  const supabase = createSupabaseServiceClient();
  const resumo: ResumoRetencao = { lotesExpurgados: 0, lotesMarcadosComoFalha: 0, falhas: [] };

  const limite = new Date(Date.now() - TEMPO_LIMITE_PROCESSANDO_MS).toISOString();
  const { data: lotesAbandonados } = await supabase
    .from("lote_processamento")
    .update({ status: "falhou", erro_detalhe: "processamento_abandonado_apos_limite_de_tempo", finalizado_em: new Date().toISOString() })
    .eq("status", "processando")
    .lt("criado_em", limite)
    .select("id");
  resumo.lotesMarcadosComoFalha = lotesAbandonados?.length ?? 0;

  const { data: lotesExpirados, error } = await supabase
    .from("lote_processamento")
    .select("id, escritorio_id")
    .lt("expira_em", new Date().toISOString());

  if (error) {
    throw new Error(`falha_ao_listar_lotes_expirados: ${error.message}`);
  }

  for (const lote of lotesExpirados ?? []) {
    try {
      const prefixo = `${lote.escritorio_id}/${lote.id}`;
      const { data: arquivos } = await supabase.storage.from(env.loteStorageBucket).list(prefixo, { limit: 1000 });
      // Storage list não é recursivo — remove nível a nível conhecido do layout do módulo.
      const paths = await listarTodosOsPaths(supabase, prefixo);
      if (paths.length > 0) {
        await supabase.storage.from(env.loteStorageBucket).remove(paths);
      }
      void arquivos;

      await supabase.from("lote_processamento").delete().eq("id", lote.id);
      resumo.lotesExpurgados += 1;
    } catch (err) {
      resumo.falhas.push({ loteId: lote.id, motivo: err instanceof Error ? err.message : "falha_desconhecida" });
    }
  }

  return resumo;
}

async function listarTodosOsPaths(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  prefixo: string
): Promise<string[]> {
  const { data: entradas } = await supabase.storage.from(env.loteStorageBucket).list(prefixo, { limit: 1000 });
  if (!entradas) return [];

  const paths: string[] = [];
  for (const entrada of entradas) {
    const caminho = `${prefixo}/${entrada.name}`;
    if (entrada.id === null) {
      // é uma "pasta" (sem id) — desce recursivamente
      paths.push(...(await listarTodosOsPaths(supabase, caminho)));
    } else {
      paths.push(caminho);
    }
  }
  return paths;
}
