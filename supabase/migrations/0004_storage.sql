-- =========================================================================
-- 0004_storage.sql
-- Bucket privado para XML/PDF (item 1.5 / 2.3 do MD: nunca Storage público,
-- sempre signed URL de TTL curto). Layout de path:
--   danfse-files/{escritorio_id}/{generation_id}/input.xml
--   danfse-files/{escritorio_id}/{generation_id}/output.pdf
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('danfse-files', 'danfse-files', false)
on conflict (id) do nothing;

-- Isola por escritorio_id usando o primeiro segmento do path do objeto.
create policy danfse_files_tenant_select on storage.objects
  for select
  using (
    bucket_id = 'danfse-files'
    and (storage.foldername(name))[1] = app_current_escritorio_id()::text
  );

create policy danfse_files_tenant_insert on storage.objects
  for insert
  with check (
    bucket_id = 'danfse-files'
    and (storage.foldername(name))[1] = app_current_escritorio_id()::text
  );

-- Sem policy de update/delete para authenticated: arquivos gerados são
-- imutáveis; expurgo de retenção (item 2.3, ex: 90 dias) roda via
-- service_role em job dedicado, que bypassa RLS.
