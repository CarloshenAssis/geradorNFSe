import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: saldo }, { count: clientesAtivos }, { data: alertasRecentes }, { data: lotesRecentes }] = await Promise.all([
    supabase.from("saldo_credito").select("creditos_disponiveis").eq("escritorio_id", ctx.escritorioId).maybeSingle(),
    supabase.from("cliente").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase
      .from("alerta")
      .select("id, tipo, mensagem, lido, criado_em")
      .eq("lido", false)
      .order("criado_em", { ascending: false })
      .limit(5),
    supabase
      .from("lote_processamento")
      .select("id, status, quantidade_arquivos, quantidade_sucesso, quantidade_erro, criado_em")
      .order("criado_em", { ascending: false })
      .limit(5),
  ]);

  return NextResponse.json({
    creditosDisponiveis: saldo?.creditos_disponiveis ?? 0,
    clientesAtivos: clientesAtivos ?? 0,
    alertasRecentes: alertasRecentes ?? [],
    lotesRecentes: lotesRecentes ?? [],
  });
}
