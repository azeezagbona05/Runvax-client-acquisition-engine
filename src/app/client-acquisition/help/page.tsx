'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, EmptyState, Pill, Skeleton } from '@/components/acq/ui';
import { DOCS, DOC_SECTIONS, searchDocs, type DocArticle, type DocBlock } from '@/lib/helpDocs';
import { CATEGORIES, STATUS_LABEL, LIMITS, type TicketStatus } from '@/lib/supportShared';

type Tab = 'videos' | 'docs' | 'tickets';
type Ticket = { id: string; ref: string; subject: string; category: string; status: TicketStatus; lastBy: 'user' | 'staff'; createdAt: string; lastReplyAt: string };
type Msg = { id: string; author: 'user' | 'staff'; authorName: string | null; body: string; createdAt: string };

const VIDEOS = [
  { id: 'promo', title: 'RUNVAX in action', text: 'A full walkthrough of finding prospects, building a campaign and winning replies.', src: '/help/promo.mp4', poster: '/help/promo.jpg', length: '7 min' },
  { id: 'showcase', title: 'What is new in RUNVAX 2.0', text: 'The Client Acquisition portal and your AI workforce, shown start to finish.', src: '/help/showcase.mp4', poster: '/help/showcase.jpg', length: '5 min' },
  { id: 'ai-agent', title: 'Create an AI agent', text: 'Describe your business, try your agent, then put it on your website.', src: '/help/ai-agent.mp4', poster: '/help/ai-agent.jpg', length: '4 min' },
];

const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const tone = (s: TicketStatus) => (s === 'open' ? 'acq-pill-blue' : s === 'pending' ? 'acq-pill-amber' : s === 'resolved' ? 'acq-pill-green' : 'acq-pill-gray');

function Blocks({ blocks }: { blocks: DocBlock[] }) {
  return <>{blocks.map((b, i) => {
    if ('p' in b) return <p key={i} style={{ margin: '0 0 10px', lineHeight: 1.6 }}>{b.p}</p>;
    if ('tip' in b) return <p key={i} style={{ margin: '0 0 10px', padding: '10px 12px', borderRadius: 10, background: '#eff6ff', color: '#1e3a8a', lineHeight: 1.55 }}><b>Tip. </b>{b.tip}</p>;
    if ('steps' in b) return <ol key={i} style={{ margin: '0 0 10px', paddingLeft: 22, lineHeight: 1.65 }}>{b.steps.map((s, j) => <li key={j}>{s}</li>)}</ol>;
    return <ul key={i} style={{ margin: '0 0 10px', paddingLeft: 22, lineHeight: 1.65 }}>{b.list.map((s, j) => <li key={j}>{s}</li>)}</ul>;
  })}</>;
}

function Videos() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
      {VIDEOS.map((v) => (
        <Card key={v.id} pad={false}>
          {open === v.id
            ? <video src={v.src} poster={v.poster} controls autoPlay playsInline preload="metadata" style={{ width: '100%', display: 'block', aspectRatio: '16/9', background: '#000', borderRadius: '12px 12px 0 0' }} />
            : <button type="button" onClick={() => setOpen(v.id)} aria-label={`Play ${v.title}`} style={{ position: 'relative', display: 'block', width: '100%', padding: 0, border: 0, cursor: 'pointer', background: '#0f172a', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.poster} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block', opacity: .85 }} />
              <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <span style={{ width: 56, height: 56, borderRadius: 28, background: 'rgba(255,255,255,.95)', display: 'grid', placeItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,.3)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#0f172a" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                </span>
              </span>
            </button>}
          <div style={{ padding: '12px 16px 16px' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{v.title} <span className="acq-faint" style={{ fontWeight: 400, fontSize: 12 }}>· {v.length}</span></h3>
            <p className="acq-sub" style={{ margin: '4px 0 0' }}>{v.text}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Docs({ startId }: { startId: string | null }) {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(startId);
  const found = useMemo(() => searchDocs(q), [q]);
  const open = DOCS.find((d) => d.id === openId) ?? null;
  const related = (d: DocArticle) => DOCS.filter((x) => x.section === d.section && x.id !== d.id);
  return (
    <div>
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpenId(null); }} placeholder="Search the documentation, for example: follow-ups, SMTP, agent" aria-label="Search the documentation" className="acq-input" style={{ width: '100%', marginBottom: 14, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line, #e2e8f0)' }} />
      {open ? (
        <Card>
          <button type="button" className="acq-link" onClick={() => setOpenId(null)} style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, marginBottom: 8 }}>← All articles</button>
          <p className="acq-faint" style={{ margin: 0, fontSize: 12 }}>{open.section}</p>
          <h2 style={{ margin: '2px 0 4px', fontSize: 22 }}>{open.title}</h2>
          <p className="acq-sub" style={{ margin: '0 0 14px' }}>{open.summary}</p>
          <Blocks blocks={open.body} />
          {related(open).length > 0 && <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line, #e2e8f0)' }}>
            <p className="acq-faint" style={{ fontSize: 12, margin: '0 0 6px' }}>More in {open.section}</p>
            {related(open).map((r) => <button key={r.id} type="button" onClick={() => setOpenId(r.id)} className="acq-link" style={{ display: 'block', border: 0, background: 'none', cursor: 'pointer', padding: '3px 0', textAlign: 'left' }}>{r.title}</button>)}
          </div>}
          <p className="acq-sub" style={{ marginTop: 16 }}>Did not answer your question? Open a ticket from the Tickets tab.</p>
        </Card>
      ) : found.length === 0 ? (
        <EmptyState title="No article matches that" body="Try fewer or different words, or open a ticket and we will help." />
      ) : (
        <div className="acq-stack">
          {DOC_SECTIONS.map((sec) => {
            const items = found.filter((d) => d.section === sec);
            if (!items.length) return null;
            return (
              <Card key={sec} title={sec}>
                <div style={{ display: 'grid', gap: 2 }}>
                  {items.map((d) => (
                    <button key={d.id} type="button" onClick={() => setOpenId(d.id)} style={{ textAlign: 'left', border: 0, background: 'none', cursor: 'pointer', padding: '8px 4px', borderRadius: 8 }}>
                      <span style={{ fontWeight: 600, display: 'block' }}>{d.title}</span>
                      <span className="acq-sub" style={{ fontSize: 13 }}>{d.summary}</span>
                    </button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Tickets({ onOpenDocs }: { onOpenDocs: () => void }) {
  const [list, setList] = useState<Ticket[] | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'new' | string>('list'); // a ticket id opens that ticket

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/support/tickets', { cache: 'no-store' });
      if (res.status === 401) { setSignedOut(true); setList([]); return; }
      const json = await res.json() as { tickets?: Ticket[]; error?: string };
      if (!res.ok) { setError(json.error ?? 'Could not load your tickets.'); setList([]); return; }
      setList(json.tickets ?? []); setError('');
    } catch { setError('Could not load your tickets.'); setList([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (signedOut) return <Card><EmptyState title="Sign in to open a ticket" body="Tickets are tied to your account so we can see your plan and campaigns and reply by email." action={<Link href="/auth/signin?callbackUrl=/client-acquisition/help" className="acq-btn acq-btn-primary">Sign in</Link>} /></Card>;
  if (view === 'new') return <NewTicket onDone={(id) => { void load(); setView(id ?? 'list'); }} onCancel={() => setView('list')} onOpenDocs={onOpenDocs} />;
  if (view !== 'list') return <TicketThread id={view} onBack={() => { void load(); setView('list'); }} />;

  return (
    <div className="acq-stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <p className="acq-sub" style={{ margin: 0 }}>Questions, problems or ideas. A real person replies by email and here.</p>
        <button type="button" className="acq-btn acq-btn-primary" onClick={() => setView('new')}>New ticket</button>
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>{error}</p>}
      {list === null ? <Skeleton h={90} /> : list.length === 0 && !error ? (
        <Card><EmptyState title="No tickets yet" body="When you open one, you will see every reply here." action={<button type="button" className="acq-btn acq-btn-primary" onClick={() => setView('new')}>Open a ticket</button>} /></Card>
      ) : (
        <Card pad={false}>
          {list.map((t) => (
            <button key={t.id} type="button" onClick={() => setView(t.id)} style={{ display: 'flex', width: '100%', gap: 12, alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', border: 0, borderBottom: '1px solid var(--line, #e2e8f0)', background: 'none', cursor: 'pointer', padding: '12px 16px' }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</span>
                <span className="acq-faint" style={{ fontSize: 12 }}>{t.ref} · {CATEGORIES.find((c) => c.id === t.category)?.label ?? t.category} · {fmt(t.lastReplyAt)}{t.lastBy === 'staff' && t.status === 'pending' ? ' · New reply' : ''}</span>
              </span>
              <Pill label={STATUS_LABEL[t.status]} tone={tone(t.status)} />
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}

function NewTicket({ onDone, onCancel, onOpenDocs }: { onDone: (id?: string) => void; onCancel: () => void; onOpenDocs: () => void }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('question');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const suggestions = useMemo(() => (subject.trim().length >= 4 ? searchDocs(subject).slice(0, 3) : []), [subject]);

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/support/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject, body, category }) });
      const json = await res.json() as { ticket?: Ticket; error?: string };
      if (!res.ok) { setError(json.error ?? 'Could not open the ticket.'); return; }
      onDone(json.ticket?.id);
    } catch { setError('Could not reach the server. Please try again.'); }
    finally { setBusy(false); }
  };
  const field = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line, #e2e8f0)', font: 'inherit' } as const;
  return (
    <Card title="New ticket">
      <div style={{ display: 'grid', gap: 12, maxWidth: 680 }}>
        <label>What is it about?
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...field, marginTop: 4 }}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        </label>
        <label>Subject
          <input value={subject} maxLength={LIMITS.subject} onChange={(e) => setSubject(e.target.value)} placeholder="A short summary" style={{ ...field, marginTop: 4 }} />
        </label>
        {suggestions.length > 0 && <p className="acq-sub" style={{ margin: 0, fontSize: 13 }}>This might already be answered: {suggestions.map((s, i) => <span key={s.id}>{i > 0 && ', '}<button type="button" onClick={onOpenDocs} className="acq-link" style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>{s.title}</button></span>)}. Find them in Documentation.</p>}
        <label>Details
          <textarea value={body} maxLength={LIMITS.body} rows={7} onChange={(e) => setBody(e.target.value)} placeholder="What happened, what you expected, and the name of the campaign or agent if it is about one." style={{ ...field, marginTop: 4, resize: 'vertical' }} />
        </label>
        {error && <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="acq-btn acq-btn-primary" disabled={busy} onClick={() => void submit()}>{busy ? 'Sending...' : 'Send ticket'}</button>
          <button type="button" className="acq-btn" disabled={busy} onClick={onCancel}>Cancel</button>
        </div>
        <p className="acq-faint" style={{ fontSize: 12, margin: 0 }}>Never include your password. We will reply to the email on your account.</p>
      </div>
    </Card>
  );
}

function TicketThread({ id, onBack }: { id: string; onBack: () => void }) {
  const [data, setData] = useState<{ ticket: Ticket; messages: Msg[] } | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const res = await fetch(`/api/support/tickets/${id}`, { cache: 'no-store' }).catch(() => null);
    if (!res || !res.ok) { setError('Could not load this ticket.'); return; }
    setData(await res.json() as { ticket: Ticket; messages: Msg[] }); setError('');
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const send = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/support/tickets/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: reply }) });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setError(json.error ?? 'Could not send.'); return; }
      setReply(''); await load();
    } catch { setError('Could not reach the server.'); } finally { setBusy(false); }
  };
  const setStatus = async (status: 'open' | 'closed') => {
    setBusy(true);
    const res = await fetch(`/api/support/tickets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }).catch(() => null);
    if (!res?.ok) setError('Could not update the ticket.');
    await load(); setBusy(false);
  };

  if (!data) return <div>{error ? <p role="alert" style={{ color: '#b91c1c' }}>{error}</p> : <Skeleton h={160} />}<button type="button" className="acq-btn" onClick={onBack}>Back</button></div>;
  const t = data.ticket; const closed = t.status === 'closed';
  return (
    <Card>
      <button type="button" className="acq-link" onClick={onBack} style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, marginBottom: 8 }}>← All tickets</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div><h2 style={{ margin: 0, fontSize: 20 }}>{t.subject}</h2><p className="acq-faint" style={{ margin: '2px 0 0', fontSize: 12 }}>{t.ref} · opened {fmt(t.createdAt)}</p></div>
        <Pill label={STATUS_LABEL[t.status]} tone={tone(t.status)} />
      </div>
      <div style={{ display: 'grid', gap: 10, margin: '16px 0' }}>
        {data.messages.map((m) => (
          <div key={m.id} style={{ justifySelf: m.author === 'user' ? 'end' : 'start', maxWidth: 'min(560px, 92%)', padding: '10px 14px', borderRadius: 12, background: m.author === 'user' ? '#eef2ff' : '#f1f5f9', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
            <div className="acq-faint" style={{ fontSize: 11, marginBottom: 3 }}>{m.author === 'user' ? 'You' : (m.authorName ?? 'Support')} · {fmt(m.createdAt)}</div>
            {m.body}
          </div>
        ))}
      </div>
      {closed ? <p className="acq-sub">This ticket is closed. <button type="button" className="acq-link" onClick={onBack} style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>Back to tickets</button> and open a new one if you still need help.</p> : (
        <div style={{ display: 'grid', gap: 8 }}>
          <textarea value={reply} rows={4} maxLength={LIMITS.body} onChange={(e) => setReply(e.target.value)} placeholder={t.status === 'resolved' ? 'Replying will reopen this ticket' : 'Write a reply'} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line, #e2e8f0)', font: 'inherit' }} />
          {error && <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="acq-btn acq-btn-primary" disabled={busy || reply.trim().length < 2} onClick={() => void send()}>Send reply</button>
            <button type="button" className="acq-btn" disabled={busy} onClick={() => void setStatus('closed')}>Close ticket</button>
          </div>
        </div>
      )}
    </Card>
  );
}

function HelpInner() {
  const sp = useSearchParams();
  const initial = sp.get('tab');
  const [tab, setTab] = useState<Tab>(initial === 'docs' || initial === 'tickets' || initial === 'videos' ? initial : 'videos');
  const doc = sp.get('doc');
  return (
    <div className="acq-stack">
      <div style={{ paddingTop: 4 }}>
        <h1 className="acq-page-title">Help &amp; support</h1>
        <p className="acq-sub" style={{ marginTop: 2 }}>Watch a walkthrough, read the guides, or open a ticket and we will reply.</p>
      </div>
      <div role="tablist" aria-label="Help sections" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {([['videos', 'Videos'], ['docs', 'Documentation'], ['tickets', 'Tickets']] as Array<[Tab, string]>).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`acq-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'videos' && <Videos />}
      {tab === 'docs' && <Docs startId={doc} />}
      {tab === 'tickets' && <Tickets onOpenDocs={() => setTab('docs')} />}
      <p className="acq-faint" style={{ fontSize: 12 }}>You can also email <a href="mailto:info@runvax.com?subject=Runvax%20Support" className="acq-link">info@runvax.com</a>.</p>
    </div>
  );
}

export default function HelpPage() {
  return <Suspense fallback={<Skeleton h={200} />}><HelpInner /></Suspense>;
}
