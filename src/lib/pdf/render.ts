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

async function resolveExecutablePath(): Promise<string> {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const packUrl = process.env.CHROMIUM_REMOTE_PACK_URL;
    if (!packUrl) {
      throw new PdfRenderError(
        "CHROMIUM_REMOTE_PACK_URL não configurado — necessário para o Chromium empacotado em ambiente serverless"
      );
    }
    const chromiumModule = await import("@sparticuz/chromium-min");
    const chromium = chromiumModule.default;
    return chromium.executablePath(packUrl);
  }

  throw new PdfRenderError(
    "PUPPETEER_EXECUTABLE_PATH não configurado. Defina o caminho de um binário Chromium local para desenvolvimento."
  );
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const executablePath = await resolveExecutablePath();

  const browser = await puppeteer.launch({
    executablePath,
    args: SANDBOX_ARGS,
    headless: true,
  });

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
