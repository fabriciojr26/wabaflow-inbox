# WabaFlow Inbox v5

Evolução da v4 para uma base de produto real, mantendo operação local simulada e sem conexão com API real.

## O que foi feito na v5
- Projeto movido para a raiz do repositório (app + server).
- UX da inbox melhorada (lista prioriza não lidas e últimas atualizações, indicadores mais claros).
- Fluxos automáticos com edição/ativação mantidos e preparados para uso híbrido.
- Funil e métricas expandidos com conversão total e taxa proposta->compra.
- Separação explícita de modos:
  - `simulated`: funcionamento atual local;
  - `cloud-ready`: preparado para integração futura sem usar token.
- Camada inicial para futura WhatsApp Cloud API (stub):
  - `GET /api/mode`
  - `POST /api/cloud/send-template` (simulado, sem envio real)
- Webhook local mantido em `/webhook/whatsapp`.

## Guardrails de segurança
- Não conecta API real da Meta.
- Não usa tokens reais.
- Nenhuma credencial sensível foi adicionada.

## Plano futuro de Cloudflare (documentado, não executado)
1. Front em Cloudflare Pages.
2. API/Webhook em Cloudflare Workers.
3. Persistência em Cloudflare D1.
4. Segredos com `wrangler secret` (verify token, access token, phone number id).
5. Observabilidade (Logs + Analytics Engine).
6. Deploy gradual: shadow mode antes de chavear webhook real.

## Comandos
```bash
npm install
npm run dev
npm run build
```
