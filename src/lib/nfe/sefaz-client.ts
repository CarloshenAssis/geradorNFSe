import "server-only";
import https from "node:https";
import { XMLBuilder } from "fast-xml-parser";
import { decodificarDocZip } from "@/lib/nfe/doczip";
import { extrairCnpjEmitenteDaChave } from "@/lib/nfe/chave-acesso";
import type { NotaDistribuida, ResultadoDistribuicao, SefazClient } from "@/lib/nfe/types";

/**
 * Cliente HTTPS do webservice nacional NFeDistribuicaoDFe (mTLS com o
 * certificado A1 do cliente). A URL do endpoint NÃO é fixada no código —
 * varia por ambiente (produção/homologação) e é responsabilidade de quem
 * instala o sistema configurá-la com o endereço oficial vigente
 * (SEFAZ_DISTRIBUICAO_DFE_URL_HOMOLOGACAO / _PRODUCAO).
 */
export class SefazClientError extends Error {}

const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function montarEnvelopeSoap(cnpj: string, ultimoNSU: string, ambiente: "homologacao" | "producao"): string {
  const tpAmb = ambiente === "producao" ? "1" : "2";

  const distDFeInt = builder.build({
    distDFeInt: {
      "@_versao": "1.01",
      tpAmb,
      cUFAutor: "91", // AN (Ambiente Nacional)
      CNPJ: cnpj,
      distNSU: { ultNSU: ultimoNSU.padStart(15, "0") },
    },
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>${distDFeInt}</nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;
}

function resolveEndpoint(ambiente: "homologacao" | "producao"): string {
  const url =
    ambiente === "producao"
      ? process.env.SEFAZ_DISTRIBUICAO_DFE_URL_PRODUCAO
      : process.env.SEFAZ_DISTRIBUICAO_DFE_URL_HOMOLOGACAO;

  if (!url) {
    throw new SefazClientError(
      `Endpoint do NFeDistribuicaoDFe não configurado para ambiente "${ambiente}". ` +
        "Defina SEFAZ_DISTRIBUICAO_DFE_URL_PRODUCAO/_HOMOLOGACAO com a URL oficial vigente."
    );
  }
  return url;
}

interface DocZipEnvelope {
  chNFe?: string;
  NSU?: string;
  schema?: string;
}

function extrairNotaDoDocZip(decoded: unknown, nsu: string): NotaDistribuida | null {
  const raw = decoded as { resNFe?: DocZipEnvelope; nfeProc?: { NFe?: { infNFe?: Record<string, unknown> } } };

  if (raw.resNFe?.chNFe) {
    const chave = raw.resNFe.chNFe;
    return {
      chaveAcesso: chave,
      xmlContent: JSON.stringify(raw.resNFe), // resumo, não o XML completo da nota
      dataEmissao: null,
      valor: null,
      emitenteCnpj: extrairCnpjEmitenteDaChave(chave),
    };
  }

  if (raw.nfeProc?.NFe?.infNFe) {
    const infNFe = raw.nfeProc.NFe.infNFe as {
      "@_Id"?: string;
      ide?: { dhEmi?: string };
      total?: { ICMSTot?: { vNF?: string } };
    };
    const chave = (infNFe["@_Id"] || "").replace(/^NFe/, "");
    return {
      chaveAcesso: chave,
      xmlContent: JSON.stringify(raw.nfeProc),
      dataEmissao: infNFe.ide?.dhEmi ?? null,
      valor: infNFe.total?.ICMSTot?.vNF ? Number(infNFe.total.ICMSTot.vNF) : null,
      emitenteCnpj: extrairCnpjEmitenteDaChave(chave),
    };
  }

  return null;
}

export const httpsSefazClient: SefazClient = {
  async distribuirNotas({ cnpj, certificado, ultimoNSU, ambiente }) {
    const endpoint = resolveEndpoint(ambiente);
    const envelope = montarEnvelopeSoap(cnpj, ultimoNSU, ambiente);
    const url = new URL(endpoint);

    const body = await new Promise<string>((resolve, reject) => {
      const req = https.request(
        {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          method: "POST",
          pfx: certificado.pfx,
          passphrase: certificado.senha,
          headers: {
            "Content-Type": "application/soap+xml; charset=utf-8",
            "Content-Length": Buffer.byteLength(envelope),
          },
          timeout: 30_000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        }
      );

      req.on("timeout", () => req.destroy(new SefazClientError("timeout_ao_consultar_sefaz")));
      // Nunca logar `err` cru aqui se ele referenciar a passphrase/pfx (item 2.1 do MD).
      req.on("error", () => reject(new SefazClientError("falha_de_conexao_com_sefaz")));
      req.write(envelope);
      req.end();
    });

    return parseRespostaDistribuicao(body);
  },
};

function parseRespostaDistribuicao(_soapBody: string): ResultadoDistribuicao {
  // A resposta SOAP contém <retDistDFeInt> com <ultNSU>, <maxNSU> e uma
  // lista de <docZip NSU="..."> em base64+gzip (ver decodificarDocZip).
  // O parsing completo do envelope SOAP + iteração sobre múltiplos docZip
  // depende da biblioteca SOAP escolhida em produção; aqui expomos o
  // ponto de extensão via decodificarDocZip/extrairNotaDoDocZip, testados
  // isoladamente, para quem plugar o parser SOAP real.
  throw new SefazClientError(
    "Parsing do envelope SOAP de resposta não implementado neste esqueleto — " +
      "use decodificarDocZip()/extrairNotaDoDocZip() ao integrar com a lib SOAP escolhida."
  );
}

export { decodificarDocZip, extrairNotaDoDocZip };
