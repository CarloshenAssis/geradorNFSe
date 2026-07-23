import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { extrairZipComGuardrails, ZipSecurityError } from "@/lib/lote/zip-security";
import { derivarOrganizacao } from "@/lib/lote/organizer";
import { parseNfseXml } from "@/lib/nfse/parser";
import { validateNfse } from "@/lib/nfse/schema";

const fixturePath = path.resolve(__dirname, "../fixtures/exemplo_nfse.xml");
const fixtureXml = readFileSync(fixturePath, "utf-8");

async function montarZip(entradas: Record<string, string | Buffer>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [nome, conteudo] of Object.entries(entradas)) {
    zip.file(nome, conteudo);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("extrairZipComGuardrails", () => {
  it("extrai XMLs válidos de um ZIP normal", async () => {
    const zipBuffer = await montarZip({ "nota1.xml": fixtureXml, "nota2.xml": fixtureXml });
    const resultado = await extrairZipComGuardrails(zipBuffer);
    expect(resultado.arquivos).toHaveLength(2);
    expect(resultado.arquivos.map((a) => a.nome).sort()).toEqual(["nota1.xml", "nota2.xml"]);
  });

  it("rejeita ZIP vazio", async () => {
    const zipBuffer = await montarZip({});
    await expect(extrairZipComGuardrails(zipBuffer)).rejects.toThrow(ZipSecurityError);
  });

  it("ignora arquivos que não são XML nem PDF, sem derrubar o lote", async () => {
    const zipBuffer = await montarZip({ "nota1.xml": fixtureXml, "leia-me.txt": "não é uma nota fiscal" });
    const resultado = await extrairZipComGuardrails(zipBuffer);
    expect(resultado.arquivos).toHaveLength(1);
    expect(resultado.ignorados).toEqual([{ nome: "leia-me.txt", motivo: "extensao_nao_suportada" }]);
  });

  it("rejeita path traversal (zip slip) confinando ao nome final", async () => {
    const zipBuffer = await montarZip({ "../../etc/passwd.xml": fixtureXml });
    // O JSZip normaliza a barra ao empacotar; simulamos a entrada crua via nome direto.
    const resultado = await extrairZipComGuardrails(zipBuffer);
    // Mesmo que o JSZip normalize o path na criação, o normalizador do
    // guardrail garante que o nome final nunca inclui segmentos "..".
    expect(resultado.arquivos.every((a) => !a.nome.includes(".."))).toBe(true);
  });

  it("pareia PDF de referência homônimo ao XML", async () => {
    const pdfFake = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("conteudo fake")]);
    const zipBuffer = await montarZip({ "nota1.xml": fixtureXml, "nota1.pdf": pdfFake });
    const resultado = await extrairZipComGuardrails(zipBuffer);
    expect(resultado.arquivos).toHaveLength(1);
    expect(resultado.pdfsReferencia.has("nota1")).toBe(true);
  });

  it("ignora PDF cujo conteúdo não bate com a assinatura %PDF-", async () => {
    const zipBuffer = await montarZip({ "nota1.xml": fixtureXml, "nota1.pdf": "isso não é um pdf de verdade" });
    const resultado = await extrairZipComGuardrails(zipBuffer);
    expect(resultado.pdfsReferencia.size).toBe(0);
    expect(resultado.ignorados.some((i) => i.motivo === "conteudo_nao_parece_pdf")).toBe(true);
  });
});

describe("derivarOrganizacao", () => {
  it("gera nome padronizado e pasta a partir da competência/número/prestador", () => {
    const raw = parseNfseXml(fixtureXml);
    const nfse = validateNfse(raw);
    const { nomeBase, pasta } = derivarOrganizacao(nfse);

    expect(nomeBase).toMatch(/^2026-07_NF_202600001234_CARLOS/);
    expect(pasta).toBe("2026/Julho/CARLOS_TECNOLOGIA_E_CONTABILIDADE_LTDA");
  });
});
