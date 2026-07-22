/**
 * Mapeamento de códigos do leiaute NFS-e nacional para as descrições que o
 * DANFSe deve imprimir (NT 008/2026 — vários campos mandam "utilizar a
 * descrição das opções previstas no leiaute", não o código cru).
 * Fallback: quando o código não é reconhecido, retorna o próprio código.
 */

function descreve(mapa: Record<string, string>, codigo: string | undefined): string {
  if (!codigo) return "";
  return mapa[codigo] ?? codigo;
}

const TP_EMIT: Record<string, string> = {
  "1": "Prestador",
  "2": "Tomador",
  "3": "Intermediário",
};

const TP_AMB: Record<string, string> = {
  "1": "Produção",
  "2": "Homologação",
};

const AMB_GER: Record<string, string> = {
  "1": "Prefeitura",
  "2": "Sistema Nacional da NFS-e",
};

const C_STAT: Record<string, string> = {
  "100": "NFS-e emitida",
};

const FIN_NFSE: Record<string, string> = {
  "1": "NFS-e regular",
  "2": "NFS-e complementar",
  "3": "NFS-e extemporânea",
};

const TRIB_ISSQN: Record<string, string> = {
  "1": "Operação Tributável",
  "2": "Exportação de Serviço",
  "3": "Não Incidência",
  "4": "Imunidade",
};

const TP_RET_ISSQN: Record<string, string> = {
  "1": "Não Retido",
  "2": "Retido pelo Tomador",
  "3": "Retido pelo Intermediário",
};

const OP_SIMP_NAC: Record<string, string> = {
  "1": "Não Optante",
  "2": "Optante - Microempreendedor Individual (MEI)",
  "3": "Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)",
};

const REG_AP_TRIB_SN: Record<string, string> = {
  "1": "Regime de apuração dos tributos federais e municipal pelo Simples Nacional",
  "2": "Regime de apuração dos tributos federais e municipal fora do Simples Nacional",
  "3": "Regime de apuração com o ISSQN fora do Simples Nacional",
};

export const codigos = {
  tpEmit: (c?: string) => descreve(TP_EMIT, c),
  tpAmb: (c?: string) => descreve(TP_AMB, c),
  ambGer: (c?: string) => descreve(AMB_GER, c),
  cStat: (c?: string) => descreve(C_STAT, c),
  finNFSe: (c?: string) => descreve(FIN_NFSE, c),
  tribISSQN: (c?: string) => descreve(TRIB_ISSQN, c),
  tpRetISSQN: (c?: string) => descreve(TP_RET_ISSQN, c),
  opSimpNac: (c?: string) => descreve(OP_SIMP_NAC, c),
  regApTribSN: (c?: string) => descreve(REG_AP_TRIB_SN, c),
};
