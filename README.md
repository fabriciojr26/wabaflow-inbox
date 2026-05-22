# WabaFlow Inbox v6

Base v6 Cloudflare-ready (preparação), sem conexão real com WhatsApp Cloud API.

## Principais evoluções da v6
- Camada de configuração segura no backend (`buildConfig`) com fallback env/db/default.
- Modos operacionais suportados:
  - `simulated`
  - `cloud_ready`
  - `production_locked`
- Healthcheck robusto em `/api/health` com checks de arquivo, db e prontidão.
- Endpoint `/api/mode` com origem do modo e guardrails.
- Webhook GET/POST preservado em `/webhook/whatsapp`.
- Stub seguro para envio futuro via Cloud API (`/api/cloud/send-template`) sem chamadas reais.
- `.env.example` profissional para onboarding seguro.
- Plano e checklist Cloudflare em `docs/cloudflare-deploy.md`.

## Segurança e escopo
- Sem token real no repositório.
- Sem envio real para Meta/WhatsApp.
- Sem migração efetiva para Cloudflare nesta etapa.

## Rodar local
```bash
npm install
npm run dev
npm run build
```

## Endpoints úteis
- `GET /api/health`
- `GET /api/mode`
- `GET/POST /webhook/whatsapp`
