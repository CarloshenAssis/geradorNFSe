// Tipos mantidos manualmente para refletir supabase/migrations/*.sql.
// Assim que houver um projeto Supabase real, substituir por:
//   npx supabase gen types typescript --project-id <id> > src/lib/supabase/database.types.ts

export type Papel = "admin" | "operador";
export type CertificadoStatus = "ativo" | "expirado" | "revogado";
export type DanfseStatus = "pendente" | "processando" | "concluido" | "erro";
export type TransacaoTipo = "assinatura" | "credito_avulso";
export type TransacaoStatus = "pendente" | "confirmado" | "falhou";

export interface Database {
  public: {
    Tables: {
      plano: {
        Row: {
          id: string;
          nome: string;
          limite_pdfs_mes: number | null;
          preco_mensal: number;
        };
        Insert: Partial<Database["public"]["Tables"]["plano"]["Row"]> & { nome: string; preco_mensal: number };
        Update: Partial<Database["public"]["Tables"]["plano"]["Row"]>;
      };
      escritorio: {
        Row: {
          id: string;
          nome: string;
          cnpj: string;
          plano_id: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["escritorio"]["Row"]> & { nome: string; cnpj: string };
        Update: Partial<Database["public"]["Tables"]["escritorio"]["Row"]>;
      };
      usuario: {
        Row: {
          id: string;
          escritorio_id: string;
          nome: string;
          email: string;
          papel: Papel;
          mfa_ativo: boolean;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["usuario"]["Row"]> & {
          id: string;
          escritorio_id: string;
          nome: string;
          email: string;
          papel: Papel;
        };
        Update: Partial<Database["public"]["Tables"]["usuario"]["Row"]>;
      };
      cliente: {
        Row: {
          id: string;
          escritorio_id: string;
          cnpj: string;
          razao_social: string | null;
          ativo: boolean;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["cliente"]["Row"]> & { escritorio_id: string; cnpj: string };
        Update: Partial<Database["public"]["Tables"]["cliente"]["Row"]>;
      };
      certificado_a1: {
        Row: {
          id: string;
          cliente_id: string;
          arquivo_criptografado_ref: string;
          senha_criptografada_ref: string;
          valido_ate: string;
          status: CertificadoStatus;
          criado_em: string;
          ultimo_nsu: string;
          ultima_consulta_em: string | null;
          ultima_falha_consulta: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["certificado_a1"]["Row"]> & {
          cliente_id: string;
          arquivo_criptografado_ref: string;
          senha_criptografada_ref: string;
          valido_ate: string;
          status: CertificadoStatus;
        };
        Update: Partial<Database["public"]["Tables"]["certificado_a1"]["Row"]>;
      };
      nota_fiscal: {
        Row: {
          id: string;
          cliente_id: string;
          chave_acesso: string;
          xml_storage_ref: string;
          data_emissao: string | null;
          valor: number | null;
          emitente_cnpj: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["nota_fiscal"]["Row"]> & {
          cliente_id: string;
          chave_acesso: string;
          xml_storage_ref: string;
        };
        Update: Partial<Database["public"]["Tables"]["nota_fiscal"]["Row"]>;
      };
      monitoramento_cnpj: {
        Row: {
          id: string;
          cliente_id: string;
          situacao_cadastral: string | null;
          ultima_verificacao: string | null;
          proxima_obrigacao: string | null;
          proxima_obrigacao_data: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["monitoramento_cnpj"]["Row"]> & { cliente_id: string };
        Update: Partial<Database["public"]["Tables"]["monitoramento_cnpj"]["Row"]>;
      };
      danfse_generation: {
        Row: {
          id: string;
          escritorio_id: string;
          cliente_id: string | null;
          criado_por: string | null;
          xml_storage_ref: string;
          pdf_storage_ref: string | null;
          status: DanfseStatus;
          erro_detalhe: string | null;
          credito_consumido: boolean;
          criado_em: string;
          concluido_em: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["danfse_generation"]["Row"]> & {
          id: string;
          escritorio_id: string;
          xml_storage_ref: string;
          status: DanfseStatus;
        };
        Update: Partial<Database["public"]["Tables"]["danfse_generation"]["Row"]>;
      };
      alerta: {
        Row: {
          id: string;
          escritorio_id: string;
          cliente_id: string | null;
          tipo: string;
          mensagem: string;
          lido: boolean;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["alerta"]["Row"]> & {
          escritorio_id: string;
          tipo: string;
          mensagem: string;
        };
        Update: Partial<Database["public"]["Tables"]["alerta"]["Row"]>;
      };
      saldo_credito: {
        Row: {
          escritorio_id: string;
          creditos_disponiveis: number;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["saldo_credito"]["Row"]> & { escritorio_id: string };
        Update: Partial<Database["public"]["Tables"]["saldo_credito"]["Row"]>;
      };
      transacao_pagamento: {
        Row: {
          id: string;
          escritorio_id: string;
          tipo: TransacaoTipo;
          valor: number;
          gateway_ref: string;
          status: TransacaoStatus;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["transacao_pagamento"]["Row"]> & {
          escritorio_id: string;
          tipo: TransacaoTipo;
          valor: number;
          gateway_ref: string;
          status: TransacaoStatus;
        };
        Update: Partial<Database["public"]["Tables"]["transacao_pagamento"]["Row"]>;
      };
      audit_log: {
        Row: {
          id: string;
          escritorio_id: string;
          usuario_id: string | null;
          acao: string;
          recurso_tipo: string | null;
          recurso_id: string | null;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_log"]["Row"]> & {
          escritorio_id: string;
          acao: string;
        };
        Update: never;
      };
      login_attempt: {
        Row: {
          id: number;
          email: string;
          ip: string;
          sucesso: boolean;
          criado_em: string;
        };
        Insert: { email: string; ip: string; sucesso: boolean };
        Update: never;
      };
    };
    Functions: {
      consume_credit_and_start_generation: {
        Args: { p_generation_id: string; p_cliente_id: string | null; p_xml_storage_ref: string };
        Returns: Database["public"]["Tables"]["danfse_generation"]["Row"];
      };
      complete_generation: {
        Args: { p_generation_id: string; p_pdf_storage_ref: string };
        Returns: Database["public"]["Tables"]["danfse_generation"]["Row"];
      };
      fail_generation: {
        Args: { p_generation_id: string; p_erro_detalhe: string };
        Returns: Database["public"]["Tables"]["danfse_generation"]["Row"];
      };
      upsert_nota_fiscal: {
        Args: {
          p_cliente_id: string;
          p_chave_acesso: string;
          p_xml_storage_ref: string;
          p_data_emissao: string | null;
          p_valor: number | null;
          p_emitente_cnpj: string | null;
        };
        Returns: Database["public"]["Tables"]["nota_fiscal"]["Row"];
      };
      confirm_payment_and_add_credits: {
        Args: {
          p_escritorio_id: string;
          p_gateway_ref: string;
          p_valor: number;
          p_tipo: TransacaoTipo;
          p_creditos?: number;
          p_plano_id?: string | null;
        };
        Returns: { transacao_id: string; ja_processado: boolean }[];
      };
    };
  };
}
