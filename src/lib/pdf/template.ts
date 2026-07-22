import type { NfseParsed } from "@/lib/nfse/schema";
import { escapeHtml, formatCnpjOuCpf, formatDataHora, formatMoeda } from "@/lib/nfse/sanitize";

export interface DanfseTemplateInput {
  nfse: NfseParsed;
  qrCodeDataUrl: string;
}

/**
 * Monta o HTML do DANFSe. TODO campo textual vindo do XML passa por
 * escapeHtml — nenhum valor do documento do usuário é interpolado cru
 * (item 2.5 do MD).
 */
export function renderDanfseHtml({ nfse, qrCodeDataUrl }: DanfseTemplateInput): string {
  const infNFSe = nfse.NFSe.infNFSe;
  const infDPS = infNFSe.DPS.infDPS;
  const prest = infDPS.prest;
  const toma = infDPS.toma;
  const serv = infDPS.serv;
  const valoresDps = infDPS.valores;
  const trib = valoresDps.trib;
  const ibsCbs = trib?.IBSCBS?.gIBSCBS;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #111;
    margin: 24px;
  }
  h1 { font-size: 16px; margin: 0 0 4px; }
  h2 { font-size: 12px; margin: 0 0 6px; text-transform: uppercase; color: #333; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  td, th { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 12px; }
  .header .qrcode img { width: 90px; height: 90px; }
  .label { font-size: 9px; color: #555; text-transform: uppercase; display: block; }
  .value { font-size: 11px; }
  .section { margin-bottom: 14px; }
  .totais td { font-weight: bold; }
  .chave { font-family: monospace; letter-spacing: 1px; word-break: break-all; }
  .footer { margin-top: 20px; font-size: 9px; color: #666; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>DANFSe — Documento Auxiliar da NFS-e</h1>
      <span class="label">Número da NFS-e</span>
      <span class="value">${escapeHtml(infNFSe.nNFSe)}</span><br/>
      <span class="label">Competência</span>
      <span class="value">${escapeHtml(infDPS.dCompet)}</span><br/>
      <span class="label">Data/Hora do Processamento</span>
      <span class="value">${escapeHtml(formatDataHora(infNFSe.dhProc))}</span>
    </div>
    <div class="qrcode">
      <img src="${qrCodeDataUrl}" alt="QR Code de consulta" />
    </div>
  </div>

  <div class="section">
    <h2>Chave de Acesso</h2>
    <table>
      <tr><td class="chave">${escapeHtml(infNFSe.chaveAcesso)}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Local da Prestação</h2>
    <table>
      <tr>
        <td><span class="label">Município de Emissão</span>${escapeHtml(infNFSe.xLocEmi)}</td>
        <td><span class="label">Município de Prestação</span>${escapeHtml(infNFSe.xLocPrestacao)}</td>
        <td><span class="label">Município de Incidência</span>${escapeHtml(infNFSe.xLocIncid)} (${escapeHtml(infNFSe.cLocIncid)})</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2>Prestador do Serviço</h2>
    <table>
      <tr>
        <td><span class="label">CNPJ</span>${escapeHtml(formatCnpjOuCpf(prest.CNPJ))}</td>
        <td><span class="label">Razão Social</span>${escapeHtml(prest.xNome)}</td>
      </tr>
      <tr>
        <td><span class="label">Telefone</span>${escapeHtml(prest.fone) || "-"}</td>
        <td><span class="label">E-mail</span>${escapeHtml(prest.email) || "-"}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2>Tomador do Serviço</h2>
    <table>
      <tr>
        <td><span class="label">CNPJ/CPF</span>${escapeHtml(formatCnpjOuCpf(toma.CNPJ ?? toma.CPF))}</td>
        <td><span class="label">Nome/Razão Social</span>${escapeHtml(toma.xNome)}</td>
      </tr>
      ${
        toma.end
          ? `<tr>
        <td colspan="2">
          <span class="label">Endereço</span>
          ${escapeHtml(toma.end.xLgr)}, ${escapeHtml(toma.end.nro)} — ${escapeHtml(toma.end.xBairro)} —
          ${escapeHtml(toma.end.xMun)}/${escapeHtml(toma.end.UF)} — CEP ${escapeHtml(toma.end.CEP)}
        </td>
      </tr>`
          : ""
      }
    </table>
  </div>

  <div class="section">
    <h2>Discriminação do Serviço</h2>
    <table>
      <tr>
        <td><span class="label">Código de Tributação Nacional</span>${escapeHtml(serv.cServ.cTribNac)}</td>
        <td><span class="label">Descrição do Serviço</span>${escapeHtml(serv.cServ.xDescServ)}</td>
      </tr>
      <tr>
        <td colspan="2"><span class="label">Discriminação</span>${escapeHtml(serv.xDiscr)}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2>Valores e Tributos</h2>
    <table class="totais">
      <tr>
        <td><span class="label">Valor do Serviço</span>R$ ${formatMoeda(valoresDps.vServPrest.vServ)}</td>
        <td><span class="label">ISSQN</span>R$ ${formatMoeda(infNFSe.valores.vISSQN)}</td>
        <td><span class="label">Total Retido</span>R$ ${formatMoeda(infNFSe.valores.vTotalRet)}</td>
        <td><span class="label">Valor Líquido</span>R$ ${formatMoeda(infNFSe.valores.vLiq)}</td>
      </tr>
    </table>
    ${
      trib?.tribMun
        ? `<table>
      <tr>
        <td><span class="label">Tributação ISSQN</span>${escapeHtml(trib.tribMun.tribISSQN)}</td>
        <td><span class="label">Alíquota ISSQN</span>${trib.tribMun.pAliq !== undefined ? `${formatMoeda(trib.tribMun.pAliq)}%` : "-"}</td>
      </tr>
    </table>`
        : ""
    }
    ${
      trib?.IBSCBS
        ? `<table>
      <tr>
        <td><span class="label">CST IBS/CBS</span>${escapeHtml(trib.IBSCBS.CST)}</td>
        <td><span class="label">Classificação Tributária</span>${escapeHtml(trib.IBSCBS.cClassTrib)}</td>
        <td><span class="label">Base de Cálculo</span>${ibsCbs ? `R$ ${formatMoeda(ibsCbs.vBC)}` : "-"}</td>
      </tr>
      <tr>
        <td><span class="label">IBS UF</span>${ibsCbs?.gIBSUF ? `${formatMoeda(ibsCbs.gIBSUF.pIBSUF)}% / R$ ${formatMoeda(ibsCbs.gIBSUF.vIBSUF)}` : "-"}</td>
        <td><span class="label">IBS Município</span>${ibsCbs?.gIBSMun ? `${formatMoeda(ibsCbs.gIBSMun.pIBSMun)}% / R$ ${formatMoeda(ibsCbs.gIBSMun.vIBSMun)}` : "-"}</td>
        <td><span class="label">CBS</span>${ibsCbs?.gCBS ? `${formatMoeda(ibsCbs.gCBS.pCBS)}% / R$ ${formatMoeda(ibsCbs.gCBS.vCBS)}` : "-"}</td>
      </tr>
    </table>`
        : ""
    }
  </div>

  <div class="footer">
    Documento gerado eletronicamente a partir do XML da NFS-e. Consulte a autenticidade pelo QR Code ou pela chave de acesso.
  </div>
</body>
</html>`;
}
