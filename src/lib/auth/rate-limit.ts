import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const JANELA_MINUTOS = 15;
const MAX_TENTATIVAS_POR_EMAIL = 5;
const MAX_TENTATIVAS_POR_IP = 20;

export class RateLimitError extends Error {}

/**
 * Rate limiting de login (item 2.4 do MD: evitar brute force). Verifica
 * tentativas recentes por e-mail e por IP antes de permitir nova tentativa.
 * Usa service_role porque login_attempt não tem policy para anon/authenticated.
 */
export async function assertLoginNotRateLimited(email: string, ip: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000).toISOString();

  const [porEmail, porIp] = await Promise.all([
    supabase
      .from("login_attempt")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("criado_em", desde),
    supabase
      .from("login_attempt")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("criado_em", desde),
  ]);

  if ((porEmail.count ?? 0) >= MAX_TENTATIVAS_POR_EMAIL || (porIp.count ?? 0) >= MAX_TENTATIVAS_POR_IP) {
    throw new RateLimitError("muitas_tentativas_de_login");
  }
}

export async function recordLoginAttempt(email: string, ip: string, sucesso: boolean): Promise<void> {
  const supabase = createSupabaseServiceClient();
  await supabase.from("login_attempt").insert({ email, ip, sucesso });
}
