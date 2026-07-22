import QRCode from "qrcode";

/**
 * Gera o QR Code apontando para a URL de consulta nacional (item 1.3 do MD).
 * A base da URL é configurável via env — este código nunca fixa um domínio
 * de consulta "adivinhado"; quem instala o sistema aponta para a URL oficial
 * vigente da consulta nacional de NFS-e.
 */
export async function gerarQrCodeConsulta(chaveAcesso: string): Promise<string> {
  const base = process.env.NFSE_CONSULTA_QRCODE_BASE_URL;
  const url = base ? `${base}${base.includes("?") ? "&" : "?"}chNFSe=${encodeURIComponent(chaveAcesso)}` : chaveAcesso;

  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 180,
  });
}
