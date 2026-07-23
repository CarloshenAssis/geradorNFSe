import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: escritorio } = await supabase.from("escritorio").select("nome").eq("id", ctx.escritorioId).maybeSingle();

  return NextResponse.json({
    email: ctx.email,
    papel: ctx.papel,
    escritorioNome: escritorio?.nome ?? null,
  });
}
