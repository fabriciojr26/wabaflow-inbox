# WabaFlow Inbox MVP v4

MVP local simulado para estruturar a base de um inbox conectado futuramente à WhatsApp Business Platform / Cloud API.

## O que entrou na v4

- Inbox com conversas simuladas.
- Simulador com dois modos: novo lead e mensagem na conversa atual.
- Fluxos automáticos com criar, editar, pausar/ativar e excluir.
- Tags por lead.
- Observação interna por lead.
- Botão de atendimento humano, que pausa automação naquela conversa.
- Funil visual por status: novo, ativo, qualificado, proposta, comprador e perdido.
- Painel de métricas simples.
- Histórico de eventos simulados para preparar futura integração com Meta CAPI e webhooks.
- Webhook GET/POST preparado em `/webhook/whatsapp` para próxima fase.
- Persistência local em `server/data/db.json`.

## Como rodar no Windows

1. Extraia o ZIP.
2. Entre na pasta do projeto pelo PowerShell.
3. Instale as dependências:

```bash
npm.cmd install
```

4. Rode o sistema:

```bash
npm.cmd run dev
```

5. Abra no navegador:

```bash
http://localhost:5173
```

## Endpoints locais

- Front-end: `http://localhost:5173`
- Back-end: `http://localhost:8787`
- Estado do sistema: `http://localhost:8787/api/state`
- Saúde do servidor: `http://localhost:8787/api/health`
- Webhook WhatsApp: `http://localhost:8787/webhook/whatsapp`

## Teste técnico do webhook local

Com o servidor rodando, abra no navegador:

```bash
http://localhost:8787/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=meu_token_de_verificacao_webhook&hub.challenge=12345
```

Se estiver certo, deve aparecer:

```bash
12345
```

## Próxima fase recomendada

Depois da v4 aprovada localmente, o próximo passo técnico é migrar para Cloudflare:

- Cloudflare Pages para o front-end.
- Cloudflare Functions ou Workers para webhook/API.
- Cloudflare D1 para banco.
- Variáveis secretas para token e Phone Number ID.
- URL fixa HTTPS para configurar na Meta.
