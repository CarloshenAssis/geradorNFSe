import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseNfseXml, XmlParseError } from "@/lib/nfse/parser";
import { validateNfse, NfseValidationError } from "@/lib/nfse/schema";
import { escapeHtml, formatCnpjOuCpf, formatMoeda } from "@/lib/nfse/sanitize";
import { renderDanfseHtml } from "@/lib/pdf/template";

const fixturePath = path.resolve(__dirname, "../fixtures/exemplo_nfse.xml");
const fixtureXml = readFileSync(fixturePath, "utf-8");

describe("parseNfseXml", () => {
  it("parseia o XML de exemplo sem erros", () => {
    const raw = parseNfseXml(fixtureXml);
    expect(raw).toBeTruthy();
  });

  it("rejeita XML malformado", () => {
    expect(() => parseNfseXml("<NFSe><infNFSe></NFSe>")).toThrow(XmlParseError);
  });

  it("rejeita XML com DOCTYPE", () => {
    const malicioso = `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><NFSe>&xxe;</NFSe>`;
    expect(() => parseNfseXml(malicioso)).toThrow(XmlParseError);
  });
});

describe("validateNfse", () => {
  it("valida estruturalmente o XML de exemplo e extrai os campos principais", () => {
    const raw = parseNfseXml(fixtureXml);
    const nfse = validateNfse(raw);

    expect(nfse.NFSe.infNFSe.chaveAcesso).toBe("35260714200166000187550010000012341000012341");
    expect(nfse.NFSe.infNFSe.nNFSe).toBe("202600001234");
    expect(nfse.NFSe.infNFSe.DPS.infDPS.prest.CNPJ).toBe("14200166000187");
    expect(nfse.NFSe.infNFSe.DPS.infDPS.toma.CNPJ).toBe("11222333000144");
    expect(nfse.NFSe.infNFSe.DPS.infDPS.valores.vServPrest.vServ).toBe(500);
    expect(nfse.NFSe.infNFSe.valores.vLiq).toBe(485);
  });

  it("rejeita XML sem o campo obrigatório chaveAcesso", () => {
    const raw = parseNfseXml(fixtureXml) as { NFSe: { infNFSe: Record<string, unknown> } };
    delete raw.NFSe.infNFSe.chaveAcesso;
    expect(() => validateNfse(raw)).toThrow(NfseValidationError);
  });

  it("rejeita tomador sem CNPJ nem CPF", () => {
    const raw = parseNfseXml(fixtureXml) as {
      NFSe: { infNFSe: { DPS: { infDPS: { toma: Record<string, unknown> } } } };
    };
    delete raw.NFSe.infNFSe.DPS.infDPS.toma.CNPJ;
    expect(() => validateNfse(raw)).toThrow(NfseValidationError);
  });
});

describe("sanitize", () => {
  it("escapa HTML/JS potencialmente malicioso", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
  });

  it("formata CNPJ e CPF", () => {
    expect(formatCnpjOuCpf("14200166000187")).toBe("14.200.166/0001-87");
    expect(formatCnpjOuCpf("12345678901")).toBe("123.456.789-01");
  });

  it("formata moeda em pt-BR", () => {
    expect(formatMoeda(1234.5)).toBe("1.234,50");
  });
});

describe("renderDanfseHtml", () => {
  it("renderiza o template sem lançar erro e escapa conteúdo do XML", () => {
    const raw = parseNfseXml(fixtureXml);
    const nfse = validateNfse(raw);
    const html = renderDanfseHtml({ nfse, qrCodeDataUrl: "data:image/png;base64,AAAA" });

    expect(html).toContain("DANFSe");
    expect(html).toContain(nfse.NFSe.infNFSe.chaveAcesso);
    expect(html).toContain("data:image/png;base64,AAAA");
  });

  it("nunca injeta HTML cru vindo de campos textuais do XML", () => {
    const raw = parseNfseXml(fixtureXml) as {
      NFSe: { infNFSe: { DPS: { infDPS: { serv: { xDiscr: string } } } } };
    };
    raw.NFSe.infNFSe.DPS.infDPS.serv.xDiscr = '<img src=x onerror="alert(1)">';
    const nfse = validateNfse(raw);
    const html = renderDanfseHtml({ nfse, qrCodeDataUrl: "data:image/png;base64,AAAA" });

    expect(html).not.toContain("<img src=x onerror");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});
