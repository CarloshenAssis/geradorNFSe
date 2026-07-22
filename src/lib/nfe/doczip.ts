import { gunzipSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true });

/**
 * Cada `docZip` retornado pelo NFeDistribuicaoDFe vem em base64 + gzip.
 * Pode ser um `resNFe` (resumo) ou um `procNFe`/`nfeProc` (documento
 * completo), dependendo do que a SEFAZ decidiu te devolver para aquele NSU.
 */
export function decodificarDocZip(base64: string): unknown {
  const gz = Buffer.from(base64, "base64");
  const xml = gunzipSync(gz).toString("utf-8");
  return parser.parse(xml);
}
