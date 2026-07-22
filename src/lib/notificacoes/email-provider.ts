import "server-only";

/**
 * Interface de provedor de e-mail transacional (item 1.2/3.1 do MD:
 * Alertas/Notificações dispara e-mail/painel quando algo muda ou vence).
 * A implementação concreta (Resend, SES, Postmark etc.) é plugada via
 * EMAIL_PROVIDER_API_KEY — este módulo não assume qual provedor está por
 * trás para não fixar uma URL/API de terceiro que não foi configurada.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

class NoopEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    if (!process.env.EMAIL_PROVIDER_API_KEY) {
      console.warn(
        `[email] EMAIL_PROVIDER_API_KEY não configurado — e-mail para ${message.to} não enviado (modo noop).`
      );
      return;
    }
    // Ponto de extensão: plugar aqui o SDK do provedor escolhido, usando
    // EMAIL_PROVIDER_API_KEY / EMAIL_FROM. Mantido como noop até a escolha
    // do provedor ser definida, para não fixar uma integração não solicitada.
    console.info(`[email] envio simulado para ${message.to}: ${message.subject}`);
  }
}

export const emailProvider: EmailProvider = new NoopEmailProvider();
