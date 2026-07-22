import type { NfseParsed } from "@/lib/nfse/schema";
import { codigos } from "@/lib/nfse/codigos";
import {
  escapeHtml,
  formatCep,
  formatCnpjOuCpf,
  formatData,
  formatDataHoraCompleta,
  formatMoeda,
} from "@/lib/nfse/sanitize";

export interface DanfseTemplateInput {
  nfse: NfseParsed;
  qrCodeDataUrl: string;
  /** Marca d'água diagonal (NT 008/2026, item 2.5): 'CANCELADA' | 'SUBSTITUÍDA'. */
  marcaDagua?: "CANCELADA" | "SUBSTITUÍDA" | null;
}

/**
 * Monta o HTML do DANFSe conforme o leiaute oficial da NT 008/2026 (SE/
 * CGNFS-e), Anexo I — Modelo de DANFSe. Regras seguidas:
 *  - blocos e ordem exatos do Anexo I;
 *  - campos sem informação no XML impressos com "-" (Nota 12);
 *  - blocos de Tomador/Intermediário/ISSQN suprimidos com a frase-padrão
 *    quando não identificados (item 2.3 / Notas 2 e 4);
 *  - cabeçalho com logo NFS-e, "DANFSe v2.0", município/ambiente do emitente
 *    e QR Code de consulta pública oficial (item 2.4.3);
 *  - TODO campo do XML é escapado antes de entrar no HTML (item 2.5 do MD).
 */

const TRACO = "-";

/** Valor escapado, ou "-" quando vazio (Nota 12). */
function ou(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return TRACO;
  return escapeHtml(value);
}

/** R$ formatado, ou "-" quando o valor não existe no XML. */
function moedaOu(value: number | null | undefined): string {
  if (value === null || value === undefined) return TRACO;
  return `R$ ${formatMoeda(value)}`;
}

function pctOu(value: number | null | undefined): string {
  if (value === null || value === undefined) return TRACO;
  return `${formatMoeda(value)}%`;
}

function enderecoLinha(end?: {
  xLgr: string;
  nro: string;
  xBairro: string;
  xMun: string;
  UF: string;
  CEP: string;
}): string {
  if (!end) return TRACO;
  const partes = [end.xLgr, end.nro, end.xBairro].filter(Boolean);
  return escapeHtml(partes.join(", "));
}

function municipioUf(xMun?: string, uf?: string): string {
  if (!xMun && !uf) return TRACO;
  return `${escapeHtml(xMun ?? "")}${uf ? ` / ${escapeHtml(uf)}` : ""}`;
}

export function renderDanfseHtml({ nfse, qrCodeDataUrl, marcaDagua }: DanfseTemplateInput): string {
  const infNFSe = nfse.NFSe.infNFSe;
  const infDPS = infNFSe.DPS.infDPS;
  const prest = infDPS.prest;
  const toma = infDPS.toma;
  const serv = infDPS.serv;
  const valoresDps = infDPS.valores;
  const valoresNfse = infNFSe.valores;
  const trib = valoresDps.trib;
  const tribMun = trib?.tribMun;
  const tribFed = trib?.tribFed;
  const ibscbs = trib?.IBSCBS;
  const g = ibscbs?.gIBSCBS;

  const semValidadeJuridica = infDPS.tpAmb === "2";

  // Valores IBS/CBS derivados (o exemplo traz os grupos, não os totais).
  const vIBSUF = g?.gIBSUF?.vIBSUF;
  const vIBSMun = g?.gIBSMun?.vIBSMun;
  const vCBS = g?.gCBS?.vCBS;
  const vIBSTot =
    vIBSUF !== undefined || vIBSMun !== undefined ? (vIBSUF ?? 0) + (vIBSMun ?? 0) : undefined;
  const totalIbsCbs =
    vIBSTot !== undefined || vCBS !== undefined ? (vIBSTot ?? 0) + (vCBS ?? 0) : undefined;
  const vLiqMaisIbsCbs =
    totalIbsCbs !== undefined ? valoresNfse.vLiq + totalIbsCbs : valoresNfse.vLiq;

  // Totais Aproximados dos Tributos (Nota 10 — linha obrigatória).
  const tot = trib?.totTrib;
  function totAproxSphere(v?: number, p?: number): string {
    if (v !== undefined) return `R$ ${formatMoeda(v)}`;
    if (p !== undefined) return `${formatMoeda(p)}%`;
    return TRACO;
  }
  const totaisAproximados =
    `Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: ` +
    `Federais: ${totAproxSphere(tot?.vTotTribFed, tot?.pTotTribFed ?? tot?.pTotTribSN)} ; ` +
    `Estaduais: ${totAproxSphere(tot?.vTotTribEst, tot?.pTotTribEst)} ; ` +
    `Municipais: ${totAproxSphere(tot?.vTotTribMun, tot?.pTotTribMun)}`;

  const infoComplementares = [serv.infoCompl?.xInfComp, totaisAproximados]
    .filter(Boolean)
    .map((linha) => escapeHtml(linha as string))
    .join("<br/>");

  const tomadorIdentificado = Boolean(toma);
  const issqnAplicavel = Boolean(tribMun);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4 portrait; margin: 6mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Microsoft Sans Serif", Arial, sans-serif;
    color: #000;
    margin: 0;
    font-size: 7pt;
    line-height: 1.15;
  }
  .doc { width: 100%; position: relative; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  td { border: 0.5pt solid #000; padding: 1.5pt 3pt; vertical-align: top; overflow: hidden; }
  .bloco-titulo td {
    font-family: Arial, sans-serif;
    font-weight: bold;
    font-size: 7pt;
    text-transform: uppercase;
    background: #f0f0f0;
    padding: 2pt 3pt;
  }
  .label {
    font-family: Arial, sans-serif;
    font-weight: bold;
    font-size: 6pt;
    display: block;
    margin-bottom: 0.5pt;
  }
  .val { font-size: 7pt; display: block; word-wrap: break-word; }
  .no-border-top td { border-top: none; }
  .header { display: flex; align-items: stretch; border: 0.5pt solid #000; margin-bottom: -0.5pt; }
  .header .logo { width: 22%; padding: 4pt; display: flex; align-items: center; border-right: 0.5pt solid #000; }
  .header .titulo {
    flex: 1;
    text-align: center;
    padding: 4pt;
    border-right: 0.5pt solid #000;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .header .titulo .t1 { font-family: Arial, sans-serif; font-weight: bold; font-size: 9pt; }
  .header .titulo .t2 { font-family: Arial, sans-serif; font-weight: bold; font-size: 9pt; }
  .header .titulo .sv { font-family: Arial, sans-serif; font-weight: bold; font-size: 9pt; color: #e10000; margin-top: 2pt; }
  .header .emit { width: 27%; padding: 4pt; font-size: 6pt; }
  .header .emit .mun { font-size: 8pt; margin-bottom: 1pt; }
  .header .qr { width: 20%; padding: 3pt; text-align: center; border-left: 0.5pt solid #000; }
  .header .qr img { width: 1.9cm; height: 1.9cm; }
  .header .qr .cmpl { font-size: 5.5pt; margin-top: 1pt; line-height: 1.05; }
  .chave { font-size: 8pt; letter-spacing: 0.5pt; word-break: break-all; }
  .descserv { min-height: 34pt; }
  .infocompl { min-height: 60pt; }
  .marca {
    position: absolute;
    top: 42%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-family: Arial, sans-serif;
    font-size: 50pt;
    color: rgba(0, 0, 0, 0.22);
    z-index: 10;
    pointer-events: none;
    white-space: nowrap;
  }
</style>
</head>
<body>
  <div class="doc">
    ${marcaDagua ? `<div class="marca">${escapeHtml(marcaDagua)}</div>` : ""}

    <!-- CABEÇALHO -->
    <div class="header">
      <div class="logo">
        <svg viewBox="0 0 120 40" width="100%" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="6" width="30" height="28" rx="4" fill="#1a7a3c" />
          <text x="15" y="26" font-family="Arial" font-size="15" font-weight="bold" fill="#fff" text-anchor="middle">NF</text>
          <text x="38" y="20" font-family="Arial" font-size="16" font-weight="bold" fill="#1a7a3c">NFS-e</text>
          <text x="38" y="31" font-family="Arial" font-size="6.5" fill="#333">Nota Fiscal de</text>
          <text x="38" y="38" font-family="Arial" font-size="6.5" fill="#333">Serviço eletrônica</text>
        </svg>
      </div>
      <div class="titulo">
        <span class="t1">DANFSe v2.0</span>
        <span class="t2">Documento Auxiliar da NFS-e</span>
        ${semValidadeJuridica ? `<span class="sv">NFS-e SEM VALIDADE JURÍDICA</span>` : ""}
      </div>
      <div class="emit">
        <div class="mun">${ou(infNFSe.xLocEmi)}</div>
        <div>Ambiente Gerador: ${ou(codigos.ambGer(infNFSe.ambGer))}</div>
        <div>Tipo de Ambiente: ${ou(codigos.tpAmb(infDPS.tpAmb))}</div>
      </div>
      <div class="qr">
        <img src="${qrCodeDataUrl}" alt="QR Code" />
        <div class="cmpl">A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e.</div>
      </div>
    </div>

    <!-- DADOS DA NFS-e -->
    <table>
      <tr class="bloco-titulo"><td colspan="3">Dados da NFS-e</td></tr>
      <tr>
        <td colspan="3"><span class="label">CHAVE DE ACESSO DA NFS-e</span><span class="val chave">${ou(infNFSe.chaveAcesso)}</span></td>
      </tr>
      <tr>
        <td style="width:33.34%"><span class="label">NÚMERO DA NFS-e</span><span class="val">${ou(infNFSe.nNFSe)}</span></td>
        <td style="width:33.33%"><span class="label">COMPETÊNCIA DA NFS-e</span><span class="val">${ou(formatData(infDPS.dCompet))}</span></td>
        <td style="width:33.33%"><span class="label">DATA E HORA DA EMISSÃO DA NFS-e</span><span class="val">${ou(formatDataHoraCompleta(infNFSe.dhProc))}</span></td>
      </tr>
      <tr>
        <td><span class="label">NÚMERO DA DPS</span><span class="val">${ou(infDPS.nDPS)}</span></td>
        <td><span class="label">SÉRIE DA DPS</span><span class="val">${ou(infDPS.serie)}</span></td>
        <td><span class="label">DATA E HORA DA EMISSÃO DA DPS</span><span class="val">${ou(formatDataHoraCompleta(infDPS.dhEmi))}</span></td>
      </tr>
      <tr>
        <td><span class="label">EMITENTE DA NFS-e</span><span class="val">${ou(codigos.tpEmit(infDPS.tpEmit))}</span></td>
        <td><span class="label">SITUAÇÃO DA NFS-e</span><span class="val">${ou(codigos.cStat(infNFSe.cStat))}</span></td>
        <td><span class="label">FINALIDADE</span><span class="val">${ou(codigos.finNFSe(infDPS.finNFSe))}</span></td>
      </tr>
    </table>

    <!-- PRESTADOR / FORNECEDOR -->
    <table class="no-border-top">
      <tr class="bloco-titulo"><td colspan="3">Prestador / Fornecedor da NFS-e</td></tr>
      <tr>
        <td style="width:33.34%"><span class="label">CNPJ / CPF / NIF</span><span class="val">${ou(formatCnpjOuCpf(prest.CNPJ ?? prest.CPF))}</span></td>
        <td style="width:33.33%"><span class="label">Inscrição Municipal</span><span class="val">${ou(prest.IM)}</span></td>
        <td style="width:33.33%"><span class="label">Telefone</span><span class="val">${ou(prest.fone)}</span></td>
      </tr>
      <tr>
        <td colspan="2"><span class="label">Nome / Nome Empresarial</span><span class="val">${ou(prest.xNome)}</span></td>
        <td><span class="label">Município / UF</span><span class="val">${municipioUf(prest.end?.xMun, prest.end?.UF)}</span></td>
      </tr>
      <tr>
        <td colspan="2"><span class="label">Endereço</span><span class="val">${enderecoLinha(prest.end)}</span></td>
        <td><span class="label">CEP</span><span class="val">${ou(formatCep(prest.end?.CEP))}</span></td>
      </tr>
      <tr>
        <td colspan="2"><span class="label">E-mail</span><span class="val">${ou(prest.email)}</span></td>
        <td><span class="label">Simples Nacional na Data de Competência</span><span class="val">${ou(codigos.opSimpNac(prest.regTrib?.opSimpNac))}</span></td>
      </tr>
      <tr>
        <td colspan="3"><span class="label">Regime de Apuração Tributária pelo SN</span><span class="val">${ou(codigos.regApTribSN(prest.regTrib?.regApTribSN))}</span></td>
      </tr>
    </table>

    <!-- TOMADOR / ADQUIRENTE -->
    <table class="no-border-top">
      <tr class="bloco-titulo"><td colspan="3">Tomador / Adquirente da Operação</td></tr>
      ${
        tomadorIdentificado
          ? `<tr>
        <td style="width:33.34%"><span class="label">CNPJ / CPF / NIF</span><span class="val">${ou(formatCnpjOuCpf(toma!.CNPJ ?? toma!.CPF))}</span></td>
        <td style="width:33.33%"><span class="label">Inscrição Municipal</span><span class="val">${ou(toma!.IM)}</span></td>
        <td style="width:33.33%"><span class="label">Telefone</span><span class="val">${ou(toma!.fone)}</span></td>
      </tr>
      <tr>
        <td colspan="2"><span class="label">Nome / Nome Empresarial</span><span class="val">${ou(toma!.xNome)}</span></td>
        <td><span class="label">Município / UF</span><span class="val">${municipioUf(toma!.end?.xMun, toma!.end?.UF)}</span></td>
      </tr>
      <tr>
        <td colspan="2"><span class="label">Endereço</span><span class="val">${enderecoLinha(toma!.end)}</span></td>
        <td><span class="label">CEP</span><span class="val">${ou(formatCep(toma!.end?.CEP))}</span></td>
      </tr>
      <tr>
        <td colspan="3"><span class="label">E-mail</span><span class="val">${ou(toma!.email)}</span></td>
      </tr>`
          : `<tr><td colspan="3"><span class="val">TOMADOR/ADQUIRENTE DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e</span></td></tr>`
      }
    </table>

    <!-- INTERMEDIÁRIO (não presente no leiaute simplificado) -->
    <table class="no-border-top">
      <tr class="bloco-titulo"><td>Intermediário da Operação</td></tr>
      <tr><td><span class="val">INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e</span></td></tr>
    </table>

    <!-- SERVIÇO PRESTADO -->
    <table class="no-border-top">
      <tr class="bloco-titulo"><td colspan="3">Serviço Prestado</td></tr>
      <tr>
        <td style="width:33.34%"><span class="label">Código de Tributação Nacional / Municipal</span><span class="val">${ou(
          serv.cServ.cTribMun ? `${serv.cServ.cTribNac} / ${serv.cServ.cTribMun}` : serv.cServ.cTribNac
        )}</span></td>
        <td style="width:33.33%"><span class="label">Código da NBS</span><span class="val">${ou(serv.cServ.cNBS)}</span></td>
        <td style="width:33.33%"><span class="label">Local da Prestação / UF / País</span><span class="val">${ou(infNFSe.xLocPrestacao)}</span></td>
      </tr>
      <tr>
        <td colspan="3"><span class="val">${ou(serv.cServ.xTribMun || serv.cServ.xTribNac)}</span></td>
      </tr>
      <tr>
        <td colspan="3" class="descserv"><span class="label">Descrição do Serviço</span><span class="val">${ou(serv.cServ.xDescServ)}${
          serv.xDiscr ? `<br/>${escapeHtml(serv.xDiscr)}` : ""
        }</span></td>
      </tr>
    </table>

    <!-- TRIBUTAÇÃO MUNICIPAL (ISSQN) -->
    <table class="no-border-top">
      <tr class="bloco-titulo"><td colspan="4">Tributação Municipal (ISSQN)</td></tr>
      ${
        issqnAplicavel
          ? `<tr>
        <td style="width:25%"><span class="label">Tipo de Tributação do ISSQN</span><span class="val">${ou(codigos.tribISSQN(tribMun!.tribISSQN))}</span></td>
        <td style="width:25%"><span class="label">Município / UF de Incidência do ISSQN</span><span class="val">${ou(infNFSe.xLocIncid)}</span></td>
        <td style="width:25%"><span class="label">BC ISSQN</span><span class="val">${moedaOu(valoresDps.vServPrest.vServ)}</span></td>
        <td style="width:25%"><span class="label">Alíquota Aplicada</span><span class="val">${pctOu(tribMun!.pAliq)}</span></td>
      </tr>
      <tr>
        <td><span class="label">Retenção do ISSQN</span><span class="val">${ou(codigos.tpRetISSQN(tribMun!.tpRetISSQN))}</span></td>
        <td><span class="label">ISSQN Apurado</span><span class="val">${moedaOu(valoresNfse.vISSQN)}</span></td>
        <td><span class="label">Total Deduções / Reduções</span><span class="val">${TRACO}</span></td>
        <td><span class="label">Desconto Incondicionado</span><span class="val">${moedaOu(valoresDps.vDescCondIncond?.vDescIncond)}</span></td>
      </tr>`
          : `<tr><td colspan="4"><span class="val">TRIBUTAÇÃO MUNICIPAL (ISSQN) - OPERAÇÃO NÃO SUJEITA AO ISSQN</span></td></tr>`
      }
    </table>

    <!-- TRIBUTAÇÃO FEDERAL (EXCETO CBS) -->
    <table class="no-border-top">
      <tr class="bloco-titulo"><td colspan="3">Tributação Federal (Exceto CBS)</td></tr>
      <tr>
        <td style="width:33.34%"><span class="label">IRRF</span><span class="val">${moedaOu(tribFed?.vRetIRRF)}</span></td>
        <td style="width:33.33%"><span class="label">Contribuição Previdenciária - Retida</span><span class="val">${moedaOu(tribFed?.vRetCP)}</span></td>
        <td style="width:33.33%"><span class="label">Contribuições Sociais - Retidas</span><span class="val">${moedaOu(tribFed?.vRetCSLL)}</span></td>
      </tr>
      <tr>
        <td><span class="label">PIS - Débito Apuração Própria</span><span class="val">${moedaOu(tribFed?.piscofins?.vPis)}</span></td>
        <td><span class="label">COFINS - Débito Apuração Própria</span><span class="val">${moedaOu(tribFed?.piscofins?.vCofins)}</span></td>
        <td><span class="label">Descrição Contrib. Sociais - Retidas</span><span class="val">${ou(tribFed?.piscofins?.tpRetPisCofins)}</span></td>
      </tr>
    </table>

    <!-- TRIBUTAÇÃO IBS / CBS -->
    <table class="no-border-top">
      <tr class="bloco-titulo"><td colspan="4">Tributação IBS / CBS</td></tr>
      <tr>
        <td style="width:25%"><span class="label">CST / cClassTrib</span><span class="val">${ou(
          ibscbs ? `${ibscbs.CST} / ${ibscbs.cClassTrib}` : undefined
        )}</span></td>
        <td style="width:25%"><span class="label">Base de Cálculo Após Exclusões e Reduções</span><span class="val">${moedaOu(g?.vBC)}</span></td>
        <td style="width:25%"><span class="label">Alíquota IBS UF / IBS Mun</span><span class="val">${
          g?.gIBSUF || g?.gIBSMun ? `${pctOu(g?.gIBSUF?.pIBSUF)} / ${pctOu(g?.gIBSMun?.pIBSMun)}` : TRACO
        }</span></td>
        <td style="width:25%"><span class="label">Alíquota CBS</span><span class="val">${pctOu(g?.gCBS?.pCBS)}</span></td>
      </tr>
      <tr>
        <td><span class="label">Valor Apurado Estadual - IBS</span><span class="val">${moedaOu(vIBSUF)}</span></td>
        <td><span class="label">Valor Apurado Municipal - IBS</span><span class="val">${moedaOu(vIBSMun)}</span></td>
        <td><span class="label">Valor Total Apurado - IBS</span><span class="val">${moedaOu(vIBSTot)}</span></td>
        <td><span class="label">Valor Total Apurado - CBS</span><span class="val">${moedaOu(vCBS)}</span></td>
      </tr>
    </table>

    <!-- VALOR TOTAL DA NFS-e -->
    <table class="no-border-top">
      <tr class="bloco-titulo"><td colspan="4">Valor Total da NFS-e</td></tr>
      <tr>
        <td style="width:25%"><span class="label">Valor da Operação / Serviço</span><span class="val">${moedaOu(valoresDps.vServPrest.vServ)}</span></td>
        <td style="width:25%"><span class="label">Desconto Incondicionado</span><span class="val">${moedaOu(valoresDps.vDescCondIncond?.vDescIncond)}</span></td>
        <td style="width:25%"><span class="label">Desconto Condicionado</span><span class="val">${moedaOu(valoresDps.vDescCondIncond?.vDescCond)}</span></td>
        <td style="width:25%"><span class="label">Total das Retenções (ISSQN / Federais)</span><span class="val">${moedaOu(valoresNfse.vTotalRet)}</span></td>
      </tr>
      <tr>
        <td><span class="label">Valor Líquido da NFS-e</span><span class="val">${moedaOu(valoresNfse.vLiq)}</span></td>
        <td><span class="label">Total do IBS / CBS</span><span class="val">${moedaOu(totalIbsCbs)}</span></td>
        <td colspan="2"><span class="label">Valor Líquido da NFS-e + IBS / CBS</span><span class="val">${moedaOu(vLiqMaisIbsCbs)}</span></td>
      </tr>
    </table>

    <!-- INFORMAÇÕES COMPLEMENTARES -->
    <table class="no-border-top">
      <tr class="bloco-titulo"><td>Informações Complementares</td></tr>
      <tr><td class="infocompl"><span class="val">${infoComplementares}</span></td></tr>
    </table>
  </div>
</body>
</html>`;
}
