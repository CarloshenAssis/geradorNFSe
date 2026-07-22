-- =========================================================================
-- 0006_nfe_job_state.sql
-- Estado de cursor do motor NF-e (item 1.4 do MD): cada certificado
-- acompanha o último NSU processado no NFeDistribuicaoDFe, para retomar
-- de onde parou a cada execução do job periódico.
-- =========================================================================

alter table certificado_a1
  add column ultimo_nsu text not null default '000000000000000',
  add column ultima_consulta_em timestamptz,
  add column ultima_falha_consulta text;

-- upsert_nota_fiscal é chamada pelo job (service_role), não pelo usuário
-- final via API pública — garante o grant explícito para essa role.
grant execute on function upsert_nota_fiscal(uuid, text, text, timestamptz, numeric, text) to service_role;
