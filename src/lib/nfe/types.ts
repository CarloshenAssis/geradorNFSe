export interface CertificadoDecodificado {
  pfx: Buffer;
  senha: string;
}

export interface NotaDistribuida {
  chaveAcesso: string;
  xmlContent: string;
  dataEmissao: string | null;
  valor: number | null;
  emitenteCnpj: string | null;
}

export interface ResultadoDistribuicao {
  notas: NotaDistribuida[];
  ultimoNSU: string;
  maxNSU: string;
}

export interface SefazClient {
  /**
   * Consulta a distribuição de documentos fiscais (NFeDistribuicaoDFe) para
   * um CNPJ, a partir de um NSU (Número Sequencial Único), usando o
   * certificado A1 do cliente para mTLS junto ao webservice do SEFAZ/AN.
   */
  distribuirNotas(params: {
    cnpj: string;
    certificado: CertificadoDecodificado;
    ultimoNSU: string;
    ambiente: "homologacao" | "producao";
  }): Promise<ResultadoDistribuicao>;
}
