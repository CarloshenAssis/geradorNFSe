import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verificarAssinaturaWebhook } from "@/lib/billing/webhook-signature";
import { confirmarPagamento } from "@/lib/billing/service";
import { env } from "@/lib/env";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";

const eventoSchema = z.object({
  escritorioId: z.string().uuid(),
  gatewayRef: z.string().min(1),
  valor: z.coerce.number().positive(),
  tipo: z.enum(["assinatura", "credito_avulso"]),
  creditos: z.coerce.number().int().nonnegative().optional(),
  planoId: z.string().uuid().optional(),
});

/**
 * Webhook do gateway de pagamento (item 2.6 do MD). O sistema nunca toca em
 * dado de cartão — só recebe a confirmação assinada de que um checkout
 * hospedado (Stripe/Pagar.me/Mercado Pago) foi concluído.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const assinatura = request.headers.get("x-webhook-signature");

  if (!verificarAssinaturaWebhook(rawBody, assinatura, env.paymentGatewayWebhookSecret)) {
    return NextResponse.json({ error: "assinatura_invalida" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "payload_invalido" }, { status: 400 });
  }

  const parsed = eventoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "payload_invalido" }, { status: 400 });
  }

  try {
    const resultado = await confirmarPagamento(parsed.data);
    logger.info("pagamento confirmado", {
      modulo: "billing",
      escritorioId: parsed.data.escritorioId,
      jaProcessado: resultado.jaProcessado,
    });
    return NextResponse.json(resultado);
  } catch (err) {
    logger.error("falha ao confirmar pagamento", {
      modulo: "billing",
      escritorioId: parsed.data.escritorioId,
      erro: err instanceof Error ? err.message : "desconhecido",
    });
    return NextResponse.json({ error: "erro_interno" }, { status: 500 });
  }
}
