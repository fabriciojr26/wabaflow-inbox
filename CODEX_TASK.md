# Codex Task: Implementar WabaFlow Inbox MVP v4

## Contexto
Este repositorio e a base oficial do WabaFlow Inbox, um MVP de inbox e CRM conversacional para WhatsApp Business API.

A branch feature/wabaflow-v4 foi criada para implementar a evolucao do MVP local simulado.

## Objetivo
Implementar a versao v4 local, sem conexao real ainda com WhatsApp Cloud API e sem migracao ainda para Cloudflare.

## Stack alvo
- React
- Vite
- Express
- JSON local em server/data/db.json

## Funcionalidades obrigatorias da v4
1. Inbox de conversas simuladas.
2. Simulador com dois modos: novo lead e mensagem na conversa atual.
3. Fluxos automaticos com criar, editar, pausar, ativar e excluir.
4. Tags por lead.
5. Observacao interna por lead.
6. Botao assumir atendimento humano, pausando automacao naquela conversa.
7. Funil por status: new, active, qualified, proposal, buyer, lost.
8. Painel de metricas: total de conversas, leads por status, eventos Lead e Purchase.
9. Historico de eventos simulados.
10. Webhook preparado em /webhook/whatsapp com GET de verificacao e POST de recebimento.
11. README com instrucoes de instalacao, execucao, reset e arquitetura.

## Regras tecnicas
- Nao reescrever como SaaS ainda.
- Nao conectar tokens reais.
- Nao expor segredos.
- Nao adicionar banco externo.
- Manter simplicidade local.
- Rodar build ao final.

## Scripts esperados
- npm run dev
- npm run build
- npm run reset

## Criterio de aceite
O projeto deve rodar localmente em http://localhost:5173 com API local em http://localhost:8787.
