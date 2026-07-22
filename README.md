# Sistema Unificado — ContaDoc + CNPJTrack + Gerador DANFSe

Implementação com base em `especificacaosistemaunificado.md`: motor de notas (NF-e via
NFeDistribuicaoDFe/SEFAZ), monitor de CNPJ, gerador de DANFSe (NT 008/2026), billing,
alertas e auditoria, multi-tenant por `escritorio_id` sobre Supabase (Postgres + Auth +
Storage + RLS) e Next.js/Vercel.

## Stack

- **Next.js 14 (App Router) + TypeScript**, deploy na Vercel
- **Supabase**: Postgres com RLS obrigatória, Auth, Storage (buckets privados), Vault
  (segredo do certificado A1)
- **puppeteer-core**: render do DANFSe (HTML/CSS → PDF)

## Estrutura

```
supabase/migrations/     schema completo, RLS, funções transacionais, storage
src/lib/nfse/            parser + validação (zod) + sanitização do XML da NFS-e
src/lib/pdf/             template HTML, QR Code, render sandboxado
src/lib/danfse/          orquestração: valida → debita crédito → renderiza → audita
src/lib/nfe/             motor NF-e (NFeDistribuicaoDFe), idempotente por chave de acesso
src/lib/monitor/         monitor de CNPJ (situação cadastral + calendário de obrigações)
src/lib/alertas/         serviço central de alertas + e-mail
src/lib/billing/         confirmação de pagamento via webhook assinado
src/lib/certificados/    acesso ao certificado A1 via Supabase Vault
src/lib/auth/            contexto de sessão (escritorio_id/papel) + rate limit de login
src/app/api/             rotas HTTP (danfse, jobs de cron, webhook, login)
fixtures/                XML de exemplo usado nos testes
tests/                   testes unitários (parser, validação, sanitização, template)
```

## Setup local

```bash
npm install
cp .env.example .env.local   # preencher com o projeto Supabase real
npm run dev
```

Rode as migrations em `supabase/migrations/*.sql` (em ordem) no projeto Supabase, seja
via `supabase db push`, seja aplicando manualmente pelo painel/SQL editor.

Variáveis de ambiente obrigatórias estão documentadas em `.env.example`, incluindo:

- Credenciais Supabase (URL, anon key, service role key)
- Caminho do Chromium para o render de PDF (`PUPPETEER_EXECUTABLE_PATH` local;
  `CHROMIUM_REMOTE_PACK_URL` em serverless via `@sparticuz/chromium-min`)
- URL da consulta nacional de NFS-e para o QR Code (`NFSE_CONSULTA_QRCODE_BASE_URL`)
- Endpoint do NFeDistribuicaoDFe por ambiente (`SEFAZ_DISTRIBUICAO_DFE_URL_*`)
- Segredo do webhook de pagamento e do cron dos jobs

## Testes e verificação

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Os testes cobrem o núcleo determinístico (parser, validação estrutural, sanitização
contra XSS/injeção, template do DANFSe) usando `fixtures/exemplo_nfse.xml` como XML de
referência. Integrações externas (SEFAZ, provedor de consulta cadastral, gateway de
pagamento) são isoladas atrás de interfaces (`SefazClient`, `CnpjProvider`,
`EmailProvider`) para permitir testes com fakes e troca de fornecedor sem tocar na
lógica de negócio.

## Pontos que exigem configuração/integração adicional antes de produção

Documentados inline no código onde relevante:

- **`src/lib/nfe/sefaz-client.ts`**: o parsing do envelope SOAP de resposta do
  NFeDistribuicaoDFe é um ponto de extensão (`decodificarDocZip`/`extrairNotaDoDocZip`
  já prontos e testáveis) — plugue a lib SOAP escolhida para produção.
- **`src/lib/monitor/cnpj-provider.ts`**: assume um provedor HTTP genérico
  (`CNPJ_PROVIDER_BASE_URL`); ajuste ao contrato do provedor contratado.
- **`src/lib/billing/webhook-signature.ts`**: verificação HMAC genérica; se o gateway
  escolhido for Stripe, troque pela verificação oficial do SDK (`constructEvent`).
- **`src/lib/notificacoes/email-provider.ts`**: implementação noop até a escolha do
  provedor de e-mail transacional.

## Segurança (resumo — detalhes na Parte 2 do MD)

- RLS obrigatória em toda tabela com `escritorio_id`, testável com casos adversariais
- Certificado A1 nunca em texto puro: referência ao Supabase Vault, decriptado só no
  processo do job, nunca logado
- XML do usuário nunca confiado: validação estrutural (zod) antes de qualquer
  processamento, todo campo escapado antes de entrar no template HTML do PDF
- Render de PDF sandboxado: sem JavaScript, sem rede (exceto `data:` URIs), timeout curto
- Débito de crédito e confirmação de pagamento são transações atômicas no banco
  (funções `SECURITY DEFINER`), nunca lógica de aplicação sem lock
- Storage sempre privado, signed URL de TTL curto
- Log de auditoria append-only (sem policy de update/delete)
