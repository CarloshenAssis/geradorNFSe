/**
 * A chave de acesso da NFe (44 dígitos) codifica o CNPJ do emitente nas
 * posições 7 a 20 (0-indexed 6..20): cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3)
 * nNF(9) tpEmis(1) cNF(8) cDV(1). Extrair direto da chave é mais confiável
 * do que depender de um campo separado que pode não vir preenchido.
 */
export function extrairCnpjEmitenteDaChave(chaveAcesso: string): string | null {
  if (!/^\d{44}$/.test(chaveAcesso)) {
    return null;
  }
  return chaveAcesso.slice(6, 20);
}
