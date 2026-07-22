import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { obterCertificadoDecodificado, CertificadoVaultError } from "@/lib/certificados/vault";
import { httpsSefazClient, SefazClientError } from "@/lib/nfe/sefaz-client";
import { criarAlerta } from "@/lib/alertas/service";
import { registrarAuditoria } from "@/lib/audit/log";
import type { SefazClient } from "@/lib/nfe/types";

const AMBIENTE = (process.env.SEFAZ_AMBIENTE === "producao" ? "producao" : "homologacao") as
  | "homologacao"
  | "producao";

export interface ResumoExecucaoNfe {
  clientesProcessados: number;
  notasNovas: number;
  falhas: Array<{ clienteId: string; motivo: string }>;
}

/**
 * Job periódico do motor NF-e (item 1.4 do MD): percorre clientes com
 * certificado A1 ativo, consulta a distribuição no SEFAZ e grava novas
 * notas de forma idempotente (chave de acesso). Uma falha em um cliente
 * (certificado vencido, SEFAZ fora do ar) não interrompe os demais.
 */
export async function runMotorNfeJob(sefazClient: SefazClient = httpsSefazClient): Promise<ResumoExecucaoNfe> {
  const supabase = createSupabaseServiceClient();
  const resumo: ResumoExecucaoNfe = { clientesProcessados: 0, notasNovas: 0, falhas: [] };

  const { data: certificados, error } = await supabase
    .from("certificado_a1")
    .select("id, cliente_id, arquivo_criptografado_ref, senha_criptografada_ref, ultimo_nsu, valido_ate")
    .eq("status", "ativo");

  if (error || !certificados) {
    throw new Error(`falha_ao_listar_certificados_ativos: ${error?.message}`);
  }

  for (const cert of certificados) {
    resumo.clientesProcessados += 1;

    const { data: cliente } = await supabase
      .from("cliente")
      .select("id, cnpj, escritorio_id, razao_social")
      .eq("id", cert.cliente_id)
      .maybeSingle();

    if (!cliente) continue;

    try {
      const diasParaVencer = (new Date(cert.valido_ate).getTime() - Date.now()) / 86_400_000;
      if (diasParaVencer <= 15) {
        await criarAlerta(supabase, {
          escritorioId: cliente.escritorio_id,
          clienteId: cliente.id,
          tipo: diasParaVencer <= 0 ? "certificado_vencido" : "certificado_vencendo",
          mensagem: `Certificado A1 do cliente ${cliente.razao_social ?? cliente.cnpj} ${
            diasParaVencer <= 0 ? "está vencido" : `vence em ${Math.ceil(diasParaVencer)} dia(s)`
          }.`,
        });
      }
      if (diasParaVencer <= 0) {
        continue; // não adianta tentar consultar com certificado vencido
      }

      const certificado = await obterCertificadoDecodificado(
        cert.arquivo_criptografado_ref,
        cert.senha_criptografada_ref
      );

      const resultado = await sefazClient.distribuirNotas({
        cnpj: cliente.cnpj,
        certificado,
        ultimoNSU: cert.ultimo_nsu,
        ambiente: AMBIENTE,
      });

      for (const nota of resultado.notas) {
        const xmlPath = `${cliente.escritorio_id}/${cliente.id}/${nota.chaveAcesso}.xml`;

        const { error: uploadError } = await supabase.storage
          .from("notas-fiscais")
          .upload(xmlPath, nota.xmlContent, { contentType: "application/xml", upsert: true });
        if (uploadError) throw uploadError;

        const { data: notaGravada } = await supabase.rpc("upsert_nota_fiscal", {
          p_cliente_id: cliente.id,
          p_chave_acesso: nota.chaveAcesso,
          p_xml_storage_ref: xmlPath,
          p_data_emissao: nota.dataEmissao,
          p_valor: nota.valor,
          p_emitente_cnpj: nota.emitenteCnpj,
        });

        if (notaGravada) {
          resumo.notasNovas += 1;
          await criarAlerta(supabase, {
            escritorioId: cliente.escritorio_id,
            clienteId: cliente.id,
            tipo: "nova_nota_fiscal",
            mensagem: `Nova nota fiscal distribuída para ${cliente.razao_social ?? cliente.cnpj} (chave ${nota.chaveAcesso}).`,
          });
        }
      }

      await supabase
        .from("certificado_a1")
        .update({
          ultimo_nsu: resultado.maxNSU,
          ultima_consulta_em: new Date().toISOString(),
          ultima_falha_consulta: null,
        })
        .eq("id", cert.id);

      await registrarAuditoria(supabase, {
        escritorioId: cliente.escritorio_id,
        acao: "motor_nfe_execucao",
        recursoTipo: "cliente",
        recursoId: cliente.id,
      });
    } catch (err) {
      const motivo =
        err instanceof CertificadoVaultError || err instanceof SefazClientError
          ? err.message
          : "falha_desconhecida_no_motor_nfe";

      resumo.falhas.push({ clienteId: cliente.id, motivo });

      await supabase
        .from("certificado_a1")
        .update({ ultima_falha_consulta: motivo, ultima_consulta_em: new Date().toISOString() })
        .eq("id", cert.id);
    }
  }

  return resumo;
}
