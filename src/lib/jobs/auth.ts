import "server-only";
import type { NextRequest } from "next/server";

/**
 * Rotas de job (motor NF-e, monitor de CNPJ) não são protegidas por sessão
 * de usuário — são chamadas pelo scheduler (Vercel Cron / Supabase Edge
 * Functions agendada). Autenticação por segredo compartilhado no header.
 */
export function isAuthorizedJobRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
