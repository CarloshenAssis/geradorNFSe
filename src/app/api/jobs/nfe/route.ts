import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedJobRequest } from "@/lib/jobs/auth";
import { runMotorNfeJob } from "@/lib/nfe/job";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

async function handler(request: NextRequest) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: "nao_autorizado" }, { status: 401 });
  }

  try {
    const resumo = await runMotorNfeJob();
    logger.info("execução do motor nf-e concluída", { modulo: "motor_nfe", ...resumo });
    return NextResponse.json(resumo);
  } catch (err) {
    logger.error("falha na execução do motor nf-e", {
      modulo: "motor_nfe",
      erro: err instanceof Error ? err.message : "desconhecido",
    });
    return NextResponse.json({ error: "falha_na_execucao_do_job" }, { status: 500 });
  }
}

// Vercel Cron só envia GET; POST é aceito também para disparo manual/outros schedulers.
export const GET = handler;
export const POST = handler;
