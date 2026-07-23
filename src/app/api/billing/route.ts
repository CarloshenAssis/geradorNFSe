import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: saldo }, { data: transacoes }] = await Promise.all([
    supabase.from("saldo_credito").select("creditos_disponiveis, atualizado_em").eq("escritorio_id", ctx.escritorioId).maybeSingle(),
    supabase
      .from("transacao_pagamento")
      .select("id, tipo, valor, status, criado_em")
      .order("criado_em", { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({
    creditosDisponiveis: saldo?.creditos_disponiveis ?? 0,
    atualizadoEm: saldo?.atualizado_em ?? null,
    transacoes: transacoes ?? [],
  });
}
