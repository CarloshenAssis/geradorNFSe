import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedJobRequest } from "@/lib/jobs/auth";
import { runLoteRetencaoJob } from "@/lib/lote/retencao";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

async function handler(request: NextRequest) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: "nao_autorizado" }, { status: 401 });
  }

  try {
    const resumo = await runLoteRetencaoJob();
    logger.info("expurgo de retenção de lotes concluído", { modulo: "lote_retencao", ...resumo });
    return NextResponse.json(resumo);
  } catch (err) {
    logger.error("falha na execução do expurgo de lotes", {
      modulo: "lote_retencao",
      erro: err instanceof Error ? err.message : "desconhecido",
    });
    return NextResponse.json({ error: "falha_na_execucao_do_job" }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
