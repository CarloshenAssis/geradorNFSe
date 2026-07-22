import type { NfseParsed } from "@/lib/nfse/schema";
import { codigos } from "@/lib/nfse/codigos";
import { getLogoNfseMarkup } from "@/lib/pdf/logo";
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
 * CGNFS-e), Anexo I — Modelo de DANFSe.
 *
 * Regra estrutural do modelo: os campos DENTRO de cada bloco não têm linhas
 * divisórias entre si; as linhas divisórias (0,5pt) existem apenas ENTRE os
 * blocos. O título de cada bloco é uma célula em destaque no início da
 * primeira linha do bloco.
 *
 * Demais regras:
 *  - campos sem informação no XML impressos com "-" (Nota 12);
 *  - blocos de Tomador/Intermediário/ISSQN suprimidos com a frase-padrão
 *    quando não identificados/aplicáveis (item 2.3, Notas 2 e 4);
 *  - cabeçalho com logo NFS-e, "DANFSe v2.0", município/ambiente do emitente
 *    e QR Code de consulta pública oficial (item 2.4.3);
 *  - TODO campo do XML é escapado antes de entrar no HTML (item 2.5 do MD).
 */

const TRACO = "-";

function ou(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return TRACO;
  return escapeHtml(value);
}

function moedaOu(value: number | null | undefined): string {
  if (value === null || value === undefined) return TRACO;
  return `R$ ${formatMoeda(value)}`;
}

function pctOu(value: number | null | undefined): string {
  if (value === null || value === undefined) return TRACO;
  return `${formatMoeda(value)}%`;
}

/** Célula de campo: rótulo em cima, valor embaixo. `flex` = quantas colunas ocupa. */
function campo(label: string, valor: string, flex = 1): string {
  return `<div class="c" style="flex:${flex}"><span class="lbl">${label}</span><span class="val">${valor}</span></div>`;
}

/** Célula de campo com rótulo em destaque (caixa alta), p/ valores totais. */
function campoB(label: string, valor: string, flex = 1): string {
  return `<div class="c" style="flex:${flex}"><span class="lbl lbl-b">${label}</span><span class="val">${valor}</span></div>`;
}

function enderecoLinha(end?: {
  xLgr: string;
  nro: string;
  xBairro: string;
}): string {
  if (!end) return TRACO;
  const partes = [end.xLgr, end.nro, end.xBairro].filter(Boolean);
  return escapeHtml(partes.join(", "));
}

function municipioUf(xMun?: string, uf?: string): string {
  if (!xMun && !uf) return TRACO;
  return `${escapeHtml(xMun ?? "")}${uf ? ` / ${escapeHtml(uf)}` : ""}`;
}

function ibgeCep(cMun?: string, cep?: string): string {
  if (!cMun && !cep) return TRACO;
  return `${escapeHtml(cMun ?? "")}${cep ? ` / ${escapeHtml(formatCep(cep))}` : ""}`;
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

  const vIBSUF = g?.gIBSUF?.vIBSUF;
  const vIBSMun = g?.gIBSMun?.vIBSMun;
  const vCBS = g?.gCBS?.vCBS;
  const vIBSTot =
    vIBSUF !== undefined || vIBSMun !== undefined ? (vIBSUF ?? 0) + (vIBSMun ?? 0) : undefined;
  const totalIbsCbs =
    vIBSTot !== undefined || vCBS !== undefined ? (vIBSTot ?? 0) + (vCBS ?? 0) : undefined;
  const vLiqMaisIbsCbs =
    totalIbsCbs !== undefined ? valoresNfse.vLiq + totalIbsCbs : valoresNfse.vLiq;

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

  const emitenteUf = prest.end?.UF;

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

  /* CABEÇALHO */
  .header { display: flex; align-items: stretch; border: 0.5pt solid #000; }
  .header .logo { width: 22%; padding: 5pt 6pt; display: flex; align-items: center; border-right: 0.5pt solid #000; }
  .header .titulo {
    flex: 1; text-align: center; padding: 5pt; border-right: 0.5pt solid #000;
    display: flex; flex-direction: column; justify-content: center;
  }
  .header .titulo .t1, .header .titulo .t2 { font-family: Arial, sans-serif; font-weight: bold; font-size: 9pt; }
  .header .titulo .sv { font-family: Arial, sans-serif; font-weight: bold; font-size: 9pt; color: #e10000; margin-top: 2pt; }
  .header .emit { width: 27%; padding: 5pt 6pt; font-size: 6pt; line-height: 1.4; }
  .header .emit .mun { font-size: 7pt; }

  /* CORPO — caixa única; blocos separados só por linha horizontal */
  .corpo { border: 0.5pt solid #000; border-top: none; }
  .bloco { border-top: 0.5pt solid #000; }
  .bloco:first-child { border-top: none; }
  .linha { display: flex; }
  .c { flex: 1; padding: 1.5pt 5pt; overflow: hidden; }
  .lbl { font-family: Arial, sans-serif; font-weight: bold; font-size: 6pt; display: block; margin-bottom: 0.5pt; }
  .lbl-b { font-size: 7pt; text-transform: uppercase; }
  .lbl-id { font-family: Arial, sans-serif; font-weight: bold; font-size: 7pt; text-transform: uppercase; display: block; margin-bottom: 1pt; }
  .val { font-size: 7pt; display: block; word-wrap: break-word; }
  .chave { font-size: 8pt; letter-spacing: 0.5pt; word-break: break-all; }

  /* Título de bloco: célula em destaque no início da 1ª linha */
  .tt {
    font-family: Arial, sans-serif; font-weight: bold; font-size: 7pt; text-transform: uppercase;
    background: #e6e6e6; padding: 2.5pt 5pt; display: flex; align-items: center;
  }
  /* Título de bloco em barra cheia (blocos sem campos na linha do título) */
  .tt-full {
    font-family: Arial, sans-serif; font-weight: bold; font-size: 7pt; text-transform: uppercase;
    background: #e6e6e6; padding: 2.5pt 5pt;
  }

  /* DADOS DA NFS-e (com QR à direita) */
  .ident { display: flex; }
  .ident .campos { flex: 1; }
  .ident .qr { width: 22%; padding: 4pt; text-align: center; border-left: 0.5pt solid #000; display: flex; flex-direction: column; align-items: center; }
  .ident .qr img { width: 2.0cm; height: 2.0cm; }
  .ident .qr .cmpl { font-size: 5.5pt; margin-top: 2pt; line-height: 1.1; text-align: center; }

  .descserv .val { min-height: 30pt; }
  .infocompl .val { min-height: 44pt; }
  .canhoto .c { min-height: 26pt; }

  .marca {
    position: absolute; top: 42%; left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-family: Arial, sans-serif; font-size: 50pt; color: rgba(0, 0, 0, 0.22);
    z-index: 10; pointer-events: none; white-space: nowrap;
  }
</style>
</head>
<body>
  <div class="doc">
    ${marcaDagua ? `<div class="marca">${escapeHtml(marcaDagua)}</div>` : ""}

    <!-- CABEÇALHO -->
    <div class="header">
      <div class="logo">${getLogoNfseMarkup()}</div>
      <div class="titulo">
        <span class="t1">DANFSe v2.0</span>
        <span class="t2">Documento Auxiliar da NFS-e</span>
        ${semValidadeJuridica ? `<span class="sv">NFS-e SEM VALIDADE JURÍDICA</span>` : ""}
      </div>
      <div class="emit">
        <div class="mun">Município: ${ou(municipioUf(infNFSe.xLocEmi, emitenteUf))}</div>
        <div>Ambiente Gerador: ${ou(codigos.ambGer(infNFSe.ambGer))}</div>
        <div>Tipo de Ambiente: ${ou(codigos.tpAmb(infDPS.tpAmb))}</div>
      </div>
    </div>

    <div class="corpo">
      <!-- DADOS DA NFS-e (sem divisões internas; QR à direita) -->
      <div class="bloco">
        <div class="ident">
          <div class="campos">
            <div class="linha">
              <div class="c"><span class="lbl-id">Chave de Acesso da NFS-e</span><span class="val chave">${ou(infNFSe.chaveAcesso)}</span></div>
            </div>
            <div class="linha">
              <div class="c"><span class="lbl-id">Número da NFS-e</span><span class="val">${ou(infNFSe.nNFSe)}</span></div>
              <div class="c"><span class="lbl-id">Competência da NFS-e</span><span class="val">${ou(formatData(infDPS.dCompet))}</span></div>
              <div class="c"><span class="lbl-id">Data e Hora da Emissão da NFS-e</span><span class="val">${ou(formatDataHoraCompleta(infNFSe.dhProc))}</span></div>
            </div>
            <div class="linha">
              <div class="c"><span class="lbl-id">Número da DPS</span><span class="val">${ou(infDPS.nDPS)}</span></div>
              <div class="c"><span class="lbl-id">Série da DPS</span><span class="val">${ou(infDPS.serie)}</span></div>
              <div class="c"><span class="lbl-id">Data e Hora da Emissão da DPS</span><span class="val">${ou(formatDataHoraCompleta(infDPS.dhEmi))}</span></div>
            </div>
            <div class="linha">
              <div class="c"><span class="lbl-id">Emitente da NFS-e</span><span class="val">${ou(codigos.tpEmit(infDPS.tpEmit))}</span></div>
              <div class="c"><span class="lbl-id">Situação da NFS-e</span><span class="val">${ou(codigos.cStat(infNFSe.cStat))}</span></div>
              <div class="c"><span class="lbl-id">Finalidade</span><span class="val">${ou(codigos.finNFSe(infDPS.finNFSe))}</span></div>
            </div>
          </div>
          <div class="qr">
            <img src="${qrCodeDataUrl}" alt="QR Code" />
            <div class="cmpl">A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e.</div>
          </div>
        </div>
      </div>

      <!-- PRESTADOR / FORNECEDOR -->
      <div class="bloco">
        <div class="linha">
          <div class="tt" style="flex:1">Prestador / Fornecedor</div>
          ${campo("CNPJ / CPF / NIF", ou(formatCnpjOuCpf(prest.CNPJ ?? prest.CPF)))}
          ${campo("Indicador Municipal (Inscrição)", ou(prest.IM))}
          ${campo("Telefone", ou(prest.fone))}
        </div>
        <div class="linha">
          ${campo("Nome / Nome Empresarial", ou(prest.xNome), 2)}
          ${campo("Município / Sigla UF", municipioUf(prest.end?.xMun, prest.end?.UF))}
          ${campo("Código IBGE / CEP", ibgeCep(prest.end?.cMun, prest.end?.CEP))}
        </div>
        <div class="linha">
          ${campo("Endereço", enderecoLinha(prest.end), 2)}
          ${campo("E-mail", ou(prest.email), 2)}
        </div>
        <div class="linha">
          ${campo("Simples Nacional na Data de Competência", ou(codigos.opSimpNac(prest.regTrib?.opSimpNac)), 2)}
          ${campo("Regime de Apuração Tributária pelo SN", ou(codigos.regApTribSN(prest.regTrib?.regApTribSN)), 2)}
        </div>
      </div>

      <!-- TOMADOR / ADQUIRENTE -->
      <div class="bloco">
        ${
          tomadorIdentificado
            ? `<div class="linha">
          <div class="tt" style="flex:1">Tomador / Adquirente</div>
          ${campo("CNPJ / CPF / NIF", ou(formatCnpjOuCpf(toma!.CNPJ ?? toma!.CPF)))}
          ${campo("Indicador Municipal (Inscrição)", ou(toma!.IM))}
          ${campo("Telefone", ou(toma!.fone))}
        </div>
        <div class="linha">
          ${campo("Nome / Nome Empresarial", ou(toma!.xNome), 2)}
          ${campo("Município / Sigla UF", municipioUf(toma!.end?.xMun, toma!.end?.UF))}
          ${campo("Código IBGE / CEP", ibgeCep(toma!.end?.cMun, toma!.end?.CEP))}
        </div>
        <div class="linha">
          ${campo("Endereço", enderecoLinha(toma!.end), 2)}
          ${campo("E-mail", ou(toma!.email), 2)}
        </div>`
            : `<div class="linha"><div class="tt" style="flex:1">Tomador / Adquirente</div><div class="c" style="flex:3"><span class="val">TOMADOR/ADQUIRENTE DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e</span></div></div>`
        }
      </div>

      <!-- DESTINATÁRIO DA OPERAÇÃO -->
      <div class="bloco">
        <div class="linha"><div class="tt" style="flex:1">Destinatário da Operação</div><div class="c" style="flex:3"><span class="val">${
          tomadorIdentificado
            ? "O DESTINATÁRIO É O PRÓPRIO TOMADOR/ADQUIRENTE DA OPERAÇÃO"
            : "DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e"
        }</span></div></div>
      </div>

      <!-- INTERMEDIÁRIO -->
      <div class="bloco">
        <div class="linha"><div class="tt" style="flex:1">Intermediário da Operação</div><div class="c" style="flex:3"><span class="val">INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e</span></div></div>
      </div>

      <!-- SERVIÇO PRESTADO -->
      <div class="bloco">
        <div class="linha">
          <div class="tt" style="flex:1">Serviço Prestado</div>
          ${campo(
            "Código de Tributação Nacional / Municipal",
            ou(serv.cServ.cTribMun ? `${serv.cServ.cTribNac} / ${serv.cServ.cTribMun}` : serv.cServ.cTribNac)
          )}
          ${campo("Código da NBS", ou(serv.cServ.cNBS))}
          ${campo("Local da Prestação / Sigla UF / País", ou(infNFSe.xLocPrestacao))}
        </div>
        <div class="linha">
          <div class="c" style="flex:1"><span class="val">${ou(serv.cServ.xTribMun || serv.cServ.xTribNac)}</span></div>
        </div>
        <div class="linha descserv">
          <div class="c" style="flex:1"><span class="lbl">Descrição do Serviço</span><span class="val">${ou(serv.cServ.xDescServ)}${
            serv.xDiscr ? `<br/>${escapeHtml(serv.xDiscr)}` : ""
          }</span></div>
        </div>
      </div>

      <!-- TRIBUTAÇÃO MUNICIPAL (ISSQN) -->
      <div class="bloco">
        ${
          issqnAplicavel
            ? `<div class="linha">
          <div class="tt" style="flex:1">Tributação Municipal (ISSQN)</div>
          ${campo("Tipo de Tributação do ISSQN", ou(codigos.tribISSQN(tribMun!.tribISSQN)))}
          ${campo("Município / Sigla UF / País de Incidência do ISSQN", ou(infNFSe.xLocIncid), 2)}
        </div>
        <div class="linha">
          ${campo("Regime Especial de Tributação do ISSQN", TRACO)}
          ${campo("Tipo de Imunidade do ISSQN", TRACO)}
          ${campo("Suspensão da Exigibilidade do ISSQN", TRACO)}
          ${campo("Número Processo Suspensão", TRACO)}
        </div>
        <div class="linha">
          ${campo("Benefício Municipal", TRACO)}
          ${campo("Cálculo do BM", TRACO)}
          ${campo("Total Deduções / Reduções", TRACO)}
          ${campo("Desconto Incondicionado", moedaOu(valoresDps.vDescCondIncond?.vDescIncond))}
        </div>
        <div class="linha">
          ${campo("BC ISSQN", moedaOu(valoresDps.vServPrest.vServ))}
          ${campo("Alíquota Aplicada", pctOu(tribMun!.pAliq))}
          ${campo("Retenção do ISSQN", ou(codigos.tpRetISSQN(tribMun!.tpRetISSQN)))}
          ${campo("ISSQN Apurado", moedaOu(valoresNfse.vISSQN))}
        </div>`
            : `<div class="linha"><div class="tt" style="flex:1">Tributação Municipal (ISSQN)</div><div class="c" style="flex:3"><span class="val">TRIBUTAÇÃO MUNICIPAL (ISSQN) - OPERAÇÃO NÃO SUJEITA AO ISSQN</span></div></div>`
        }
      </div>

      <!-- TRIBUTAÇÃO FEDERAL (EXCETO CBS) -->
      <div class="bloco">
        <div class="linha">
          <div class="tt" style="flex:1">Tributação Federal (Exceto CBS)</div>
          ${campo("IRRF", moedaOu(tribFed?.vRetIRRF))}
          ${campo("Contribuição Previdenciária - Retida", moedaOu(tribFed?.vRetCP))}
          ${campo("Contribuições Sociais - Retidas", moedaOu(tribFed?.vRetCSLL))}
        </div>
        <div class="linha">
          ${campo("PIS - Débito Apuração Própria", moedaOu(tribFed?.piscofins?.vPis))}
          ${campo("COFINS - Débito Apuração Própria", moedaOu(tribFed?.piscofins?.vCofins))}
          ${campo("Descrição Contrib. Sociais - Retidas", ou(tribFed?.piscofins?.tpRetPisCofins), 2)}
        </div>
      </div>

      <!-- TRIBUTAÇÃO IBS / CBS -->
      <div class="bloco">
        <div class="linha">
          <div class="tt" style="flex:1">Tributação IBS / CBS</div>
          ${campo("CST / cClassTrib", ou(ibscbs ? `${ibscbs.CST} / ${ibscbs.cClassTrib}` : undefined))}
          ${campo("Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF", ou(infNFSe.xLocIncid), 2)}
        </div>
        <div class="linha">
          ${campo("Exclusões e Reduções da Base de Cálculo", TRACO)}
          ${campo("Base de Cálculo Após Exclusões e Reduções", moedaOu(g?.vBC))}
          ${campo("Red. Alíquota IBS / Red. Alíquota CBS", TRACO)}
          ${campo(
            "Alíquota - IBS UF / IBS Mun",
            g?.gIBSUF || g?.gIBSMun ? `${pctOu(g?.gIBSUF?.pIBSUF)} / ${pctOu(g?.gIBSMun?.pIBSMun)}` : TRACO
          )}
        </div>
        <div class="linha">
          ${campo("Alíq. Efetiva Municipal - IBS", pctOu(g?.gIBSMun?.pIBSMun))}
          ${campo("Valor Apurado Municipal - IBS", moedaOu(vIBSMun))}
          ${campo("Alíq. Efetiva Estadual - IBS", pctOu(g?.gIBSUF?.pIBSUF))}
          ${campo("Valor Apurado Estadual - IBS", moedaOu(vIBSUF))}
        </div>
        <div class="linha">
          ${campo("Valor Total Apurado - IBS", moedaOu(vIBSTot))}
          ${campo("Alíquota - CBS", pctOu(g?.gCBS?.pCBS))}
          ${campo("Alíquota Efetiva - CBS", pctOu(g?.gCBS?.pCBS))}
          ${campo("Valor Total Apurado - CBS", moedaOu(vCBS))}
        </div>
      </div>

      <!-- VALOR TOTAL DA NFS-e -->
      <div class="bloco">
        <div class="linha">
          <div class="tt" style="flex:1">Valor Total da NFS-e</div>
          ${campoB("Valor da Operação / Serviço", moedaOu(valoresDps.vServPrest.vServ))}
          ${campo("Desconto Incondicionado", moedaOu(valoresDps.vDescCondIncond?.vDescIncond))}
          ${campo("Desconto Condicionado", moedaOu(valoresDps.vDescCondIncond?.vDescCond))}
        </div>
        <div class="linha">
          ${campo("Total das Retenções (ISSQN / Federais)", moedaOu(valoresNfse.vTotalRet))}
          ${campoB("Valor Líquido da NFS-e", moedaOu(valoresNfse.vLiq))}
          ${campo("Total do IBS / CBS", moedaOu(totalIbsCbs))}
          ${campoB("Valor Líquido da NFS-e + IBS/CBS", moedaOu(vLiqMaisIbsCbs))}
        </div>
      </div>

      <!-- INFORMAÇÕES COMPLEMENTARES -->
      <div class="bloco">
        <div class="tt-full">Informações Complementares</div>
        <div class="linha infocompl">
          <div class="c" style="flex:1"><span class="val">${infoComplementares}</span></div>
        </div>
      </div>

      <!-- CANHOTO (opcional) -->
      <div class="bloco">
        <div class="linha canhoto">
          ${campoB("Data Cientificação", "&nbsp;")}
          ${campoB("Identificação e Assinatura", "&nbsp;")}
          <div class="c" style="flex:2"><span class="lbl lbl-b">Nº NFS-e / Chave NFS-e</span><span class="val chave">${ou(infNFSe.nNFSe)} / ${ou(infNFSe.chaveAcesso)}</span></div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
