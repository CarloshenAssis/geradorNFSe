-- =========================================================================
-- 0005_auth_rate_limit.sql
-- Rate limiting de login (item 2.4 do MD). Tabela de uso interno, acessada
-- apenas pela API route de login com a service_role key — nunca exposta
-- ao cliente (RLS habilitada sem nenhuma policy = nega tudo para
-- anon/authenticated; service_role sempre bypassa RLS).
-- =========================================================================

create table login_attempt (
  id bigint generated always as identity primary key,
  email text not null,
  ip text not null,
  sucesso boolean not null,
  criado_em timestamptz not null default now()
);

create index idx_login_attempt_email_tempo on login_attempt(email, criado_em desc);
create index idx_login_attempt_ip_tempo on login_attempt(ip, criado_em desc);

alter table login_attempt enable row level security;
-- Nenhuma policy criada de propósito: acesso só via service_role.
