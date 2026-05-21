import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  RefreshCcw,
  Search,
  Send,
  Settings,
  Tags,
  Trash2,
  UserCheck,
  Workflow
} from 'lucide-react';

const STATUS = [
  { id: 'novo', label: 'Novo' },
  { id: 'ativo', label: 'Ativo' },
  { id: 'qualificado', label: 'Qualificado' },
  { id: 'proposta', label: 'Proposta' },
  { id: 'comprador', label: 'Comprador' },
  { id: 'perdido', label: 'Perdido' }
];

const API = '';

function formatTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(value));
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Erro na operação.');
  return data;
}

export default function App() {
  const [state, setState] = useState(null);
  const [tab, setTab] = useState('inbox');
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [simulateText, setSimulateText] = useState('Quero saber o preço');
  const [replyText, setReplyText] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [flowDraft, setFlowDraft] = useState({ name: '', keywords: '', response: '' });
  const [editingFlowId, setEditingFlowId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  async function load() {
    const data = await request('/api/state');
    setState(data);
    if (!selectedId && data.conversations?.length) setSelectedId(data.conversations[0].id);
  }

  useEffect(() => {
    load().catch((error) => setStatusMessage(error.message));
    const interval = setInterval(() => load().catch(() => null), 4000);
    return () => clearInterval(interval);
  }, []);

  const conversations = state?.conversations || [];
  const selected = conversations.find((conv) => conv.id === selectedId) || conversations[0];

  useEffect(() => {
    if (!selectedId && selected?.id) setSelectedId(selected.id);
  }, [selected?.id, selectedId]);

  const filteredConversations = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return conversations;
    return conversations.filter((conv) => {
      return [conv.name, conv.phone, conv.source, conv.status, ...(conv.tags || [])]
        .join(' ')
        .toLowerCase()
        .includes(clean);
    });
  }, [conversations, query]);

  async function mutate(action, successMessage) {
    try {
      const result = await action();
      const data = await request('/api/state');
      setState(data);
      if (result?.conversation?.id) setSelectedId(result.conversation.id);
      setStatusMessage(successMessage || 'Operação concluída.');
    } catch (error) {
      setStatusMessage(error.message);
    }
  }

  async function simulateNewLead() {
    await mutate(
      () => request('/api/simulate/new-lead', { method: 'POST', body: JSON.stringify({ text: simulateText }) }),
      'Novo lead simulado criado.'
    );
  }

  async function simulateCurrentMessage() {
    if (!selected) return;
    await mutate(
      () => request('/api/simulate/current-message', { method: 'POST', body: JSON.stringify({ conversationId: selected.id, text: simulateText }) }),
      'Mensagem adicionada na conversa atual.'
    );
  }

  async function sendReply() {
    if (!selected || !replyText.trim()) return;
    const text = replyText;
    setReplyText('');
    await mutate(
      () => request(`/api/conversations/${selected.id}/send`, { method: 'POST', body: JSON.stringify({ text }) }),
      'Resposta manual registrada.'
    );
  }

  async function updateStatus(status) {
    if (!selected) return;
    await mutate(
      () => request(`/api/conversations/${selected.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
      `Status alterado para ${status}.`
    );
  }

  async function toggleHumanMode() {
    if (!selected) return;
    await mutate(
      () => request(`/api/conversations/${selected.id}/human-mode`, { method: 'PATCH', body: JSON.stringify({ humanMode: !selected.humanMode }) }),
      selected.humanMode ? 'Automação retomada.' : 'Atendimento humano assumido.'
    );
  }

  async function saveNotes(notes) {
    if (!selected) return;
    await mutate(
      () => request(`/api/conversations/${selected.id}/notes`, { method: 'PATCH', body: JSON.stringify({ notes }) }),
      'Observação interna salva.'
    );
  }

  async function addTag() {
    if (!selected || !tagDraft.trim()) return;
    const tags = [...(selected.tags || []), tagDraft.trim()];
    setTagDraft('');
    await mutate(
      () => request(`/api/conversations/${selected.id}/tags`, { method: 'PATCH', body: JSON.stringify({ tags }) }),
      'Tag adicionada.'
    );
  }

  async function removeTag(tag) {
    if (!selected) return;
    const tags = (selected.tags || []).filter((item) => item !== tag);
    await mutate(
      () => request(`/api/conversations/${selected.id}/tags`, { method: 'PATCH', body: JSON.stringify({ tags }) }),
      'Tag removida.'
    );
  }

  function startEditingFlow(flow) {
    setEditingFlowId(flow.id);
    setFlowDraft({ name: flow.name, keywords: (flow.keywords || []).join(', '), response: flow.response });
  }

  async function saveFlow() {
    if (!flowDraft.name.trim() || !flowDraft.response.trim()) {
      setStatusMessage('Preencha nome e resposta do fluxo.');
      return;
    }
    const payload = {
      name: flowDraft.name,
      keywords: flowDraft.keywords.split(',').map((item) => item.trim()).filter(Boolean),
      response: flowDraft.response
    };
    await mutate(
      () =>
        editingFlowId
          ? request(`/api/flows/${editingFlowId}`, { method: 'PUT', body: JSON.stringify(payload) })
          : request('/api/flows', { method: 'POST', body: JSON.stringify(payload) }),
      editingFlowId ? 'Fluxo editado.' : 'Fluxo criado.'
    );
    setEditingFlowId(null);
    setFlowDraft({ name: '', keywords: '', response: '' });
  }

  async function deleteFlow(flowId) {
    await mutate(() => request(`/api/flows/${flowId}`, { method: 'DELETE' }), 'Fluxo excluído.');
  }

  async function toggleFlow(flow) {
    await mutate(
      () => request(`/api/flows/${flow.id}`, { method: 'PUT', body: JSON.stringify({ ...flow, active: !flow.active }) }),
      flow.active ? 'Fluxo pausado.' : 'Fluxo ativado.'
    );
  }

  async function updateSettings(patch) {
    await mutate(() => request('/api/settings', { method: 'PATCH', body: JSON.stringify(patch) }), 'Configurações atualizadas.');
  }

  async function resetData() {
    await mutate(() => request('/api/reset', { method: 'POST' }), 'Dados simulados limpos.');
    setSelectedId(null);
  }

  if (!state) {
    return (
      <main className="loading-screen">
        <div className="spinner" />
        <p>Carregando WabaFlow Inbox v4...</p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">MVP local simulado</span>
          <h1>WabaFlow Inbox v4</h1>
        </div>
        <div className="topbar-actions">
          <span className={`mode-badge ${state.settings?.autoReplyEnabled ? 'on' : 'off'}`}>
            {state.settings?.autoReplyEnabled ? 'Automação ativa' : 'Automação pausada'}
          </span>
          <button className="ghost-button" onClick={load}><RefreshCcw size={16} /> Atualizar</button>
        </div>
      </header>

      {statusMessage && <div className="toast" onClick={() => setStatusMessage('')}>{statusMessage}</div>}

      <nav className="tabs">
        <button className={tab === 'inbox' ? 'active' : ''} onClick={() => setTab('inbox')}><MessageCircle size={17} /> Inbox</button>
        <button className={tab === 'funnel' ? 'active' : ''} onClick={() => setTab('funnel')}><BarChart3 size={17} /> Funil</button>
        <button className={tab === 'flows' ? 'active' : ''} onClick={() => setTab('flows')}><Workflow size={17} /> Fluxos</button>
        <button className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}><ClipboardList size={17} /> Eventos</button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}><Settings size={17} /> Configurações</button>
      </nav>

      {tab === 'inbox' && (
        <section className="inbox-grid">
          <aside className="conversation-list card">
            <div className="search-box">
              <Search size={16} />
              <input placeholder="Buscar lead, telefone, tag ou status" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="list-scroll">
              {filteredConversations.map((conv) => (
                <button key={conv.id} className={`conversation-item ${selected?.id === conv.id ? 'selected' : ''}`} onClick={() => setSelectedId(conv.id)}>
                  <div className="avatar">{conv.name?.slice(0, 1) || 'L'}</div>
                  <div className="conversation-summary">
                    <strong>{conv.name}</strong>
                    <span>{conv.messages?.at(-1)?.text || 'Sem mensagens'}</span>
                    <div className="mini-row">
                      <small>{formatTime(conv.updatedAt)}</small>
                      <small className={`status-dot ${conv.status}`}>{conv.status}</small>
                    </div>
                  </div>
                </button>
              ))}
              {!filteredConversations.length && <p className="empty">Nenhuma conversa encontrada.</p>}
            </div>
          </aside>

          <main className="chat-panel card">
            <div className="simulate-bar">
              <input value={simulateText} onChange={(e) => setSimulateText(e.target.value)} placeholder="Texto para simular entrada de cliente" />
              <button onClick={simulateCurrentMessage} disabled={!selected}>Mensagem atual</button>
              <button className="primary" onClick={simulateNewLead}>Novo lead</button>
            </div>

            {selected ? (
              <>
                <div className="chat-header">
                  <div>
                    <h2>{selected.name}</h2>
                    <span>{selected.phone} · {selected.source}</span>
                  </div>
                  <button className={selected.humanMode ? 'danger-soft' : 'ghost-button'} onClick={toggleHumanMode}>
                    {selected.humanMode ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                    {selected.humanMode ? 'Humano assumiu' : 'Automação liberada'}
                  </button>
                </div>
                <div className="messages">
                  {(selected.messages || []).map((msg) => (
                    <div key={msg.id} className={`message ${msg.direction}`}>
                      <p>{msg.text}</p>
                      <small>{formatTime(msg.createdAt)} {msg.meta?.flowName ? `· ${msg.meta.flowName}` : ''}</small>
                    </div>
                  ))}
                </div>
                <div className="reply-box">
                  <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Responder manualmente no modo simulado" onKeyDown={(e) => e.key === 'Enter' && sendReply()} />
                  <button className="primary" onClick={sendReply}><Send size={16} /> Enviar</button>
                </div>
              </>
            ) : (
              <div className="empty-state"><Bot size={36} /> Crie um novo lead simulado para começar.</div>
            )}
          </main>

          <aside className="lead-panel card">
            {selected ? (
              <>
                <h3>Painel do lead</h3>
                <label>Status comercial</label>
                <select value={selected.status} onChange={(e) => updateStatus(e.target.value)}>
                  {STATUS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
                <div className="quick-actions">
                  <button onClick={() => updateStatus('qualificado')}><UserCheck size={15} /> Qualificado</button>
                  <button onClick={() => updateStatus('proposta')}><ClipboardList size={15} /> Proposta</button>
                  <button onClick={() => updateStatus('comprador')}><CircleDollarSign size={15} /> Comprador</button>
                </div>

                <label>Tags</label>
                <div className="tag-list">
                  {(selected.tags || []).map((tag) => <button key={tag} onClick={() => removeTag(tag)}>{tag} ×</button>)}
                </div>
                <div className="inline-form">
                  <input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder="Nova tag" onKeyDown={(e) => e.key === 'Enter' && addTag()} />
                  <button onClick={addTag}><Tags size={15} /></button>
                </div>

                <label>Observação interna</label>
                <textarea defaultValue={selected.notes} onBlur={(e) => saveNotes(e.target.value)} placeholder="Anote contexto comercial, dor, objeção, produto de interesse..." />

                <div className="lead-meta">
                  <span>Criado: {formatTime(selected.createdAt)}</span>
                  <span>Atualizado: {formatTime(selected.updatedAt)}</span>
                  <span>Mensagens: {selected.messages?.length || 0}</span>
                </div>
              </>
            ) : <p className="empty">Nenhum lead selecionado.</p>}
          </aside>
        </section>
      )}

      {tab === 'funnel' && <FunnelView state={state} setSelectedId={setSelectedId} setTab={setTab} />}
      {tab === 'flows' && (
        <FlowsView
          state={state}
          flowDraft={flowDraft}
          setFlowDraft={setFlowDraft}
          editingFlowId={editingFlowId}
          setEditingFlowId={setEditingFlowId}
          saveFlow={saveFlow}
          deleteFlow={deleteFlow}
          toggleFlow={toggleFlow}
          startEditingFlow={startEditingFlow}
        />
      )}
      {tab === 'events' && <EventsView events={state.events || []} />}
      {tab === 'settings' && <SettingsView state={state} updateSettings={updateSettings} resetData={resetData} />}
    </div>
  );
}

function MetricCard({ label, value, icon }) {
  return (
    <div className="metric-card">
      <div>{icon}</div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function FunnelView({ state, setSelectedId, setTab }) {
  const metrics = state.metrics || {};
  const conversations = state.conversations || [];
  return (
    <section className="stack">
      <div className="metrics-grid">
        <MetricCard label="Conversas" value={metrics.totalConversations || 0} icon={<MessageCircle size={20} />} />
        <MetricCard label="Qualificados" value={metrics.qualifiedCount || 0} icon={<UserCheck size={20} />} />
        <MetricCard label="Compradores" value={metrics.buyerCount || 0} icon={<CheckCircle2 size={20} />} />
        <MetricCard label="Taxa resposta simulada" value={`${metrics.replyRate || 0}%`} icon={<Bot size={20} />} />
      </div>

      <div className="funnel-board">
        {STATUS.map((status) => {
          const items = conversations.filter((conv) => conv.status === status.id);
          return (
            <div className="funnel-column" key={status.id}>
              <h3>{status.label} <span>{items.length}</span></h3>
              {items.map((conv) => (
                <button key={conv.id} className="funnel-card" onClick={() => { setSelectedId(conv.id); setTab('inbox'); }}>
                  <strong>{conv.name}</strong>
                  <span>{conv.messages?.at(-1)?.text || 'Sem mensagens'}</span>
                  <small>{(conv.tags || []).join(', ') || 'sem tags'}</small>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FlowsView({ state, flowDraft, setFlowDraft, editingFlowId, setEditingFlowId, saveFlow, deleteFlow, toggleFlow, startEditingFlow }) {
  return (
    <section className="two-column">
      <div className="card form-card">
        <h2>{editingFlowId ? 'Editar fluxo automático' : 'Criar fluxo automático'}</h2>
        <label>Nome do fluxo</label>
        <input value={flowDraft.name} onChange={(e) => setFlowDraft({ ...flowDraft, name: e.target.value })} placeholder="Ex: Qualificação por preço" />
        <label>Palavras-chave separadas por vírgula</label>
        <input value={flowDraft.keywords} onChange={(e) => setFlowDraft({ ...flowDraft, keywords: e.target.value })} placeholder="preço, valor, plano" />
        <label>Resposta automática</label>
        <textarea value={flowDraft.response} onChange={(e) => setFlowDraft({ ...flowDraft, response: e.target.value })} placeholder="Resposta que será enviada quando a palavra-chave aparecer." />
        <div className="button-row">
          <button className="primary" onClick={saveFlow}>{editingFlowId ? 'Salvar edição' : 'Criar fluxo'}</button>
          {editingFlowId && <button onClick={() => { setEditingFlowId(null); setFlowDraft({ name: '', keywords: '', response: '' }); }}>Cancelar</button>}
        </div>
      </div>

      <div className="card list-card">
        <h2>Fluxos cadastrados</h2>
        {(state.flows || []).map((flow) => (
          <div className="flow-item" key={flow.id}>
            <div>
              <strong>{flow.name}</strong>
              <p>{flow.response}</p>
              <div className="tag-list compact">{(flow.keywords || []).map((tag) => <span key={tag}>{tag}</span>)}</div>
            </div>
            <div className="flow-actions">
              <button onClick={() => toggleFlow(flow)}>{flow.active ? 'Pausar' : 'Ativar'}</button>
              <button onClick={() => startEditingFlow(flow)}>Editar</button>
              <button className="danger-soft" onClick={() => deleteFlow(flow.id)}><Trash2 size={15} /> Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EventsView({ events }) {
  return (
    <section className="card events-card">
      <h2>Histórico de eventos simulados</h2>
      <p className="muted">Esta área prepara a lógica que depois será conectada a Meta CAPI, WhatsApp webhooks e métricas comerciais.</p>
      <div className="event-list">
        {events.map((event) => (
          <div className="event-item" key={event.id}>
            <span className="event-type">{event.type}</span>
            <strong>{event.label}</strong>
            <small>{formatTime(event.createdAt)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function SettingsView({ state, updateSettings, resetData }) {
  const settings = state.settings || {};
  const metrics = state.metrics || {};
  return (
    <section className="two-column">
      <div className="card form-card">
        <h2>Configurações do MVP</h2>
        <label>Nome do projeto</label>
        <input defaultValue={settings.projectName} onBlur={(e) => updateSettings({ projectName: e.target.value })} />
        <label>Nome da empresa</label>
        <input defaultValue={settings.businessName} onBlur={(e) => updateSettings({ businessName: e.target.value })} />
        <label>Verify Token local</label>
        <input defaultValue={settings.verifyToken} onBlur={(e) => updateSettings({ verifyToken: e.target.value })} />
        <label>Phone Number ID futuro</label>
        <input defaultValue={settings.phoneNumberId} onBlur={(e) => updateSettings({ phoneNumberId: e.target.value })} placeholder="Será usado na integração real" />
        <label className="switch-row">
          <input type="checkbox" checked={settings.autoReplyEnabled} onChange={(e) => updateSettings({ autoReplyEnabled: e.target.checked })} />
          Automação global ativa
        </label>
        <button className="danger-soft" onClick={resetData}><Trash2 size={16} /> Limpar conversas e eventos simulados</button>
      </div>

      <div className="card list-card">
        <h2>Diagnóstico local</h2>
        <div className="diagnostic-list">
          <p><strong>Back-end local:</strong> Express em http://localhost:8787</p>
          <p><strong>Front-end local:</strong> Vite em http://localhost:5173</p>
          <p><strong>Webhook preparado:</strong> /webhook/whatsapp</p>
          <p><strong>Modo atual:</strong> {settings.mode || 'simulated'}</p>
          <p><strong>Conversas:</strong> {metrics.totalConversations || 0}</p>
          <p><strong>Eventos:</strong> {metrics.eventCount || 0}</p>
          <p><strong>Fluxos ativos:</strong> {metrics.activeFlows || 0} de {metrics.totalFlows || 0}</p>
        </div>
      </div>
    </section>
  );
}
