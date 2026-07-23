import { LOGO_NFSE_PNG_DATA_URI } from "@/lib/pdf/logo-data";

/**
 * Logo oficial da NFS-e (NT 008/2026, item 2.4.3 — logomarca no canto
 * esquerdo do cabeçalho).
 *
 * O padrão é o PNG oficial embutido em logo-data.ts (bytes extraídos do
 * próprio manual da NT 008/2026). A variável DANFSE_LOGO_DATA_URI permite
 * sobrescrevê-lo sem deploy, mas normalmente não é necessária — e o data
 * URI completo excede o limite de 64KB de variáveis de ambiente na Vercel,
 * então só use com imagens pequenas.
 */
export function getLogoNfseMarkup(): string {
  const override = process.env.DANFSE_LOGO_DATA_URI;
  const dataUri = override && /^data:image\//.test(override) ? override : LOGO_NFSE_PNG_DATA_URI;
  return `<img src="${dataUri}" alt="NFS-e" style="width:100%;height:auto;" />`;
}
