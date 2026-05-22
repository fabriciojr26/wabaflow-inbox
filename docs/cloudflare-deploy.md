# WabaFlow v6 - Cloudflare deploy plan (sem migração nesta etapa)

## Objetivo
Preparar o projeto para Cloudflare com segurança, mantendo o modo local e sem conexão real com WhatsApp Cloud API.

## Arquitetura alvo
- **Cloudflare Pages**: frontend Vite/React.
- **Cloudflare Workers**: API e webhook `/webhook/whatsapp`.
- **Cloudflare D1**: persistência substituindo JSON local.
- **Cloudflare Secrets**: `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`.

## Estratégia de rollout
1. Publicar frontend estático em Pages.
2. Subir API em Worker com `production_locked` por padrão.
3. Validar `/api/health` e `/api/mode` em ambiente remoto.
4. Habilitar apenas webhook GET de verificação.
5. Executar testes de POST webhook com payloads simulados.
6. Só depois liberar integração real controlada (fora do escopo desta versão).

## Checklist antes de conectar webhook real Meta
- [ ] `WABAFLOW_MODE=production_locked` em produção inicial.
- [ ] Secrets configurados via Cloudflare (sem hardcode em repo).
- [ ] `/api/health` retornando `ok: true` e checks válidos.
- [ ] `/api/mode` retornando modo esperado e guardrails.
- [ ] Logs e alertas ativos para erros de webhook.
- [ ] Limites de payload e validações anti-abuso revisadas.
- [ ] Fluxos automáticos revisados para não responder fora de contexto.
- [ ] Plano de rollback pronto (voltar para simulated/cloud_ready).

## Observações
- Nesta v6, o endpoint de envio é **stub seguro**: apenas enfileira evento local, sem request externa.
- O banco seed local `server/data/db.json` permanece obrigatório para desenvolvimento.
