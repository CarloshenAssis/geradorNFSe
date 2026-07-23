import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createLoteSignedUrl } from "@/lib/lote/storage";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
// Teto real no plano Hobby é 60s; processarProximoChunk respeita um
// orçamento interno de tempo (ORCAMENTO_TEMPO_MS) bem abaixo disso.
export const maxDuration = 60;

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();

  try {
    // Import dinâmico dentro do try (ver comentário equivalente em
    // /api/lotes/route.ts): garante que uma falha de carregamento de
    // qualquer dependência transitiva vira uma exceção capturável, não uma
    // rota inteira quebrada sem chance de resposta em JSON.
    const { processarProximoChunk } = await import("@/lib/lote/service");
    // Cada consulta de status avança o processamento em um bloco — é o
    // "worker cooperativo" descrito em lib/lote/service.ts.
    await processarProximoChunk(supabase, ctx, params.id);
  } catch (err) {
    const detalhe = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    logger.error("erro ao avançar processamento do lote", {
      modulo: "lote",
      loteId: params.id,
      erro: detalhe,
      stack: err instanceof Error ? err.stack : undefined,
    });
    // Não falha a consulta de status por causa de um erro pontual de
    // avanço — o usuário ainda deve ver o estado atual do lote (a menos
    // que o lote realmente não exista, tratado abaixo pela query direta).
  }

  const { data: lote, error: loteError } = await supabase
    .from("lote_processamento")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (loteError || !lote) {
    return NextResponse.json({ error: "lote_nao_encontrado" }, { status: 404 });
  }

  const { data: itens } = await supabase
    .from("lote_item")
    .select("id, nome_arquivo_original, nome_arquivo_padronizado, pasta_padronizada, status, erro_detalhe, danfse_pdf_storage_ref")
    .eq("lote_id", params.id)
    .order("criado_em", { ascending: true });

  const { data: exports } = await supabase
    .from("export_gerado")
    .select("id, tipo, storage_ref")
    .eq("lote_id", params.id);

  const { data: relatorio } = await supabase
    .from("relatorio_consolidado")
    .select("*")
    .eq("lote_id", params.id)
    .maybeSingle();

  const exportsComUrl = await Promise.all(
    (exports ?? []).map(async (exp) => ({
      tipo: exp.tipo,
      url: await createLoteSignedUrl(exp.storage_ref).catch(() => null),
    }))
  );

  const itensComUrl = await Promise.all(
    (itens ?? []).map(async (item) => ({
      id: item.id,
      nomeArquivoOriginal: item.nome_arquivo_original,
      nomeArquivoPadronizado: item.nome_arquivo_padronizado,
      pasta: item.pasta_padronizada,
      status: item.status,
      erroDetalhe: item.erro_detalhe,
      pdfUrl: item.danfse_pdf_storage_ref
        ? await createLoteSignedUrl(item.danfse_pdf_storage_ref).catch(() => null)
        : null,
    }))
  );

  return NextResponse.json({
    lote,
    itens: itensComUrl,
    exports: exportsComUrl,
    relatorio,
  });
}
