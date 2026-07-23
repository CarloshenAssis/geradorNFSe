import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("alerta")
    .select("id, cliente_id, tipo, mensagem, lido, criado_em")
    .order("criado_em", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "erro_ao_listar_alertas" }, { status: 500 });
  }

  return NextResponse.json({ alertas: data });
}
