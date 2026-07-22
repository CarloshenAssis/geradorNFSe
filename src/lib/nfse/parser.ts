import { XMLParser, XMLValidator } from "fast-xml-parser";

/**
 * Erro de parsing/validação de XML — sempre 400 na API, nunca 500
 * (item 3.1 do MD: rejeitar XML malformado antes de qualquer processamento).
 */
export class XmlParseError extends Error {}

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  // Previne XXE / entity expansion (bilhão de risos): sem DOCTYPE, sem
  // resolução de entidades externas.
  processEntities: false,
  stopNodes: [],
};

/**
 * Faz o parse do XML da NFS-e para um objeto plano. Não confia em nada do
 * conteúdo — apenas garante que é XML bem formado. A validação estrutural
 * de negócio acontece em schema.ts (zod), como substituto leve de XSD.
 */
export function parseNfseXml(xml: string): unknown {
  if (xml.includes("<!DOCTYPE") || xml.includes("<!ENTITY")) {
    throw new XmlParseError("XML com DOCTYPE/ENTITY não é permitido");
  }

  const validation = XMLValidator.validate(xml, { allowBooleanAttributes: true });
  if (validation !== true) {
    throw new XmlParseError(`XML malformado: ${validation.err.msg} (linha ${validation.err.line})`);
  }

  const parser = new XMLParser(parserOptions);

  try {
    return parser.parse(xml, true);
  } catch (err) {
    throw new XmlParseError(`Falha ao interpretar XML: ${(err as Error).message}`);
  }
}
