import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedJobRequest } from "@/lib/jobs/auth";
import { runMonitorCnpjJob } from "@/lib/monitor/job";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

async function handler(request: NextRequest) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: "nao_autorizado" }, { status: 401 });
  }

  try {
    const resumo = await runMonitorCnpjJob();
    logger.info("execução do monitor de cnpj concluída", { modulo: "monitor_cnpj", ...resumo });
    return NextResponse.json(resumo);
  } catch (err) {
    logger.error("falha na execução do monitor de cnpj", {
      modulo: "monitor_cnpj",
      erro: err instanceof Error ? err.message : "desconhecido",
    });
    return NextResponse.json({ error: "falha_na_execucao_do_job" }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
