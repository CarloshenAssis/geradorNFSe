-- =========================================================================
-- 0003_functions.sql
-- Funções transacionais. Todas SECURITY DEFINER com verificação explícita
-- de tenant (nunca confiar só no parâmetro recebido do cliente) — item 1.3
-- e 2.6 do MD: débito de crédito é transação atômica com a geração do PDF.
-- =========================================================================

-- Débito atômico de crédito + criação do registro de geração (status inicial
-- 'processando'). Lança exceção se saldo insuficiente — nesse caso a API
-- nunca deve iniciar o render do PDF.
create or replace function consume_credit_and_start_generation(
  p_generation_id uuid,
  p_cliente_id uuid,
  p_xml_storage_ref text
)
returns danfse_generation
language plpgsql
security definer
set search_path = public
as $$
declare
  v_escritorio_id uuid;
  v_usuario_id uuid := auth.uid();
  v_saldo integer;
  v_row danfse_generation;
begin
  select escritorio_id into v_escritorio_id from usuario where id = v_usuario_id;
  if v_escritorio_id is null then
    raise exception 'usuario_sem_escritorio';
  end if;

  if p_cliente_id is not null then
    if not exists (
      select 1 from cliente where id = p_cliente_id and escritorio_id = v_escritorio_id
    ) then
      raise exception 'cliente_fora_do_escritorio';
    end if;
  end if;

  select creditos_disponiveis into v_saldo
  from saldo_credito
  where escritorio_id = v_escritorio_id
  for update;

  if v_saldo is null or v_saldo < 1 then
    raise exception 'saldo_insuficiente';
  end if;

  update saldo_credito
  set creditos_disponiveis = creditos_disponiveis - 1,
      atualizado_em = now()
  where escritorio_id = v_escritorio_id;

  insert into danfse_generation (
    id, escritorio_id, cliente_id, criado_por, xml_storage_ref, status, credito_consumido
  ) values (
    p_generation_id, v_escritorio_id, p_cliente_id, v_usuario_id, p_xml_storage_ref, 'processando', true
  )
  returning * into v_row;

  insert into audit_log (escritorio_id, usuario_id, acao, recurso_tipo, recurso_id)
  values (v_escritorio_id, v_usuario_id, 'gerar_danfse_iniciado', 'danfse_generation', p_generation_id);

  return v_row;
end;
$$;

revoke all on function consume_credit_and_start_generation(uuid, uuid, text) from public;
grant execute on function consume_credit_and_start_generation(uuid, uuid, text) to authenticated;

-- Finaliza a geração com sucesso.
create or replace function complete_generation(
  p_generation_id uuid,
  p_pdf_storage_ref text
)
returns danfse_generation
language plpgsql
security definer
set search_path = public
as $$
declare
  v_escritorio_id uuid;
  v_usuario_id uuid := auth.uid();
  v_row danfse_generation;
begin
  select escritorio_id into v_escritorio_id from usuario where id = v_usuario_id;

  update danfse_generation
  set status = 'concluido',
      pdf_storage_ref = p_pdf_storage_ref,
      concluido_em = now()
  where id = p_generation_id
    and escritorio_id = v_escritorio_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'geracao_nao_encontrada_ou_sem_permissao';
  end if;

  insert into audit_log (escritorio_id, usuario_id, acao, recurso_tipo, recurso_id)
  values (v_escritorio_id, v_usuario_id, 'gerar_danfse_concluido', 'danfse_generation', p_generation_id);

  return v_row;
end;
$$;

revoke all on function complete_generation(uuid, text) from public;
grant execute on function complete_generation(uuid, text) to authenticated;

-- Marca falha. Não estorna o crédito automaticamente (decisão de produto:
-- falhas de render são raras e o estorno manual evita abuso via
-- geração induzida a erro repetidamente).
create or replace function fail_generation(
  p_generation_id uuid,
  p_erro_detalhe text
)
returns danfse_generation
language plpgsql
security definer
set search_path = public
as $$
declare
  v_escritorio_id uuid;
  v_usuario_id uuid := auth.uid();
  v_row danfse_generation;
begin
  select escritorio_id into v_escritorio_id from usuario where id = v_usuario_id;

  update danfse_generation
  set status = 'erro',
      erro_detalhe = left(p_erro_detalhe, 500)
  where id = p_generation_id
    and escritorio_id = v_escritorio_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'geracao_nao_encontrada_ou_sem_permissao';
  end if;

  insert into audit_log (escritorio_id, usuario_id, acao, recurso_tipo, recurso_id)
  values (v_escritorio_id, v_usuario_id, 'gerar_danfse_falhou', 'danfse_generation', p_generation_id);

  return v_row;
end;
$$;

revoke all on function fail_generation(uuid, text) from public;
grant execute on function fail_generation(uuid, text) to authenticated;

-- Upsert idempotente de nota fiscal (motor NF-e), chave_acesso é a chave de
-- idempotência: reexecuções do job de distribuição não duplicam notas.
create or replace function upsert_nota_fiscal(
  p_cliente_id uuid,
  p_chave_acesso text,
  p_xml_storage_ref text,
  p_data_emissao timestamptz,
  p_valor numeric,
  p_emitente_cnpj text
)
returns nota_fiscal
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row nota_fiscal;
begin
  insert into nota_fiscal (
    cliente_id, chave_acesso, xml_storage_ref, data_emissao, valor, emitente_cnpj
  ) values (
    p_cliente_id, p_chave_acesso, p_xml_storage_ref, p_data_emissao, p_valor, p_emitente_cnpj
  )
  on conflict (chave_acesso) do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from nota_fiscal where chave_acesso = p_chave_acesso;
  end if;

  return v_row;
end;
$$;

-- Chamada apenas pelos jobs (service_role); sem grant para authenticated.
revoke all on function upsert_nota_fiscal(uuid, text, text, timestamptz, numeric, text) from public;
