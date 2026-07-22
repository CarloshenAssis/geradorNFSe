import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertLoginNotRateLimited, recordLoginAttempt, RateLimitError } from "@/lib/auth/rate-limit";

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "desconhecido";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "credenciais_invalidas" }, { status: 400 });
  }

  const { email, senha } = parsed.data;
  const ip = getClientIp(request);

  try {
    await assertLoginNotRateLimited(email, ip);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: "muitas_tentativas_tente_mais_tarde" }, { status: 429 });
    }
    throw err;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });

  await recordLoginAttempt(email, ip, !error);

  if (error || !data.user) {
    return NextResponse.json({ error: "credenciais_invalidas" }, { status: 401 });
  }

  return NextResponse.json({ userId: data.user.id });
}
