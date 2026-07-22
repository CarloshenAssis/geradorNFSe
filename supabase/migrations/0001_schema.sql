-- =========================================================================
-- 0001_schema.sql
-- Schema completo (Parte 4 da especificação): tenancy, clientes, motor NF-e,
-- monitor de CNPJ, gerador de DANFSe, alertas, billing e auditoria.
-- =========================================================================

create extension if not exists pgcrypto;

-- =========================================
-- BILLING (plano precisa existir antes de escritorio referenciá-lo)
-- =========================================

create table plano (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  limite_pdfs_mes integer, -- null = ilimitado
  preco_mensal numeric(10,2) not null
);

-- =========================================
-- TENANCY & AUTH
-- =========================================

create table escritorio (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text not null unique,
  plano_id uuid references plano(id),
  criado_em timestamptz not null default now()
);

create table usuario (
  id uuid primary key default gen_random_uuid(), -- espelha auth.users.id do Supabase Auth
  escritorio_id uuid not null references escritorio(id) on delete cascade,
  nome text not null,
  email text not null unique,
  papel text not null check (papel in ('admin', 'operador')),
  mfa_ativo boolean not null default false,
  criado_em timestamptz not null default now()
);

create index idx_usuario_escritorio on usuario(escritorio_id);

-- =========================================
-- CLIENTES DO ESCRITÓRIO
-- =========================================

create table cliente (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorio(id) on delete cascade,
  cnpj text not null,
  razao_social text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (escritorio_id, cnpj)
);

create index idx_cliente_escritorio on cliente(escritorio_id);

create table certificado_a1 (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references cliente(id) on delete cascade,
  arquivo_criptografado_ref text not null, -- referência no Vault/KMS, nunca o arquivo em si na tabela
  senha_criptografada_ref text not null,
  valido_ate date not null,
  status text not null check (status in ('ativo', 'expirado', 'revogado')),
  criado_em timestamptz not null default now()
);

create index idx_certificado_cliente on certificado_a1(cliente_id);
-- No máximo um certificado "ativo" por cliente por vez.
create unique index uq_certificado_ativo_por_cliente
  on certificado_a1(cliente_id)
  where (status = 'ativo');

-- =========================================
-- MOTOR NF-e (distribuição via SEFAZ)
-- =========================================

create table nota_fiscal (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references cliente(id) on delete cascade,
  chave_acesso text not null unique, -- chave da NF-e, usada como idempotência
  xml_storage_ref text not null,
  data_emissao timestamptz,
  valor numeric(14,2),
  emitente_cnpj text,
  criado_em timestamptz not null default now()
);

create index idx_nota_fiscal_cliente on nota_fiscal(cliente_id);

-- =========================================
-- MONITOR DE CNPJ
-- =========================================

create table monitoramento_cnpj (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references cliente(id) on delete cascade,
  situacao_cadastral text,
  ultima_verificacao timestamptz,
  proxima_obrigacao text,
  proxima_obrigacao_data date
);

create index idx_monitoramento_cliente on monitoramento_cnpj(cliente_id);

-- =========================================
-- GERADOR DE DANFSe (módulo standalone/wedge)
-- =========================================

create table danfse_generation (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorio(id) on delete cascade,
  cliente_id uuid references cliente(id), -- pode ser nulo se uso avulso fora do fluxo do cliente
  criado_por uuid references usuario(id),
  xml_storage_ref text not null,
  pdf_storage_ref text,
  status text not null check (status in ('pendente', 'processando', 'concluido', 'erro')),
  erro_detalhe text,
  credito_consumido boolean not null default false,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);

create index idx_danfse_escritorio on danfse_generation(escritorio_id);

-- =========================================
-- ALERTAS
-- =========================================

create table alerta (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorio(id) on delete cascade,
  cliente_id uuid references cliente(id),
  tipo text not null, -- ex: 'certificado_vencendo', 'situacao_cadastral_alterada', 'danfse_fora_padrao'
  mensagem text not null,
  lido boolean not null default false,
  criado_em timestamptz not null default now()
);

create index idx_alerta_escritorio on alerta(escritorio_id);

-- =========================================
-- BILLING (continuação)
-- =========================================

create table saldo_credito (
  escritorio_id uuid primary key references escritorio(id) on delete cascade,
  creditos_disponiveis integer not null default 0 check (creditos_disponiveis >= 0),
  atualizado_em timestamptz not null default now()
);

create table transacao_pagamento (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorio(id) on delete cascade,
  tipo text not null check (tipo in ('assinatura', 'credito_avulso')),
  valor numeric(10,2) not null,
  gateway_ref text not null unique, -- id da transação no gateway externo (idempotência de webhook)
  status text not null check (status in ('pendente', 'confirmado', 'falhou')),
  criado_em timestamptz not null default now()
);

create index idx_transacao_escritorio on transacao_pagamento(escritorio_id);

-- =========================================
-- AUDITORIA
-- =========================================

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorio(id) on delete cascade,
  usuario_id uuid references usuario(id),
  acao text not null, -- ex: 'login', 'gerar_danfse', 'alterar_certificado'
  recurso_tipo text,
  recurso_id uuid,
  criado_em timestamptz not null default now()
);

create index idx_audit_escritorio on audit_log(escritorio_id);
create index idx_audit_criado_em on audit_log(criado_em);
