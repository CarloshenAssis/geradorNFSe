import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const clienteSchema = z.object({
  cnpj: z.string().regex(/^\d{14}$/, "CNPJ deve ter 14 dígitos numéricos"),
  razaoSocial: z.string().min(1).optional(),
});

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cliente")
    .select("id, cnpj, razao_social, ativo, criado_em")
    .order("criado_em", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "erro_ao_listar_clientes" }, { status: 500 });
  }

  return NextResponse.json({ clientes: data });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = clienteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "dados_invalidos", detalhe: parsed.error.issues }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cliente")
    .insert({
      escritorio_id: ctx.escritorioId,
      cnpj: parsed.data.cnpj,
      razao_social: parsed.data.razaoSocial ?? null,
    })
    .select("id, cnpj, razao_social, ativo, criado_em")
    .single();

  if (error) {
    const duplicado = error.code === "23505";
    return NextResponse.json(
      { error: duplicado ? "cliente_ja_cadastrado" : "erro_ao_criar_cliente", detalhe: error.message },
      { status: duplicado ? 409 : 500 }
    );
  }

  return NextResponse.json({ cliente: data }, { status: 201 });
}
