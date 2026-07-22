/**
 * Calendário simplificado de obrigações acessórias (item 1.2 do MD:
 * "prazos de obrigação (EFD-Reinf etc.)"). Regras fixas de vencimento,
 * não dependem de consulta externa — ajustar conforme o regime tributário
 * real de cada cliente (Simples Nacional, Lucro Presumido/Real têm
 * calendários próprios) ao evoluir este módulo.
 */
export interface ProximaObrigacao {
  nome: string;
  data: string; // YYYY-MM-DD
}

export function calcularProximaObrigacao(referencia: Date = new Date()): ProximaObrigacao {
  // EFD-Reinf: vence no 15º dia do mês seguinte ao fato gerador.
  const proximoMes = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 15);
  return {
    nome: "EFD-Reinf",
    data: proximoMes.toISOString().slice(0, 10),
  };
}
