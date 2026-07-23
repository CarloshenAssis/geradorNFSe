import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import { env } from "@/lib/env";

export const runtime = "nodejs";
// O plano Hobby da Vercel ignora valores maiores e mata a função em 60s —
// por isso esta rota só cria o lote (I/O rápido), sem renderizar PDF. O
// processamento pesado roda em chunks pequenos via polling de GET /[id].
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("zip");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "arquivo_zip_obrigatorio" }, { status: 400 });
  }

  const zipBuffer = Buffer.from(await file.arrayBuffer());

  try {
    const supabase = await createSupabaseServerClient();
    // Import dinâmico dentro do try: se qualquer dependência transitiva do
    // módulo de lote (jszip, exceljs, pdf-parse, puppeteer...) falhar ao
    // carregar em runtime serverless, um `import` estático no topo do
    // arquivo quebraria a rota inteira ANTES do handler rodar — sem chance
    // de captura. Com import dinâmico, a falha vira uma exceção normal,
    // capturada abaixo e devolvida como JSON com a causa real.
    const { criarLote, LoteError } = await import("@/lib/lote/service");

    const { loteId, ignorados } = await criarLote(supabase, ctx, zipBuffer);
    // Não processa nada pesado aqui (render de PDF) — o frontend começa a
    // consultar GET /api/lotes/[id] imediatamente após receber o loteId,
    // e cada consulta avança um chunk pequeno (ver lib/lote/service.ts).
    return NextResponse.json({ loteId, ignorados }, { status: 201 });
  } catch (err) {
    const { LoteError } = await import("@/lib/lote/service").catch(() => ({ LoteError: undefined }));
    if (LoteError && err instanceof LoteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const detalhe = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    logger.error("erro inesperado ao criar lote", {
      modulo: "lote",
      escritorioId: ctx.escritorioId,
      erro: detalhe,
      stack: err instanceof Error ? err.stack : undefined,
    });
    // Inclui o detalhe do erro na resposta (ferramenta interna, ainda em
    // ajuste fino) — facilita diagnosticar sem depender de acesso aos
    // logs de runtime da Vercel.
    return NextResponse.json({ error: "erro_interno", detalhe }, { status: 500 });
  }
}

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lote_processamento")
    .select("id, status, quantidade_arquivos, quantidade_processados, quantidade_sucesso, quantidade_erro, criado_em, finalizado_em, expira_em")
    .order("criado_em", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "erro_ao_listar_lotes" }, { status: 500 });
  }

  return NextResponse.json({ lotes: data, retencaoDias: env.loteRetencaoDias });
}
