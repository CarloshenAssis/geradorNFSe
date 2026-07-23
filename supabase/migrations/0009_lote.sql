-- =========================================================================
-- 0009_lote.sql
-- Módulos complementares — Central de Processamento Fiscal (lote),
-- Organizador e Conferência XML×PDF (moduloscomplementaresdanfse.md,
-- Parte 4). Camada sobre o núcleo já existente (danfse_generation) —
-- nada aqui substitui o schema anterior.
-- =========================================================================

-- =========================================
-- PROCESSAMENTO EM LOTE
-- =========================================

create table lote_processamento (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorio(id) on delete cascade,
  usuario_id uuid not null references usuario(id),
  status text not null check (status in ('pendente', 'processando', 'concluido', 'concluido_com_erros', 'falhou')),
  quantidade_arquivos integer not null default 0,
  quantidade_processados integer not null default 0,
  quantidade_sucesso integer not null default 0,
  quantidade_erro integer not null default 0,
  origem_storage_ref text not null, -- o ZIP/arquivos originais enviados
  expira_em timestamptz not null, -- reforça retenção curta, não custódia (item 2.3)
  erro_detalhe text,
  criado_em timestamptz not null default now(),
  finalizado_em timestamptz
);

create index idx_lote_processamento_escritorio on lote_processamento(escritorio_id);

create table lote_item (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references lote_processamento(id) on delete cascade,
  cliente_id uuid references cliente(id), -- pode ser nulo se não reconhecido/associado
  nome_arquivo_original text not null,
  nome_arquivo_padronizado text,
  pasta_padronizada text,
  status text not null check (status in ('pendente', 'processado', 'erro')),
  erro_detalhe text,
  xml_storage_ref text,
  pdf_referencia_storage_ref text, -- PDF enviado junto pelo usuário p/ conferência (opcional)
  danfse_pdf_storage_ref text, -- DANFSe gerado por este sistema
  danfse_generation_id uuid references danfse_generation(id),
  criado_em timestamptz not null default now(),
  processado_em timestamptz
);

create index idx_lote_item_lote on lote_item(lote_id);

-- =========================================
-- EXPORTAÇÕES E RELATÓRIOS
-- =========================================

create table export_gerado (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references lote_processamento(id) on delete cascade,
  tipo text not null check (tipo in ('xlsx', 'csv', 'txt', 'zip_consolidado')),
  storage_ref text not null,
  criado_em timestamptz not null default now()
);

create index idx_export_gerado_lote on export_gerado(lote_id);

create table relatorio_consolidado (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references lote_processamento(id) on delete cascade,
  quantidade_notas integer,
  valor_total_servicos numeric(14,2),
  valor_total_issqn numeric(14,2),
  valor_total_ibs numeric(14,2),
  valor_total_cbs numeric(14,2),
  storage_ref text not null, -- PDF do relatório
  criado_em timestamptz not null default now()
);

create index idx_relatorio_consolidado_lote on relatorio_consolidado(lote_id);

-- =========================================
-- CONFERÊNCIA XML x PDF
-- =========================================

create table conferencia_divergencia (
  id uuid primary key default gen_random_uuid(),
  lote_item_id uuid not null references lote_item(id) on delete cascade,
  campo text not null, -- ex: 'valor_total', 'issqn', 'municipio'
  valor_xml text,
  valor_pdf text,
  status text not null check (status in ('compativel', 'divergente', 'nao_verificavel')),
  criado_em timestamptz not null default now()
);

create index idx_conferencia_divergencia_item on conferencia_divergencia(lote_item_id);

-- =========================================
-- RLS (item 2.2 do MD complementar — mesma política do schema anterior,
-- sem exceção pros módulos de lote)
-- =========================================

alter table lote_processamento enable row level security;

create policy tenant_isolation_lote_processamento_select on lote_processamento
  for select
  using (escritorio_id = app_current_escritorio_id());

create policy tenant_isolation_lote_processamento_insert on lote_processamento
  for insert
  with check (escritorio_id = app_current_escritorio_id());

create policy tenant_isolation_lote_processamento_update on lote_processamento
  for update
  using (escritorio_id = app_current_escritorio_id())
  with check (escritorio_id = app_current_escritorio_id());

-- Sem delete: expurgo de retenção passa por job dedicado com service_role
-- (bypassa RLS), nunca pelo usuário diretamente.

alter table lote_item enable row level security;

create policy tenant_isolation_lote_item_select on lote_item
  for select
  using (
    lote_id in (
      select id from lote_processamento
      where escritorio_id = app_current_escritorio_id()
    )
  );

create policy tenant_isolation_lote_item_insert on lote_item
  for insert
  with check (
    lote_id in (
      select id from lote_processamento
      where escritorio_id = app_current_escritorio_id()
    )
  );

create policy tenant_isolation_lote_item_update on lote_item
  for update
  using (
    lote_id in (
      select id from lote_processamento
      where escritorio_id = app_current_escritorio_id()
    )
  )
  with check (
    lote_id in (
      select id from lote_processamento
      where escritorio_id = app_current_escritorio_id()
    )
  );

alter table export_gerado enable row level security;

create policy tenant_isolation_export_gerado_select on export_gerado
  for select
  using (
    lote_id in (
      select id from lote_processamento
      where escritorio_id = app_current_escritorio_id()
    )
  );

create policy tenant_isolation_export_gerado_insert on export_gerado
  for insert
  with check (
    lote_id in (
      select id from lote_processamento
      where escritorio_id = app_current_escritorio_id()
    )
  );

alter table relatorio_consolidado enable row level security;

create policy tenant_isolation_relatorio_consolidado_select on relatorio_consolidado
  for select
  using (
    lote_id in (
      select id from lote_processamento
      where escritorio_id = app_current_escritorio_id()
    )
  );

create policy tenant_isolation_relatorio_consolidado_insert on relatorio_consolidado
  for insert
  with check (
    lote_id in (
      select id from lote_processamento
      where escritorio_id = app_current_escritorio_id()
    )
  );

alter table conferencia_divergencia enable row level security;

create policy tenant_isolation_conferencia_divergencia_select on conferencia_divergencia
  for select
  using (
    lote_item_id in (
      select li.id from lote_item li
      join lote_processamento lp on lp.id = li.lote_id
      where lp.escritorio_id = app_current_escritorio_id()
    )
  );

create policy tenant_isolation_conferencia_divergencia_insert on conferencia_divergencia
  for insert
  with check (
    lote_item_id in (
      select li.id from lote_item li
      join lote_processamento lp on lp.id = li.lote_id
      where lp.escritorio_id = app_current_escritorio_id()
    )
  );

-- =========================================
-- STORAGE — bucket privado próprio, isolado do bucket do gerador unitário
-- (item 3.2 do MD complementar), retenção curta e explícita (item 2.3).
--   lotes-files/{escritorio_id}/{lote_id}/origem/...
--   lotes-files/{escritorio_id}/{lote_id}/itens/{lote_item_id}/...
--   lotes-files/{escritorio_id}/{lote_id}/exports/...
-- =========================================

insert into storage.buckets (id, name, public)
values ('lotes-files', 'lotes-files', false)
on conflict (id) do nothing;

create policy lotes_files_tenant_select on storage.objects
  for select
  using (
    bucket_id = 'lotes-files'
    and (storage.foldername(name))[1] = app_current_escritorio_id()::text
  );

create policy lotes_files_tenant_insert on storage.objects
  for insert
  with check (
    bucket_id = 'lotes-files'
    and (storage.foldername(name))[1] = app_current_escritorio_id()::text
  );

-- Sem update/delete para authenticated: expurgo de retenção roda via
-- service_role em job dedicado (mesmo padrão de danfse-files).
