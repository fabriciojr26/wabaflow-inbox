import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 8787;
const APP_VERSION = '5.0.0';
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error('Banco local não encontrado em server/data/db.json');
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function calculateMetrics(db) {
  const conversations = db.conversations || [];
  const events = db.events || [];
  const total = conversations.length;
  const byStatus = conversations.reduce((acc, conv) => {
    acc[conv.status || 'novo'] = (acc[conv.status || 'novo'] || 0) + 1;
    return acc;
  }, {});
  const humanModeCount = conversations.filter((conv) => conv.humanMode).length;
  const unreadCount = conversations.reduce((sum, conv) => sum + (Number(conv.unread) || 0), 0);
  const inboundMessages = conversations.reduce(
    (sum, conv) => sum + (conv.messages || []).filter((msg) => msg.direction === 'inbound').length,
    0
  );
  const outboundMessages = conversations.reduce(
    (sum, conv) => sum + (conv.messages || []).filter((msg) => msg.direction === 'outbound').length,
    0
  );
  const buyerCount = byStatus.comprador || 0;
  const proposalCount = byStatus.proposta || 0;
  return {
    totalConversations: total,
    unreadCount,
    humanModeCount,
    activeFlows: (db.flows || []).filter((flow) => flow.active).length,
    totalFlows: (db.flows || []).length,
    inboundMessages,
    outboundMessages,
    replyRate: inboundMessages ? Math.round((outboundMessages / inboundMessages) * 100) : 0,
    qualifiedCount: byStatus.qualificado || 0,
    proposalCount,
    buyerCount,
    lostCount: byStatus.perdido || 0,
    eventCount: events.length,
    funnelConversionRate: total ? Math.round((buyerCount/total)*100) : 0,
    proposalToBuyerRate: proposalCount ? Math.round((buyerCount/proposalCount)*100) : 0,
    avgMessagesPerConversation: total ? Number(((inboundMessages+outboundMessages)/total).toFixed(1)) : 0,
    byStatus
  };
}

function addEvent(db, type, label, conversationId = null, payload = {}) {
  const event = {
    id: uid('evt'),
    type,
    label,
    conversationId,
    createdAt: nowIso(),
    payload
  };
  db.events.unshift(event);
  db.events = db.events.slice(0, 500);
  return event;
}

function findFlowForText(db, text) {
  const clean = normalizeText(text);
  return (db.flows || []).find((flow) => {
    if (!flow.active) return false;
    return (flow.keywords || []).some((keyword) => {
      const key = normalizeText(keyword);
      return key && clean.includes(key);
    });
  });
}

function applyAutoFlow(db, conversation, inboundText) {
  if (!db.settings?.autoReplyEnabled) return null;
  if (conversation.humanMode) {
    addEvent(db, 'AutomationPaused', 'Automação pausada por atendimento humano', conversation.id, { inboundText });
    return null;
  }
  const flow = findFlowForText(db, inboundText);
  if (!flow) return null;

  const message = {
    id: uid('msg'),
    direction: 'outbound',
    text: flow.response,
    createdAt: nowIso(),
    meta: {
      flowId: flow.id,
      flowName: flow.name,
      simulated: true
    }
  };
  conversation.messages.push(message);
  conversation.status = conversation.status === 'novo' ? 'ativo' : conversation.status;
  conversation.updatedAt = nowIso();
  addEvent(db, 'AutoReply', `Fluxo automático disparado: ${flow.name}`, conversation.id, { flowId: flow.id, keywordSource: inboundText });
  return message;
}

function createConversation(db, { text, name, phone, source = 'Simulador local' }) {
  const count = db.conversations.length + 1;
  const conversation = {
    id: uid('conv'),
    name: name?.trim() || `Lead Simulado ${count}`,
    phone: phone?.trim() || `55919${String(Date.now()).slice(-8)}`,
    source,
    status: 'novo',
    tags: ['novo'],
    notes: '',
    humanMode: false,
    unread: 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    messages: [
      {
        id: uid('msg'),
        direction: 'inbound',
        text: text || 'Olá, tenho interesse.',
        createdAt: nowIso()
      }
    ]
  };
  db.conversations.unshift(conversation);
  addEvent(db, 'Lead', 'Novo lead criado', conversation.id, { source, phone: conversation.phone });
  applyAutoFlow(db, conversation, text || 'Olá, tenho interesse.');
  return conversation;
}

function getConversation(db, id) {
  return db.conversations.find((conv) => conv.id === id);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'WabaFlow Inbox v5', version: APP_VERSION, port: PORT, time: nowIso() });
});

app.get('/api/state', (_req, res) => {
  const db = readDb();
  res.json({ ...db, metrics: calculateMetrics(db) });
});

app.post('/api/simulate/new-lead', (req, res) => {
  const db = readDb();
  const conversation = createConversation(db, req.body || {});
  writeDb(db);
  res.json({ ok: true, conversation, metrics: calculateMetrics(db) });
});

app.post('/api/simulate/current-message', (req, res) => {
  const { conversationId, text } = req.body || {};
  const db = readDb();
  const conversation = getConversation(db, conversationId);
  if (!conversation) return res.status(404).json({ ok: false, error: 'Conversa não encontrada.' });

  conversation.messages.push({ id: uid('msg'), direction: 'inbound', text: text || 'Mensagem de teste', createdAt: nowIso() });
  conversation.unread = (conversation.unread || 0) + 1;
  conversation.updatedAt = nowIso();
  addEvent(db, 'MessageReceived', 'Mensagem recebida na conversa atual', conversation.id, { simulated: true, text });
  applyAutoFlow(db, conversation, text || 'Mensagem de teste');
  writeDb(db);
  res.json({ ok: true, conversation, metrics: calculateMetrics(db) });
});

app.post('/api/conversations/:id/send', (req, res) => {
  const { text } = req.body || {};
  const db = readDb();
  const conversation = getConversation(db, req.params.id);
  if (!conversation) return res.status(404).json({ ok: false, error: 'Conversa não encontrada.' });
  if (!text?.trim()) return res.status(400).json({ ok: false, error: 'Mensagem vazia.' });

  conversation.messages.push({ id: uid('msg'), direction: 'outbound', text: text.trim(), createdAt: nowIso(), meta: { manual: true } });
  conversation.updatedAt = nowIso();
  conversation.unread = 0;
  addEvent(db, 'HumanReply', 'Resposta manual enviada no modo simulado', conversation.id, { text });
  writeDb(db);
  res.json({ ok: true, conversation, metrics: calculateMetrics(db) });
});

app.patch('/api/conversations/:id/status', (req, res) => {
  const { status } = req.body || {};
  const valid = ['novo', 'ativo', 'qualificado', 'proposta', 'comprador', 'perdido'];
  if (!valid.includes(status)) return res.status(400).json({ ok: false, error: 'Status inválido.' });

  const db = readDb();
  const conversation = getConversation(db, req.params.id);
  if (!conversation) return res.status(404).json({ ok: false, error: 'Conversa não encontrada.' });
  conversation.status = status;
  conversation.updatedAt = nowIso();
  addEvent(db, 'StatusChanged', `Status alterado para ${status}`, conversation.id, { status });
  if (status === 'qualificado') addEvent(db, 'QualifiedLead', 'Lead qualificado simulado', conversation.id, {});
  if (status === 'proposta') addEvent(db, 'InitiateCheckout', 'Proposta enviada simulada', conversation.id, {});
  if (status === 'comprador') addEvent(db, 'Purchase', 'Compra simulada registrada', conversation.id, { currency: 'BRL' });
  writeDb(db);
  res.json({ ok: true, conversation, metrics: calculateMetrics(db) });
});

app.patch('/api/conversations/:id/human-mode', (req, res) => {
  const db = readDb();
  const conversation = getConversation(db, req.params.id);
  if (!conversation) return res.status(404).json({ ok: false, error: 'Conversa não encontrada.' });
  conversation.humanMode = Boolean(req.body?.humanMode);
  conversation.updatedAt = nowIso();
  addEvent(db, conversation.humanMode ? 'HumanTakeover' : 'AutomationResumed', conversation.humanMode ? 'Atendimento humano assumido' : 'Automação retomada', conversation.id, {});
  writeDb(db);
  res.json({ ok: true, conversation, metrics: calculateMetrics(db) });
});

app.patch('/api/conversations/:id/tags', (req, res) => {
  const db = readDb();
  const conversation = getConversation(db, req.params.id);
  if (!conversation) return res.status(404).json({ ok: false, error: 'Conversa não encontrada.' });
  const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
  conversation.tags = [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))];
  conversation.updatedAt = nowIso();
  addEvent(db, 'TagUpdated', 'Tags atualizadas', conversation.id, { tags: conversation.tags });
  writeDb(db);
  res.json({ ok: true, conversation, metrics: calculateMetrics(db) });
});

app.patch('/api/conversations/:id/notes', (req, res) => {
  const db = readDb();
  const conversation = getConversation(db, req.params.id);
  if (!conversation) return res.status(404).json({ ok: false, error: 'Conversa não encontrada.' });
  conversation.notes = String(req.body?.notes || '');
  conversation.updatedAt = nowIso();
  addEvent(db, 'NoteUpdated', 'Observação interna atualizada', conversation.id, {});
  writeDb(db);
  res.json({ ok: true, conversation, metrics: calculateMetrics(db) });
});

app.post('/api/flows', (req, res) => {
  const { name, keywords, response } = req.body || {};
  if (!name?.trim() || !response?.trim()) return res.status(400).json({ ok: false, error: 'Nome e resposta são obrigatórios.' });
  const db = readDb();
  const flow = {
    id: uid('flow'),
    name: name.trim(),
    keywords: Array.isArray(keywords)
      ? keywords.map(String).map((k) => k.trim()).filter(Boolean)
      : String(keywords || '').split(',').map((k) => k.trim()).filter(Boolean),
    response: response.trim(),
    active: true,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  db.flows.unshift(flow);
  addEvent(db, 'FlowCreated', `Fluxo criado: ${flow.name}`, null, { flowId: flow.id });
  writeDb(db);
  res.json({ ok: true, flow, metrics: calculateMetrics(db) });
});

app.put('/api/flows/:id', (req, res) => {
  const db = readDb();
  const flow = db.flows.find((item) => item.id === req.params.id);
  if (!flow) return res.status(404).json({ ok: false, error: 'Fluxo não encontrado.' });
  const { name, keywords, response, active } = req.body || {};
  flow.name = name?.trim() || flow.name;
  flow.keywords = Array.isArray(keywords)
    ? keywords.map(String).map((k) => k.trim()).filter(Boolean)
    : String(keywords || flow.keywords.join(',')).split(',').map((k) => k.trim()).filter(Boolean);
  flow.response = response?.trim() || flow.response;
  if (typeof active === 'boolean') flow.active = active;
  flow.updatedAt = nowIso();
  addEvent(db, 'FlowUpdated', `Fluxo editado: ${flow.name}`, null, { flowId: flow.id });
  writeDb(db);
  res.json({ ok: true, flow, metrics: calculateMetrics(db) });
});

app.delete('/api/flows/:id', (req, res) => {
  const db = readDb();
  const flow = db.flows.find((item) => item.id === req.params.id);
  if (!flow) return res.status(404).json({ ok: false, error: 'Fluxo não encontrado.' });
  db.flows = db.flows.filter((item) => item.id !== req.params.id);
  addEvent(db, 'FlowDeleted', `Fluxo excluído: ${flow.name}`, null, { flowId: flow.id });
  writeDb(db);
  res.json({ ok: true, metrics: calculateMetrics(db) });
});

app.patch('/api/settings', (req, res) => {
  const db = readDb();
  db.settings = { ...db.settings, ...(req.body || {}) };
  addEvent(db, 'SettingsUpdated', 'Configurações atualizadas', null, { keys: Object.keys(req.body || {}) });
  writeDb(db);
  res.json({ ok: true, settings: db.settings, metrics: calculateMetrics(db) });
});


app.get('/api/mode', (_req, res) => {
  const db = readDb();
  const mode = db.settings?.mode || 'simulated';
  const cloudReady = mode === 'cloud-ready';
  res.json({
    ok: true,
    mode,
    simulated: mode === 'simulated',
    cloudReady,
    guardrails: {
      realApiEnabled: false,
      tokensConfigured: false,
      message: 'Modo cloud-ready apenas prepara estrutura. Nenhum token real é usado.'
    }
  });
});

app.post('/api/cloud/send-template', (req, res) => {
  const db = readDb();
  if ((db.settings?.mode || 'simulated') !== 'cloud-ready') {
    return res.status(400).json({ ok: false, error: 'Ative o modo cloud-ready para testar esta rota simulada.' });
  }
  const payload = {
    id: uid('cloud_req'),
    to: req.body?.to || null,
    templateName: req.body?.templateName || 'template_demo',
    createdAt: nowIso(),
    status: 'queued_simulated'
  };
  addEvent(db, 'CloudApiTemplateQueued', 'Template preparado para futura Cloud API (simulado)', null, payload);
  writeDb(db);
  res.json({ ok: true, simulated: true, payload });
});
app.post('/api/reset', (_req, res) => {
  const seed = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  seed.conversations = [];
  seed.events = [];
  seed.settings.autoReplyEnabled = true;
  writeDb(seed);
  res.json({ ok: true, metrics: calculateMetrics(seed) });
});

app.get('/webhook/whatsapp', (req, res) => {
  const db = readDb();
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || db.settings?.verifyToken || 'meu_token_de_verificacao_webhook';

  if (mode === 'subscribe' && token === expectedToken) {
    addEvent(db, 'WebhookVerified', 'Webhook validado pela Meta', null, { mode });
    writeDb(db);
    return res.status(200).send(challenge || '');
  }
  addEvent(db, 'WebhookVerificationFailed', 'Falha na validação do webhook', null, { mode, tokenReceived: token ? 'present' : 'empty' });
  writeDb(db);
  return res.sendStatus(403);
});

app.post('/webhook/whatsapp', (req, res) => {
  const db = readDb();
  const payload = req.body || {};
  addEvent(db, 'WebhookPost', 'POST recebido no webhook', null, { payloadPreview: JSON.stringify(payload).slice(0, 800) });

  try {
    const entries = payload.entry || [];
    entries.forEach((entry) => {
      (entry.changes || []).forEach((change) => {
        const value = change.value || {};
        const messages = value.messages || [];
        messages.forEach((message) => {
          const from = message.from || 'sem_numero';
          const text = message.text?.body || message.button?.text || message.interactive?.button_reply?.title || '[mensagem não textual]';
          let conversation = db.conversations.find((conv) => conv.phone === from);
          if (!conversation) {
            conversation = createConversation(db, { text, phone: from, name: `WhatsApp ${from}`, source: 'Webhook Meta' });
          } else {
            conversation.messages.push({ id: uid('msg'), direction: 'inbound', text, createdAt: nowIso(), meta: { webhookMessageId: message.id } });
            conversation.unread = (conversation.unread || 0) + 1;
            conversation.updatedAt = nowIso();
            addEvent(db, 'MessageReceived', 'Mensagem recebida via webhook', conversation.id, { from, messageId: message.id });
            applyAutoFlow(db, conversation, text);
          }
        });

        const statuses = value.statuses || [];
        statuses.forEach((status) => {
          addEvent(db, 'MessageStatus', `Status de mensagem: ${status.status}`, null, status);
        });
      });
    });
  } catch (error) {
    addEvent(db, 'WebhookError', 'Erro ao processar webhook', null, { error: error.message });
  }

  writeDb(db);
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`WabaFlow Inbox v5 rodando em http://localhost:${PORT}`);
  console.log(`Webhook local: http://localhost:${PORT}/webhook/whatsapp`);
});
