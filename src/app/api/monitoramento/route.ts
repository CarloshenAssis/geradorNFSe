import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: clientes, error } = await supabase
    .from("cliente")
    .select("id, cnpj, razao_social, ativo")
    .eq("ativo", true)
    .order("razao_social", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "erro_ao_listar_clientes" }, { status: 500 });
  }

  const clienteIds = (clientes ?? []).map((c) => c.id);
  const { data: monitoramentos } = clienteIds.length
    ? await supabase
        .from("monitoramento_cnpj")
        .select("cliente_id, situacao_cadastral, ultima_verificacao, proxima_obrigacao, proxima_obrigacao_data")
        .in("cliente_id", clienteIds)
    : { data: [] };

  const porCliente = new Map((monitoramentos ?? []).map((m) => [m.cliente_id, m]));

  const resultado = (clientes ?? []).map((cliente) => ({
    ...cliente,
    monitoramento: porCliente.get(cliente.id) ?? null,
  }));

  return NextResponse.json({ clientes: resultado });
}
