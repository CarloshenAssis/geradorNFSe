import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Client com a service_role key — BYPASSA RLS. Nunca importar em código que
 * roda no browser (o import "server-only" acima já quebra o build se isso
 * acontecer). Uso restrito a: jobs (motor NF-e, monitor CNPJ), webhook de
 * pagamento, rate limiting de login e rotinas de expurgo/retenção.
 */
export function createSupabaseServiceClient() {
  return createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
