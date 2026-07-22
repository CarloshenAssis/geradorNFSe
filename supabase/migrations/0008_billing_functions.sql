-- =========================================================================
-- 0008_billing_functions.sql
-- Confirmação de pagamento (item 2.6 do MD): idempotente via
-- transacao_pagamento.gateway_ref (unique) — reprocessar o mesmo evento de
-- webhook nunca credita duas vezes. Chamada só pelo webhook (service_role).
-- =========================================================================

create or replace function confirm_payment_and_add_credits(
  p_escritorio_id uuid,
  p_gateway_ref text,
  p_valor numeric,
  p_tipo text, -- 'assinatura' | 'credito_avulso'
  p_creditos integer default 0,
  p_plano_id uuid default null
)
returns table (transacao_id uuid, ja_processado boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transacao_id uuid;
  v_ja_existe boolean := false;
begin
  insert into transacao_pagamento (escritorio_id, tipo, valor, gateway_ref, status)
  values (p_escritorio_id, p_tipo, p_valor, p_gateway_ref, 'confirmado')
  on conflict (gateway_ref) do nothing
  returning id into v_transacao_id;

  if v_transacao_id is null then
    -- Já processado antes (reentrega de webhook) — não credita de novo.
    select id into v_transacao_id from transacao_pagamento where gateway_ref = p_gateway_ref;
    v_ja_existe := true;
    return query select v_transacao_id, v_ja_existe;
    return;
  end if;

  if p_tipo = 'credito_avulso' and p_creditos > 0 then
    insert into saldo_credito (escritorio_id, creditos_disponiveis)
    values (p_escritorio_id, p_creditos)
    on conflict (escritorio_id)
    do update set creditos_disponiveis = saldo_credito.creditos_disponiveis + excluded.creditos_disponiveis,
                  atualizado_em = now();
  end if;

  if p_tipo = 'assinatura' and p_plano_id is not null then
    update escritorio set plano_id = p_plano_id where id = p_escritorio_id;
  end if;

  insert into audit_log (escritorio_id, acao, recurso_tipo, recurso_id)
  values (p_escritorio_id, 'pagamento_confirmado', 'transacao_pagamento', v_transacao_id);

  return query select v_transacao_id, v_ja_existe;
end;
$$;

revoke all on function confirm_payment_and_add_credits(uuid, text, numeric, text, integer, uuid) from public;
grant execute on function confirm_payment_and_add_credits(uuid, text, numeric, text, integer, uuid) to service_role;
