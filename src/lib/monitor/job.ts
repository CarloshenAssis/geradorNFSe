import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { cnpjProvider, CnpjProviderError, type CnpjProvider } from "@/lib/monitor/cnpj-provider";
import { calcularProximaObrigacao } from "@/lib/monitor/obrigacoes";
import { criarAlerta } from "@/lib/alertas/service";
import { registrarAuditoria } from "@/lib/audit/log";

export interface ResumoExecucaoMonitor {
  clientesProcessados: number;
  alteracoesDetectadas: number;
  falhas: Array<{ clienteId: string; motivo: string }>;
}

/**
 * Job periódico do monitor de CNPJ (item 1.2 do MD). Para cada cliente
 * ativo, consulta a situação cadastral e recalcula a próxima obrigação;
 * dispara alerta quando a situação muda em relação à última verificação.
 */
export async function runMonitorCnpjJob(
  provider: CnpjProvider = cnpjProvider
): Promise<ResumoExecucaoMonitor> {
  const supabase = createSupabaseServiceClient();
  const resumo: ResumoExecucaoMonitor = { clientesProcessados: 0, alteracoesDetectadas: 0, falhas: [] };

  const { data: clientes, error } = await supabase
    .from("cliente")
    .select("id, cnpj, escritorio_id, razao_social, ativo")
    .eq("ativo", true);

  if (error || !clientes) {
    throw new Error(`falha_ao_listar_clientes_ativos: ${error?.message}`);
  }

  for (const cliente of clientes) {
    resumo.clientesProcessados += 1;

    try {
      const { data: monitoramentoAtual } = await supabase
        .from("monitoramento_cnpj")
        .select("id, situacao_cadastral")
        .eq("cliente_id", cliente.id)
        .maybeSingle();

      const situacao = await provider.consultarSituacaoCadastral(cliente.cnpj);
      const proximaObrigacao = calcularProximaObrigacao();

      if (monitoramentoAtual) {
        await supabase
          .from("monitoramento_cnpj")
          .update({
            situacao_cadastral: situacao.situacao,
            ultima_verificacao: situacao.consultadoEm,
            proxima_obrigacao: proximaObrigacao.nome,
            proxima_obrigacao_data: proximaObrigacao.data,
          })
          .eq("id", monitoramentoAtual.id);
      } else {
        await supabase.from("monitoramento_cnpj").insert({
          cliente_id: cliente.id,
          situacao_cadastral: situacao.situacao,
          ultima_verificacao: situacao.consultadoEm,
          proxima_obrigacao: proximaObrigacao.nome,
          proxima_obrigacao_data: proximaObrigacao.data,
        });
      }

      if (monitoramentoAtual && monitoramentoAtual.situacao_cadastral !== situacao.situacao) {
        resumo.alteracoesDetectadas += 1;
        await criarAlerta(supabase, {
          escritorioId: cliente.escritorio_id,
          clienteId: cliente.id,
          tipo: "situacao_cadastral_alterada",
          mensagem: `Situação cadastral de ${cliente.razao_social ?? cliente.cnpj} mudou de "${monitoramentoAtual.situacao_cadastral}" para "${situacao.situacao}".`,
        });
      }

      await registrarAuditoria(supabase, {
        escritorioId: cliente.escritorio_id,
        acao: "monitor_cnpj_execucao",
        recursoTipo: "cliente",
        recursoId: cliente.id,
      });
    } catch (err) {
      const motivo = err instanceof CnpjProviderError ? err.message : "falha_desconhecida_no_monitor_cnpj";
      resumo.falhas.push({ clienteId: cliente.id, motivo });
    }
  }

  return resumo;
}
