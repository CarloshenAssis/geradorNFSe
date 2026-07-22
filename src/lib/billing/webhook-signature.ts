import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verificação de assinatura de webhook (item 2.6 do MD: evitar spoofing de
 * "pagamento confirmado"). Esquema HMAC-SHA256 genérico sobre o corpo cru
 * da requisição — se o gateway contratado usar um esquema próprio (ex:
 * Stripe assina com timestamp + tolerância), troque esta função pela
 * verificação oficial do SDK do gateway; nunca aceite o payload sem validar
 * contra o segredo configurado.
 */
export function verificarAssinaturaWebhook(rawBody: string, assinaturaRecebida: string | null, segredo: string): boolean {
  if (!assinaturaRecebida || !segredo) {
    return false;
  }

  const assinaturaEsperada = createHmac("sha256", segredo).update(rawBody).digest("hex");

  const bufferRecebido = Buffer.from(assinaturaRecebida);
  const bufferEsperado = Buffer.from(assinaturaEsperada);

  if (bufferRecebido.length !== bufferEsperado.length) {
    return false;
  }

  return timingSafeEqual(bufferRecebido, bufferEsperado);
}
