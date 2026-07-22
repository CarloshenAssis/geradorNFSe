import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export interface EventoPagamentoConfirmado {
  escritorioId: string;
  gatewayRef: string;
  valor: number;
  tipo: "assinatura" | "credito_avulso";
  creditos?: number;
  planoId?: string;
}

/**
 * Débito/crédito de saldo nunca acontece direto na tabela pelo código da
 * aplicação — sempre via função transacional no banco, para não correr
 * risco de condição de corrida entre webhook duplicado e leitura de saldo
 * (item 2.6 do MD).
 */
export async function confirmarPagamento(evento: EventoPagamentoConfirmado): Promise<{ jaProcessado: boolean }> {
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase.rpc("confirm_payment_and_add_credits", {
    p_escritorio_id: evento.escritorioId,
    p_gateway_ref: evento.gatewayRef,
    p_valor: evento.valor,
    p_tipo: evento.tipo,
    p_creditos: evento.creditos ?? 0,
    p_plano_id: evento.planoId ?? null,
  });

  if (error) {
    throw new Error(`falha_ao_confirmar_pagamento: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return { jaProcessado: Boolean(row?.ja_processado) };
}
