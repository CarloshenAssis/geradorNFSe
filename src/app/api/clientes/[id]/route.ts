import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  razaoSocial: z.string().min(1).optional(),
  ativo: z.boolean().optional(),
});

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cliente")
    .select("id, cnpj, razao_social, ativo, criado_em")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "cliente_nao_encontrado" }, { status: 404 });
  }

  return NextResponse.json({ cliente: data });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "dados_invalidos", detalhe: parsed.error.issues }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.razaoSocial !== undefined) update.razao_social = parsed.data.razaoSocial;
  if (parsed.data.ativo !== undefined) update.ativo = parsed.data.ativo;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cliente")
    .update(update)
    .eq("id", params.id)
    .select("id, cnpj, razao_social, ativo, criado_em")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "falha_ao_atualizar_cliente" }, { status: 500 });
  }

  return NextResponse.json({ cliente: data });
}
