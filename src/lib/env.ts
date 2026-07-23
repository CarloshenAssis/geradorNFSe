function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
  },
  get danfseStorageBucket() {
    return process.env.DANFSE_STORAGE_BUCKET || "danfse-files";
  },
  get danfseSignedUrlTtlSeconds() {
    return Number(process.env.DANFSE_SIGNED_URL_TTL_SECONDS || 300);
  },
  get danfseMaxXmlSizeBytes() {
    return Number(process.env.DANFSE_MAX_XML_SIZE_BYTES || 2 * 1024 * 1024);
  },
  get puppeteerExecutablePath() {
    return process.env.PUPPETEER_EXECUTABLE_PATH || "";
  },
  get chromiumRemotePackUrl() {
    return process.env.CHROMIUM_REMOTE_PACK_URL || "";
  },
  get paymentGatewayWebhookSecret() {
    return process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET || "";
  },
  get loteStorageBucket() {
    return process.env.LOTE_STORAGE_BUCKET || "lotes-files";
  },
  get loteSignedUrlTtlSeconds() {
    return Number(process.env.LOTE_SIGNED_URL_TTL_SECONDS || 300);
  },
  get loteMaxArquivos() {
    return Number(process.env.LOTE_MAX_ARQUIVOS || 200);
  },
  get loteMaxZipBytes() {
    return Number(process.env.LOTE_MAX_ZIP_BYTES || 50 * 1024 * 1024);
  },
  get loteMaxDescompactadoBytes() {
    return Number(process.env.LOTE_MAX_DESCOMPACTADO_BYTES || 500 * 1024 * 1024);
  },
  get loteRetencaoDias() {
    return Number(process.env.LOTE_RETENCAO_DIAS || 30);
  },
  get loteChunkSize() {
    return Number(process.env.LOTE_CHUNK_SIZE || 25);
  },
};
