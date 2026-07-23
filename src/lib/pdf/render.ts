import "server-only";
import puppeteer from "puppeteer-core";

/**
 * Render de HTML → PDF (item 1.3 e 3.3 do MD). Roda em processo isolado,
 * sem JavaScript habilitado, sem acesso à rede (exceto data: URIs para o
 * QR Code embutido), com timeout curto — mitiga SSRF/leitura de arquivo
 * local caso algum campo do XML tenha escapado da sanitização (item 2.5).
 */

export class PdfRenderError extends Error {}

const SANDBOX_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-first-run",
  "--no-zygote",
  "--disable-extensions",
];

const RENDER_TIMEOUT_MS = 15_000;

interface LaunchOptions {
  executablePath: string;
  args: string[];
  headless: boolean | "shell";
}

async function resolveLaunchOptions(): Promise<LaunchOptions> {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    // Pacote COMPLETO @sparticuz/chromium: o binário do Chromium vem
    // embutido (brotli) e é extraído em /tmp no runtime — sem depender de
    // nenhuma URL externa (CHROMIUM_REMOTE_PACK_URL) que possa 404/403 ou
    // ficar dessincronizada da versão do npm. Isso elimina a fragilidade
    // que impedia a geração de PDF em produção.
    const chromiumModule = await import("@sparticuz/chromium");
    const chromium = chromiumModule.default;

    // Sempre o binário embutido (sem ler CHROMIUM_REMOTE_PACK_URL): a
    // versão do @sparticuz/chromium (131) é pareada com o Chrome que o
    // puppeteer-core espera (131.0.6778), então não há URL externa nem
    // risco de 404/403/versão dessincronizada.
    return {
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: "shell",
    };
  }

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: SANDBOX_ARGS,
      headless: true,
    };
  }

  throw new PdfRenderError(
    "PUPPETEER_EXECUTABLE_PATH não configurado. Defina o caminho de um binário Chromium local para desenvolvimento."
  );
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  // A resolução do executável (que baixa/descompacta o pack do Chromium em
  // ambiente serverless) e o launch do navegador ficam DENTRO do try: se
  // qualquer um falhar (pack incompatível, download indisponível,
  // biblioteca de sistema ausente), o erro vira um PdfRenderError com a
  // causa real — em vez de propagar como erro genérico sem diagnóstico.
  let browser: Awaited<ReturnType<typeof puppeteer.launch>>;
  try {
    const { executablePath, args, headless } = await resolveLaunchOptions();
    browser = await puppeteer.launch({ executablePath, args, headless });
  } catch (err) {
    throw new PdfRenderError(`Falha ao iniciar o Chromium: ${(err as Error).message}`);
  }

  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);

    page.on("request", (request) => {
      if (request.url().startsWith("data:")) {
        request.continue();
      } else {
        request.abort();
      }
    });

    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: RENDER_TIMEOUT_MS });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      timeout: RENDER_TIMEOUT_MS,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });

    return Buffer.from(pdf);
  } catch (err) {
    throw new PdfRenderError(`Falha ao renderizar PDF: ${(err as Error).message}`);
  } finally {
    await browser.close();
  }
}
