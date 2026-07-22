import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Papel } from "@/lib/supabase/database.types";

export interface SessionContext {
  userId: string;
  email: string;
  escritorioId: string;
  papel: Papel;
}

/**
 * Contexto de tenant do usuário autenticado, para uso em Route Handlers e
 * Server Components. Retorna null se não autenticado ou sem vínculo com
 * um escritório (usuário provisionado mas ainda não associado).
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: usuario } = await supabase
    .from("usuario")
    .select("escritorio_id, papel, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!usuario) {
    return null;
  }

  return {
    userId: user.id,
    email: usuario.email,
    escritorioId: usuario.escritorio_id,
    papel: usuario.papel,
  };
}

export async function requireSessionContext(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) {
    throw new AuthError("nao_autenticado");
  }
  return ctx;
}

export function requireAdmin(ctx: SessionContext): void {
  if (ctx.papel !== "admin") {
    throw new AuthError("acesso_restrito_a_admin");
  }
}

export class AuthError extends Error {}
