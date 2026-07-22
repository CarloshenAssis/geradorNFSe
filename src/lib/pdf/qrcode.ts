import QRCode from "qrcode";

/**
 * QR Code de consulta pública da NFS-e (NT 008/2026, item 2.4.3): o manual
 * fixa o endereço "https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave="
 * acrescido da chave de acesso. A base é sobrescrevível por env apenas para
 * ambientes de homologação/testes que usem outro portal.
 */
const BASE_CONSULTA_OFICIAL = "https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=";

export async function gerarQrCodeConsulta(chaveAcesso: string): Promise<string> {
  const base = process.env.NFSE_CONSULTA_QRCODE_BASE_URL || BASE_CONSULTA_OFICIAL;
  const url = `${base}${chaveAcesso}`;

  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 180,
  });
}
