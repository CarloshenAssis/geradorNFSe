import "server-only";

/**
 * Interface de provedor de consulta cadastral (item 1.2 do MD — CNPJTrack).
 * A URL base do provedor é configurável via env; este módulo não fixa um
 * fornecedor específico — quem instala o sistema aponta para o provedor
 * contratado (ex: um agregador de dados da Receita Federal).
 */
export interface SituacaoCadastral {
  situacao: string; // ex: "ATIVA", "SUSPENSA", "BAIXADA"
  consultadoEm: string;
}

export interface CnpjProvider {
  consultarSituacaoCadastral(cnpj: string): Promise<SituacaoCadastral>;
}

export class CnpjProviderError extends Error {}

class HttpCnpjProvider implements CnpjProvider {
  async consultarSituacaoCadastral(cnpj: string): Promise<SituacaoCadastral> {
    const baseUrl = process.env.CNPJ_PROVIDER_BASE_URL;
    const apiKey = process.env.CNPJ_PROVIDER_API_KEY;

    if (!baseUrl || !apiKey) {
      throw new CnpjProviderError(
        "CNPJ_PROVIDER_BASE_URL/CNPJ_PROVIDER_API_KEY não configurados — defina o provedor de consulta cadastral contratado."
      );
    }

    const response = await fetch(`${baseUrl}/${cnpj}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new CnpjProviderError(`falha_na_consulta_cadastral: status ${response.status}`);
    }

    const data = (await response.json()) as { situacao_cadastral?: string };
    if (!data.situacao_cadastral) {
      throw new CnpjProviderError("resposta_do_provedor_sem_situacao_cadastral");
    }

    return { situacao: data.situacao_cadastral, consultadoEm: new Date().toISOString() };
  }
}

export const cnpjProvider: CnpjProvider = new HttpCnpjProvider();
