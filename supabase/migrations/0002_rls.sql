-- =========================================================================
-- 0002_rls.sql
-- RLS obrigatória em toda tabela com escritorio_id (item 1.5 / 2.2 do MD).
-- A aplicação NUNCA deve confiar só em filtro feito no código — isto é a
-- última linha de defesa mesmo se a API tiver bug.
-- =========================================================================

-- Função auxiliar: escritorio_id do usuário autenticado.
-- security definer + search_path fixo para evitar hijacking de função.
create or replace function app_current_escritorio_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select escritorio_id from usuario where id = auth.uid()
$$;

create or replace function app_current_papel()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select papel from usuario where id = auth.uid()
$$;

-- =========================================
-- PLANO — leitura pública (tabela de preços), sem escrita via cliente
-- =========================================

alter table plano enable row level security;

create policy plano_select_all on plano
  for select
  using (true);

-- =========================================
-- ESCRITORIO — cada usuário só enxerga o próprio escritório
-- =========================================

alter table escritorio enable row level security;

create policy escritorio_select_own on escritorio
  for select
  using (id = app_current_escritorio_id());

-- Sem policy de insert/update/delete para role authenticated:
-- provisionamento de escritório passa pelo backend com service_role.

-- =========================================
-- USUARIO — visível para o próprio escritório; só admin gerencia
-- =========================================

alter table usuario enable row level security;

create policy usuario_select_own_escritorio on usuario
  for select
  using (escritorio_id = app_current_escritorio_id());

create policy usuario_admin_insert on usuario
  for insert
  with check (
    escritorio_id = app_current_escritorio_id()
    and app_current_papel() = 'admin'
  );

create policy usuario_admin_update on usuario
  for update
  using (
    escritorio_id = app_current_escritorio_id()
    and app_current_papel() = 'admin'
  )
  with check (escritorio_id = app_current_escritorio_id());

create policy usuario_admin_delete on usuario
  for delete
  using (
    escritorio_id = app_current_escritorio_id()
    and app_current_papel() = 'admin'
  );

-- =========================================
-- CLIENTE
-- =========================================

alter table cliente enable row level security;

create policy tenant_isolation_cliente on cliente
  using (escritorio_id = app_current_escritorio_id())
  with check (escritorio_id = app_current_escritorio_id());

-- =========================================
-- CERTIFICADO_A1 — isolado via join com cliente; só admin altera
-- =========================================

alter table certificado_a1 enable row level security;

create policy tenant_isolation_certificado_select on certificado_a1
  for select
  using (
    exists (
      select 1 from cliente c
      where c.id = certificado_a1.cliente_id
        and c.escritorio_id = app_current_escritorio_id()
    )
  );

create policy tenant_isolation_certificado_write on certificado_a1
  for all
  using (
    exists (
      select 1 from cliente c
      where c.id = certificado_a1.cliente_id
        and c.escritorio_id = app_current_escritorio_id()
    )
    and app_current_papel() = 'admin'
  )
  with check (
    exists (
      select 1 from cliente c
      where c.id = certificado_a1.cliente_id
        and c.escritorio_id = app_current_escritorio_id()
    )
    and app_current_papel() = 'admin'
  );

-- =========================================
-- NOTA_FISCAL — isolado via join com cliente; leitura apenas (escrita via job)
-- =========================================

alter table nota_fiscal enable row level security;

create policy tenant_isolation_nota_fiscal on nota_fiscal
  for select
  using (
    exists (
      select 1 from cliente c
      where c.id = nota_fiscal.cliente_id
        and c.escritorio_id = app_current_escritorio_id()
    )
  );

-- =========================================
-- MONITORAMENTO_CNPJ — isolado via join com cliente; leitura apenas
-- =========================================

alter table monitoramento_cnpj enable row level security;

create policy tenant_isolation_monitoramento on monitoramento_cnpj
  for select
  using (
    exists (
      select 1 from cliente c
      where c.id = monitoramento_cnpj.cliente_id
        and c.escritorio_id = app_current_escritorio_id()
    )
  );

-- =========================================
-- DANFSE_GENERATION
-- =========================================

alter table danfse_generation enable row level security;

create policy tenant_isolation_danfse on danfse_generation
  using (escritorio_id = app_current_escritorio_id())
  with check (escritorio_id = app_current_escritorio_id());

-- =========================================
-- ALERTA
-- =========================================

alter table alerta enable row level security;

create policy tenant_isolation_alerta on alerta
  using (escritorio_id = app_current_escritorio_id())
  with check (escritorio_id = app_current_escritorio_id());

-- =========================================
-- SALDO_CREDITO — leitura para o escritório; escrita só via função/service_role
-- =========================================

alter table saldo_credito enable row level security;

create policy tenant_isolation_saldo_select on saldo_credito
  for select
  using (escritorio_id = app_current_escritorio_id());

-- =========================================
-- TRANSACAO_PAGAMENTO — leitura para o escritório; escrita só via service_role/webhook
-- =========================================

alter table transacao_pagamento enable row level security;

create policy tenant_isolation_transacao_select on transacao_pagamento
  for select
  using (escritorio_id = app_current_escritorio_id());

-- =========================================
-- AUDIT_LOG — leitura para o escritório (admin); imutável (sem update/delete)
-- =========================================

alter table audit_log enable row level security;

create policy tenant_isolation_audit_select on audit_log
  for select
  using (
    escritorio_id = app_current_escritorio_id()
    and app_current_papel() = 'admin'
  );

create policy tenant_isolation_audit_insert on audit_log
  for insert
  with check (escritorio_id = app_current_escritorio_id());

-- Nenhuma policy de update/delete em audit_log: log é append-only por design.
-- Mesmo o dono da linha não pode alterar/apagar; só service_role (bypassa RLS)
-- em rotinas de retenção/expurgo, quando aplicável.
