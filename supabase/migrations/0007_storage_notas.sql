-- =========================================================================
-- 0007_storage_notas.sql
-- Bucket privado para XML das notas fiscais distribuídas pelo motor NF-e.
-- Path: notas-fiscais/{escritorio_id}/{cliente_id}/{chave_acesso}.xml
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('notas-fiscais', 'notas-fiscais', false)
on conflict (id) do nothing;

create policy notas_fiscais_tenant_select on storage.objects
  for select
  using (
    bucket_id = 'notas-fiscais'
    and (storage.foldername(name))[1] = app_current_escritorio_id()::text
  );

-- Sem policy de insert para authenticated: só o job (service_role, que
-- bypassa RLS) grava nesse bucket.
