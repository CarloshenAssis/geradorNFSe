/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
    // O @sparticuz/chromium guarda o binário (chromium.br) e as bibliotecas
    // de sistema (al2023.tar.br contém libnss3.so etc.) na pasta bin/. O
    // file-tracing do Next só rastreia o chromium.br (referência estática),
    // deixando os .tar.br de fora do deploy — o que faz o Chromium extrair
    // mas falhar com "libnss3.so: cannot open shared object file".
    // Forçamos a inclusão de TODA a pasta bin/ nas rotas que geram PDF.
    outputFileTracingIncludes: {
      "/api/danfse": ["./node_modules/@sparticuz/chromium/bin/**"],
      "/api/lotes": ["./node_modules/@sparticuz/chromium/bin/**"],
      "/api/lotes/[id]": ["./node_modules/@sparticuz/chromium/bin/**"],
    },
  },
};

export default nextConfig;
