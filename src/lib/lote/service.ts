import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionContext } from "@/lib/auth/context";
import type { Database, LoteItemStatus } from "@/lib/supabase/database.types";
import { extrairZipComGuardrails, ZipSecurityError, type ArquivoExtraido } from "@/lib/lote/zip-security";
import { derivarOrganizacao } from "@/lib/lote/organizer";
import { conferirXmlXPdf } from "@/lib/lote/conferencia";
import {
  gerarXlsx,
  gerarCsv,
  gerarTxt,
  gerarZipConsolidado,
  gerarRelatorioPdf,
  calcularResumo,
  type LinhaExport,
  type ArquivoParaZip,
} from "@/lib/lote/exports";
import { buildOrigemPath, buildItemPath, buildExportPath, uploadLoteArquivo, downloadLoteArquivo } from "@/lib/lote/storage";
import { parseNfseXml, XmlParseError } from "@/lib/nfse/parser";
import { validateNfse, NfseValidationError, type NfseParsed } from "@/lib/nfse/schema";
import { renderDanfseHtml } from "@/lib/pdf/template";
import { gerarQrCodeConsulta } from "@/lib/pdf/qrcode";
import { renderHtmlToPdf } from "@/lib/pdf/render";
import { env } from "@/lib/env";

export class LoteError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

/**
 * Orquestração do módulo de lote (Parte 1 do MD complementar). Sem uma
 * fila de jobs de verdade disponível no ambiente serverless atual, o
 * "processamento assíncrono" é implementado de forma cooperativa: cada
 * chamada a `processarProximoChunk` processa um bloco limitado de itens
 * pendentes e devolve o controle. O polling de status (GET /api/lotes/[id])
 * dispara essa continuação a cada consulta, e o job de cron
 * (jobs/lote-processamento) é a rede de segurança caso o usuário feche a
 * página no meio do processamento. Cada item roda isolado (try/catch) —
 * um XML ruim nunca derruba o lote inteiro.
 */

export async function criarLote(
  supabase: SupabaseClient<Database>,
  ctx: SessionContext,
  zipBuffer: Buffer
): Promise<{ loteId: string; ignorados: Array<{ nome: string; motivo: string }> }> {
  let extracao;
  try {
    extracao = await extrairZipComGuardrails(zipBuffer);
  } catch (err) {
    if (err instanceof ZipSecurityError) throw new LoteError(err.message, 400);
    throw err;
  }

  const loteId = randomUUID();
  const expiraEm = new Date(Date.now() + env.loteRetencaoDias * 86_400_000).toISOString();
  const origemPath = buildOrigemPath(ctx.escritorioId, loteId);

  await uploadLoteArquivo(origemPath, zipBuffer, "application/zip");

  const { error: insertLoteError } = await supabase.from("lote_processamento").insert({
    id: loteId,
    escritorio_id: ctx.escritorioId,
    usuario_id: ctx.userId,
    status: "processando",
    quantidade_arquivos: extracao.arquivos.length,
    origem_storage_ref: origemPath,
    expira_em: expiraEm,
  });
  if (insertLoteError) throw new LoteError(`falha_ao_criar_lote: ${insertLoteError.message}`, 500);

  const itemRows = extracao.arquivos.map((arquivo) => ({
    id: randomUUID(),
    lote_id: loteId,
    nome_arquivo_original: arquivo.nome,
    status: "pendente" as LoteItemStatus,
  }));

  const { error: insertItemsError } = await supabase.from("lote_item").insert(itemRows);
  if (insertItemsError) throw new LoteError(`falha_ao_criar_itens_do_lote: ${insertItemsError.message}`, 500);

  // Guarda os buffers originais (xml + pdf de referência pareado) em
  // storage já nesta etapa, para que o processamento em chunks não
  // dependa de manter o ZIP inteiro em memória entre requisições.
  for (let i = 0; i < extracao.arquivos.length; i++) {
    const arquivo = extracao.arquivos[i] as ArquivoExtraido;
    const itemId = (itemRows[i] as { id: string }).id;
    const xmlPath = buildItemPath(ctx.escritorioId, loteId, itemId, "input.xml");
    await uploadLoteArquivo(xmlPath, arquivo.conteudo, "application/xml");

    const chaveBase = arquivo.nome.toLowerCase().replace(/\.[^.]+$/, "");
    const pdfRef = extracao.pdfsReferencia.get(chaveBase);
    let pdfRefPath: string | null = null;
    if (pdfRef) {
      pdfRefPath = buildItemPath(ctx.escritorioId, loteId, itemId, "referencia.pdf");
      await uploadLoteArquivo(pdfRefPath, pdfRef.conteudo, "application/pdf");
    }

    await supabase
      .from("lote_item")
      .update({ xml_storage_ref: xmlPath, pdf_referencia_storage_ref: pdfRefPath })
      .eq("id", itemId);
  }

  return { loteId, ignorados: extracao.ignorados };
}

// O plano Hobby da Vercel limita a duração de função serverless a 60s
// (ignora `maxDuration` maior configurado na rota) — cada chunk precisa
// terminar com folga sob esse teto, incluindo o cold start do Chromium.
const ORCAMENTO_TEMPO_MS = 40_000;

async function processarItem(
  supabase: SupabaseClient<Database>,
  ctx: SessionContext,
  item: { id: string; lote_id: string; nome_arquivo_original: string; xml_storage_ref: string | null; pdf_referencia_storage_ref: string | null }
): Promise<void> {
  if (!item.xml_storage_ref) {
    throw new Error("item_sem_xml_armazenado");
  }

  const xmlBuffer = await downloadLoteArquivo(item.xml_storage_ref);
  const xml = xmlBuffer.toString("utf-8");

  let raw: unknown;
  try {
    raw = parseNfseXml(xml);
  } catch (err) {
    throw new Error(err instanceof XmlParseError ? err.message : "falha_ao_interpretar_xml");
  }

  let nfse: NfseParsed;
  try {
    nfse = validateNfse(raw);
  } catch (err) {
    throw new Error(err instanceof NfseValidationError ? err.message : "xml_fora_do_layout_esperado");
  }

  const cnpjPrestador = nfse.NFSe.infNFSe.DPS.infDPS.prest.CNPJ;
  let clienteId: string | null = null;
  if (cnpjPrestador) {
    const { data: cliente } = await supabase
      .from("cliente")
      .select("id")
      .eq("escritorio_id", ctx.escritorioId)
      .eq("cnpj", cnpjPrestador)
      .maybeSingle();
    clienteId = cliente?.id ?? null;
  }

  const generationId = randomUUID();
  const { error: rpcError } = await supabase.rpc("consume_credit_and_start_generation", {
    p_generation_id: generationId,
    p_cliente_id: clienteId,
    p_xml_storage_ref: item.xml_storage_ref,
  });
  if (rpcError) {
    throw new Error(rpcError.message.includes("saldo_insuficiente") ? "saldo_de_creditos_insuficiente" : rpcError.message);
  }

  try {
    const qrCodeDataUrl = await gerarQrCodeConsulta(nfse.NFSe.infNFSe.chaveAcesso);
    const html = renderDanfseHtml({ nfse, qrCodeDataUrl });
    const pdf = await renderHtmlToPdf(html);

    const pdfPath = buildItemPath(ctx.escritorioId, item.lote_id, item.id, "danfse.pdf");
    await uploadLoteArquivo(pdfPath, pdf, "application/pdf");
    await supabase.rpc("complete_generation", { p_generation_id: generationId, p_pdf_storage_ref: pdfPath });

    if (item.pdf_referencia_storage_ref) {
      const pdfRefBuffer = await downloadLoteArquivo(item.pdf_referencia_storage_ref);
      const divergencias = await conferirXmlXPdf(nfse, pdfRefBuffer);
      if (divergencias.length > 0) {
        await supabase.from("conferencia_divergencia").insert(
          divergencias.map((d) => ({
            lote_item_id: item.id,
            campo: d.campo,
            valor_xml: d.valorXml,
            valor_pdf: d.valorPdf,
            status: d.status,
          }))
        );
      }
    }

    const { nomeBase, pasta } = derivarOrganizacao(nfse);

    await supabase
      .from("lote_item")
      .update({
        cliente_id: clienteId,
        status: "processado",
        erro_detalhe: null,
        danfse_pdf_storage_ref: pdfPath,
        danfse_generation_id: generationId,
        nome_arquivo_padronizado: `${nomeBase}.pdf`,
        pasta_padronizada: pasta,
        processado_em: new Date().toISOString(),
      })
      .eq("id", item.id);
  } catch (err) {
    const detalhe = err instanceof Error ? err.message : "erro_desconhecido";
    await supabase.rpc("fail_generation", { p_generation_id: generationId, p_erro_detalhe: detalhe });
    throw err;
  }
}

/**
 * Processa um bloco de itens pendentes do lote. Retorna `true` quando não
 * há mais itens pendentes (lote pronto para finalização/exports).
 */
export async function processarProximoChunk(
  supabase: SupabaseClient<Database>,
  ctx: SessionContext,
  loteId: string
): Promise<{ finalizado: boolean }> {
  const inicio = Date.now();

  const { data: lote } = await supabase
    .from("lote_processamento")
    .select("*")
    .eq("id", loteId)
    .maybeSingle();
  if (!lote) throw new LoteError("lote_nao_encontrado", 404);
  if (lote.status === "concluido" || lote.status === "concluido_com_erros" || lote.status === "falhou") {
    return { finalizado: true };
  }

  const { data: pendentes } = await supabase
    .from("lote_item")
    .select("id, lote_id, nome_arquivo_original, xml_storage_ref, pdf_referencia_storage_ref")
    .eq("lote_id", loteId)
    .eq("status", "pendente")
    .limit(env.loteChunkSize);

  for (const item of pendentes ?? []) {
    if (Date.now() - inicio > ORCAMENTO_TEMPO_MS) break;

    // Reivindicação atômica: o polling de status pode disparar chamadas
    // concorrentes a este mesmo chunk (dupla renderização, retry de rede,
    // múltiplas abas). Sem isso, duas chamadas processavam o MESMO item
    // em paralelo — DANFSe gerado (e crédito debitado) em duplicata, e um
    // resultado podendo sobrescrever o outro com um erro transitório
    // (ex: "spawn ETXTBSY" de dois Chromium disputando o mesmo binário).
    // O UPDATE ... WHERE status='pendente' é serializado por linha no
    // Postgres — só uma chamada concorrente consegue reivindicar o item.
    const { data: claimed } = await supabase
      .from("lote_item")
      .update({ status: "processando" })
      .eq("id", item.id)
      .eq("status", "pendente")
      .select("id")
      .maybeSingle();

    if (!claimed) continue; // outra chamada já reivindicou este item

    try {
      await processarItem(supabase, ctx, item);
    } catch (err) {
      const detalhe = (err instanceof Error ? err.message : "erro_desconhecido").slice(0, 500);
      await supabase
        .from("lote_item")
        .update({ status: "erro", erro_detalhe: detalhe, processado_em: new Date().toISOString() })
        .eq("id", item.id);
    }
  }

  const { count: totalProcessados } = await supabase
    .from("lote_item")
    .select("id", { count: "exact", head: true })
    .eq("lote_id", loteId)
    .neq("status", "pendente");
  const { count: totalSucesso } = await supabase
    .from("lote_item")
    .select("id", { count: "exact", head: true })
    .eq("lote_id", loteId)
    .eq("status", "processado");
  const { count: totalErro } = await supabase
    .from("lote_item")
    .select("id", { count: "exact", head: true })
    .eq("lote_id", loteId)
    .eq("status", "erro");

  await supabase
    .from("lote_processamento")
    .update({
      quantidade_processados: totalProcessados ?? 0,
      quantidade_sucesso: totalSucesso ?? 0,
      quantidade_erro: totalErro ?? 0,
    })
    .eq("id", loteId);

  const { count: restantes } = await supabase
    .from("lote_item")
    .select("id", { count: "exact", head: true })
    .eq("lote_id", loteId)
    .eq("status", "pendente");

  if ((restantes ?? 0) > 0) {
    return { finalizado: false };
  }

  // Claim atômico da finalização: como o poll do frontend roda a cada
  // poucos segundos e a finalização (render de PDF do relatório, zip)
  // pode demorar mais que isso, múltiplas chamadas concorrentes podiam
  // ver "0 pendentes" ao mesmo tempo e rodar finalizarLote() em duplicata
  // (exports repetidos). `finalizado_em` começa null e só é setado aqui;
  // o UPDATE ... WHERE finalizado_em IS NULL serializa no Postgres —
  // apenas uma chamada concorrente consegue reivindicar a finalização.
  const { data: claim } = await supabase
    .from("lote_processamento")
    .update({ finalizado_em: new Date().toISOString() })
    .eq("id", loteId)
    .is("finalizado_em", null)
    .select("id")
    .maybeSingle();

  if (!claim) {
    // Outra chamada já reivindicou (ou já concluiu) a finalização.
    return { finalizado: true };
  }

  try {
    await finalizarLote(supabase, ctx, loteId);
  } catch (err) {
    // A finalização (exports/zip) falhou. Marca o lote como terminal com o
    // detalhe do erro em vez de deixá-lo preso em "processando" e
    // re-executando a finalização a cada consulta de status.
    const detalhe = (err instanceof Error ? err.message : "erro_desconhecido").slice(0, 500);
    await supabase
      .from("lote_processamento")
      .update({ status: "falhou", erro_detalhe: `falha_na_finalizacao: ${detalhe}`, finalizado_em: new Date().toISOString() })
      .eq("id", loteId);
  }
  return { finalizado: true };
}

async function finalizarLote(supabase: SupabaseClient<Database>, ctx: SessionContext, loteId: string): Promise<void> {
  const { data: itens } = await supabase
    .from("lote_item")
    .select("*")
    .eq("lote_id", loteId);

  const linhas: LinhaExport[] = [];
  const arquivosParaZip: ArquivoParaZip[] = [];

  for (const item of itens ?? []) {
    let nfseInfo: { prestador: string | null; numeroNfse: string | null; competencia: string | null; valorServico: number | null; valorIssqn: number | null; valorIbs: number | null; valorCbs: number | null; valorLiquido: number | null; chaveAcesso: string | null } = {
      prestador: null,
      numeroNfse: null,
      competencia: null,
      valorServico: null,
      valorIssqn: null,
      valorIbs: null,
      valorCbs: null,
      valorLiquido: null,
      chaveAcesso: null,
    };

    if (item.status === "processado" && item.xml_storage_ref) {
      try {
        const xmlBuffer = await downloadLoteArquivo(item.xml_storage_ref);
        const nfse = validateNfse(parseNfseXml(xmlBuffer.toString("utf-8")));
        const infNFSe = nfse.NFSe.infNFSe;
        const infDPS = infNFSe.DPS.infDPS;
        const g = infDPS.valores.trib?.IBSCBS?.gIBSCBS;
        const vIBS = (g?.gIBSUF?.vIBSUF ?? 0) + (g?.gIBSMun?.vIBSMun ?? 0);
        nfseInfo = {
          prestador: infDPS.prest.xNome,
          numeroNfse: infNFSe.nNFSe,
          competencia: infDPS.dCompet,
          valorServico: infDPS.valores.vServPrest.vServ,
          valorIssqn: infNFSe.valores.vISSQN,
          valorIbs: vIBS || null,
          valorCbs: g?.gCBS?.vCBS ?? null,
          valorLiquido: infNFSe.valores.vLiq,
          chaveAcesso: infNFSe.chaveAcesso,
        };
      } catch {
        // Falha ao reler o XML aqui não deveria acontecer (já validado no
        // processamento), mas se acontecer não derruba a finalização.
      }

      if (item.danfse_pdf_storage_ref) {
        try {
          const pdfBuffer = await downloadLoteArquivo(item.danfse_pdf_storage_ref);
          const pasta = item.pasta_padronizada ?? "Sem_Pasta";
          const nomeArquivo = item.nome_arquivo_padronizado ?? `${item.id}.pdf`;
          arquivosParaZip.push({ path: `${pasta}/${nomeArquivo}`, conteudo: pdfBuffer });
        } catch {
          // ignora item sem PDF recuperável no zip final
        }
      }
    }

    linhas.push({
      nomeArquivoOriginal: item.nome_arquivo_original,
      nomeArquivoPadronizado: item.nome_arquivo_padronizado,
      pasta: item.pasta_padronizada,
      status: item.status === "processado" ? "processado" : "erro",
      erroDetalhe: item.erro_detalhe,
      ...nfseInfo,
    });
  }

  const resumo = calcularResumo(linhas);

  // Exports que NÃO dependem do Chromium (XLSX/CSV/TXT) — nunca podem
  // travar a finalização.
  const xlsx = await gerarXlsx(linhas);
  const csv = gerarCsv(linhas);
  const txt = gerarTxt(linhas);

  arquivosParaZip.push({ path: "exports/lote.xlsx", conteudo: xlsx });
  arquivosParaZip.push({ path: "exports/lote.csv", conteudo: csv });
  arquivosParaZip.push({ path: "exports/lote.txt", conteudo: txt });

  // Relatório PDF é best-effort: se o render falhar, a finalização segue
  // com os demais exports em vez de travar o lote em "processando".
  let relatorioPdf: Buffer | null = null;
  try {
    relatorioPdf = await gerarRelatorioPdf(resumo, linhas);
    arquivosParaZip.push({ path: "relatorio_consolidado.pdf", conteudo: relatorioPdf });
  } catch {
    relatorioPdf = null;
  }

  const zipConsolidado = await gerarZipConsolidado(arquivosParaZip);

  const xlsxPath = buildExportPath(ctx.escritorioId, loteId, "lote.xlsx");
  const csvPath = buildExportPath(ctx.escritorioId, loteId, "lote.csv");
  const txtPath = buildExportPath(ctx.escritorioId, loteId, "lote.txt");
  const relatorioPath = buildExportPath(ctx.escritorioId, loteId, "relatorio_consolidado.pdf");
  const zipPath = buildExportPath(ctx.escritorioId, loteId, "consolidado.zip");

  const uploads = [
    uploadLoteArquivo(xlsxPath, xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    uploadLoteArquivo(csvPath, csv, "text/csv"),
    uploadLoteArquivo(txtPath, txt, "text/plain"),
    uploadLoteArquivo(zipPath, zipConsolidado, "application/zip"),
  ];
  if (relatorioPdf) {
    uploads.push(uploadLoteArquivo(relatorioPath, relatorioPdf, "application/pdf"));
  }
  await Promise.all(uploads);

  // Idempotência: remove exports/relatório de uma finalização anterior que
  // possa ter rodado parcialmente (evita linhas duplicadas se a finalização
  // for reexecutada).
  await supabase.from("export_gerado").delete().eq("lote_id", loteId);
  await supabase.from("relatorio_consolidado").delete().eq("lote_id", loteId);

  const exportRows: Array<{ lote_id: string; tipo: "xlsx" | "csv" | "txt" | "zip_consolidado"; storage_ref: string }> = [
    { lote_id: loteId, tipo: "xlsx", storage_ref: xlsxPath },
    { lote_id: loteId, tipo: "csv", storage_ref: csvPath },
    { lote_id: loteId, tipo: "txt", storage_ref: txtPath },
    { lote_id: loteId, tipo: "zip_consolidado", storage_ref: zipPath },
  ];
  await supabase.from("export_gerado").insert(exportRows);

  if (relatorioPdf) {
    await supabase.from("relatorio_consolidado").insert({
      lote_id: loteId,
      quantidade_notas: resumo.quantidadeNotas,
      valor_total_servicos: resumo.valorTotalServicos,
      valor_total_issqn: resumo.valorTotalIssqn,
      valor_total_ibs: resumo.valorTotalIbs,
      valor_total_cbs: resumo.valorTotalCbs,
      storage_ref: relatorioPath,
    });
  }

  await supabase
    .from("lote_processamento")
    .update({
      status: resumo.quantidadeErro > 0 ? "concluido_com_erros" : "concluido",
      finalizado_em: new Date().toISOString(),
    })
    .eq("id", loteId);
}

export type { ArquivoExtraido };
