/**
 * Logs estruturados (item 3.4 do MD): sempre JSON, nunca texto livre, para
 * poder filtrar por escritorio_id/modulo/severidade na plataforma de
 * observabilidade. Nunca logar segredo, PII em texto puro ou conteúdo de
 * documento — apenas identificadores.
 */
export type Severidade = "debug" | "info" | "warn" | "error";

export interface LogContext {
  modulo: string;
  escritorioId?: string;
  clienteId?: string;
  [key: string]: unknown;
}

function log(severidade: Severidade, mensagem: string, contexto: LogContext) {
  const linha = {
    timestamp: new Date().toISOString(),
    severidade,
    mensagem,
    ...contexto,
  };

  const serializado = JSON.stringify(linha);
  if (severidade === "error") {
    console.error(serializado);
  } else if (severidade === "warn") {
    console.warn(serializado);
  } else {
    console.log(serializado);
  }
}

export const logger = {
  debug: (mensagem: string, contexto: LogContext) => log("debug", mensagem, contexto),
  info: (mensagem: string, contexto: LogContext) => log("info", mensagem, contexto),
  warn: (mensagem: string, contexto: LogContext) => log("warn", mensagem, contexto),
  error: (mensagem: string, contexto: LogContext) => log("error", mensagem, contexto),
};
