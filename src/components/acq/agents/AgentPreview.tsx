'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw, Send } from 'lucide-react';
import type { AgentConfig, AgentKind, AssistantConfig, VisibilityConfig } from '@/lib/agents/kinds';

interface Turn { r: 'v' | 'a'; t: string }
interface Visitor { name?: string; email?: string; phone?: string; company?: string; need?: string }
interface Article { title: string; summary: string; body: string; source: 'ai' | 'rules'; topic: string; notice?: string }
const post = (cfg: AgentConfig, kind: AgentKind, extra: Record<string, unknown>) => fetch('/api/client-acquisition/agents/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, config: cfg, ...extra }) }).then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) as Record<string, any> })); // eslint-disable-line @typescript-eslint/no-explicit-any

/** Try an agent before it goes live. Uses the settings on screen (even unsaved ones). Nothing is saved, published or sent. */
export default function AgentPreview({ kind, cfg }: { kind: AgentKind; cfg: AgentConfig }) {
  return (
    <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 12 }} aria-label="Try your agent">
      <div>
        <h3 className="acq-title">Try it</h3>
        <p className="acq-sub" style={{ fontSize: 13, marginTop: 2 }}>{kind === 'assistant' ? 'Chat with your assistant the way a visitor would.' : 'See the kind of article your agent writes.'} It uses the settings on this page, even ones you have not saved. <b>Preview only: nothing is saved, published or sent, and no one is emailed.</b></p>
      </div>
      {kind === 'assistant' ? <ChatTry cfg={cfg as AssistantConfig} /> : <ArticleTry cfg={cfg as VisibilityConfig} />}
    </section>
  );
}

function ChatTry({ cfg }: { cfg: AssistantConfig }) {
  const [turns, setTurns] = useState<Turn[]>([]); const [text, setText] = useState(''); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(''); const [note, setNote] = useState(''); const [got, setGot] = useState<Visitor>({}); const [src, setSrc] = useState(''); const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [turns, busy]);
  const reset = () => { setTurns([]); setGot({}); setErr(''); setNote(''); setSrc(''); };
  async function send() {
    const t = text.trim(); if (!t || busy) return; setText(''); setErr(''); setBusy(true);
    const history = turns; setTurns([...turns, { r: 'v', t }]);
    const { ok, j } = await post(cfg, 'assistant', { message: t, history }); setBusy(false);
    if (!ok) { setErr(j.error || 'Could not get a reply.'); return; }
    setTurns((p) => [...p, { r: 'a', t: j.reply }]); setNote(j.notice ?? ''); setSrc(j.source === 'ai' ? 'Answered by AI' : 'Answered by the built-in replies (no AI available)');
    setGot((p) => ({ ...p, ...Object.fromEntries(Object.entries(j.visitor ?? {}).filter(([, x]) => x)) }));
  }
  const captured = Object.entries(got).filter(([, x]) => x);
  return (
    <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', background: '#f8fafc' }}>
        <div style={{ background: '#7e22ce', color: '#fff', padding: '10px 14px', fontWeight: 700, lineHeight: 1.25 }}>{cfg.business.name || 'Your assistant'}<div style={{ fontWeight: 500, fontSize: 12, opacity: .9 }}>AI assistant</div></div>
        <div role="log" aria-live="polite" aria-label="Preview conversation" style={{ minHeight: 190, maxHeight: 320, overflowY: 'auto', padding: 12, display: 'grid', gap: 8, alignContent: 'start' }}>
          <Bubble mine={false}>{cfg.greeting}</Bubble>
          {turns.map((m, i) => <Bubble key={i} mine={m.r === 'v'}>{m.t}</Bubble>)}
          {busy && <Bubble mine={false}><Loader2 size={14} className="animate-spin" /></Bubble>}
          <div ref={end} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void send(); }} style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #e2e8f0', background: '#fff' }}>
          <input className="acq-input" aria-label="Your message to the assistant" placeholder="Type as a visitor would, e.g. “How much does it cost?”" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
          <button className="acq-btn acq-btn-primary" type="submit" disabled={busy || !text.trim()} aria-label="Send"><Send size={15} /></button>
        </form>
      </div>
      {err && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{err}</p>}
      {note && <p className="acq-notice" style={{ fontSize: 12.5 }}>{note}</p>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
        <button type="button" className="acq-btn acq-btn-sm" onClick={reset}><RotateCcw size={13} /> Start over</button>
        {src && <span className="acq-faint">{src}</span>}
      </div>
      {captured.length > 0 && <p style={{ fontSize: 12.5 }}><b>The assistant picked up:</b> {captured.map(([k, v]) => `${k}: ${v}`).join(' · ')} <span className="acq-faint">(in a real chat this becomes a lead and you get an email)</span></p>}
    </div>
  );
}
const Bubble = ({ mine, children }: { mine: boolean; children: React.ReactNode }) => <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14, justifySelf: mine ? 'end' : 'start', ...(mine ? { background: '#7e22ce', color: '#fff' } : { background: '#fff', border: '1px solid #e2e8f0' }) }}>{children}</div>;

function ArticleTry({ cfg }: { cfg: VisibilityConfig }) {
  const [topic, setTopic] = useState(''); const [art, setArt] = useState<Article | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const topics = cfg.topics;
  async function go() {
    setBusy(true); setErr(''); const { ok, j } = await post(cfg, 'visibility', { topic: topic || topics[0] }); setBusy(false);
    if (!ok) { setErr(j.error || 'Could not write a preview.'); return; }
    setArt(j as unknown as Article);
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="acq-select" aria-label="Topic for the preview" style={{ width: 'auto', maxWidth: '100%', height: 40 }} value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="">{topics.length ? 'First topic' : 'Add a topic first'}</option>{topics.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="acq-btn acq-btn-primary" style={{ height: 40 }} disabled={busy || topics.length === 0} onClick={() => void go()}>{busy ? <Loader2 size={15} className="animate-spin" /> : null} Write a preview article</button>
      </div>
      {err && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{err}</p>}
      {art && (
        <article style={{ border: '1px dashed #c4b5fd', borderRadius: 14, padding: '14px 18px', maxWidth: 760, background: '#fff' }} aria-label="Preview article">
          <p className="acq-faint" style={{ fontSize: 12, marginBottom: 6 }}>PREVIEW · {art.source === 'ai' ? 'Written by AI' : 'Built-in template (no AI available), so it is generic'} · not saved or published</p>
          {art.notice && <p className="acq-notice" style={{ fontSize: 12.5, marginBottom: 8 }}>{art.notice}</p>}
          <h4 style={{ fontSize: 20, margin: '0 0 4px', lineHeight: 1.3 }}>{art.title}</h4>
          <p className="acq-sub" style={{ fontSize: 13.5, marginBottom: 10 }}>{art.summary}</p>
          <div style={{ fontSize: 14.5, lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: art.body }} />
        </article>
      )}
    </div>
  );
}
