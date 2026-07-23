import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const lido = body?.lido !== false;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("alerta")
    .update({ lido })
    .eq("id", params.id)
    .select("id, lido")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "falha_ao_atualizar_alerta" }, { status: 500 });
  }

  return NextResponse.json({ alerta: data });
}
