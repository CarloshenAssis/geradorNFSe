-- =========================================================================
-- 0010_lote_item_claim.sql
-- Corrige uma condição de corrida real: como o polling de status do
-- frontend pode disparar chamadas concorrentes a processarProximoChunk
-- (dupla renderização, retry de rede, múltiplas abas), duas execuções
-- podiam pegar o MESMO lote_item com status 'pendente' e processá-lo em
-- paralelo — gerando DANFSe em duplicata (com débito de crédito em
-- dobro) e, em alguns casos, um erro transitório do Chromium
-- ("spawn ETXTBSY", de dois processos tentando executar o mesmo binário
-- ao mesmo tempo) sobrescrevendo o resultado bem-sucedido da outra.
--
-- Adiciona o status 'processando' como marcador de reivindicação atômica:
-- cada item só é processado depois de um UPDATE ... WHERE status='pendente'
-- bem-sucedido, que o Postgres serializa por linha — só uma chamada
-- concorrente consegue reivindicar cada item.
-- =========================================================================

alter table lote_item drop constraint lote_item_status_check;
alter table lote_item add constraint lote_item_status_check
  check (status in ('pendente', 'processando', 'processado', 'erro'));
