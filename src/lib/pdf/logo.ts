/**
 * Logo oficial da NFS-e (NT 008/2026, item 2.4.3 — logomarca no canto
 * esquerdo do cabeçalho). Fonte oficial:
 *   https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/logos-da-nfs-e/
 *
 * Este é o PADRÃO único usado no DANFSe. Se preferir cravar o PNG oficial
 * pixel-a-pixel, defina a variável de ambiente DANFSE_LOGO_DATA_URI com o
 * data URI (base64) do arquivo "Logo - NFS-e - Horizontal.png" — quando
 * presente, ele é usado no lugar deste SVG (ver getLogoNfseMarkup).
 *
 * SVG replicando a logo horizontal: wordmark "NFSe" ("NFS" em azul, "e" e
 * traço em verde) + subtítulo "Nota Fiscal de / Serviço Eletrônica".
 */
export const LOGO_NFSE_SVG = `<svg viewBox="0 0 320 80" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="NFS-e">
  <text x="0" y="54" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="bold" letter-spacing="-3" fill="#1f3f77">NFS</text>
  <text x="126" y="54" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="bold" fill="#4e9d2d">e</text>
  <path d="M120 60 C 140 73, 162 73, 176 58" stroke="#4e9d2d" stroke-width="7" fill="none" stroke-linecap="round"/>
  <text x="192" y="35" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#6b6b6b">Nota Fiscal de</text>
  <text x="192" y="55" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#6b6b6b">Serviço Eletrônica</text>
</svg>`;

/**
 * Retorna o markup da logo para o cabeçalho: o PNG oficial (data URI) quando
 * DANFSE_LOGO_DATA_URI está configurado, senão o SVG padrão acima.
 */
export function getLogoNfseMarkup(): string {
  const dataUri = process.env.DANFSE_LOGO_DATA_URI;
  if (dataUri && /^data:image\//.test(dataUri)) {
    return `<img src="${dataUri}" alt="NFS-e" style="width:100%;height:auto;" />`;
  }
  return LOGO_NFSE_SVG;
}
