import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { emailProvider } from "@/lib/notificacoes/email-provider";

/**
 * Serviço central de alertas (item 1.2 do MD): consumido pelo motor NF-e,
 * pelo monitor de CNPJ e pelo gerador de DANFSe. Grava o alerta no painel
 * e, best-effort, dispara e-mail — falha no envio de e-mail nunca deve
 * derrubar o fluxo que gerou o alerta.
 */
export type TipoAlerta =
  | "certificado_vencendo"
  | "certificado_vencido"
  | "situacao_cadastral_alterada"
  | "obrigacao_proxima"
  | "nova_nota_fiscal"
  | "danfse_fora_padrao";

export interface CriarAlertaInput {
  escritorioId: string;
  clienteId?: string | null;
  tipo: TipoAlerta;
  mensagem: string;
  emailDestino?: string | null;
}

export async function criarAlerta(
  supabase: SupabaseClient<Database>,
  input: CriarAlertaInput
): Promise<void> {
  const { error } = await supabase.from("alerta").insert({
    escritorio_id: input.escritorioId,
    cliente_id: input.clienteId ?? null,
    tipo: input.tipo,
    mensagem: input.mensagem,
  });

  if (error) {
    throw error;
  }

  if (input.emailDestino) {
    try {
      await emailProvider.send({
        to: input.emailDestino,
        subject: `Alerta: ${input.tipo}`,
        text: input.mensagem,
      });
    } catch (err) {
      console.error("[alertas] falha ao enviar e-mail de notificação (alerta já registrado)", err);
    }
  }
}
