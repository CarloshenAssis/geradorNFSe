import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth/context";
import { gerarDanfse, DanfseError } from "@/lib/danfse/service";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("xml");
  const clienteId = (formData?.get("clienteId") as string | null) || null;

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "arquivo_xml_obrigatorio" }, { status: 400 });
  }

  const xmlBuffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await gerarDanfse(ctx, xmlBuffer, clienteId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof DanfseError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logger.error("erro inesperado ao gerar danfse", {
      modulo: "danfse",
      escritorioId: ctx.escritorioId,
      erro: err instanceof Error ? err.message : "desconhecido",
    });
    return NextResponse.json({ error: "erro_interno" }, { status: 500 });
  }
}
