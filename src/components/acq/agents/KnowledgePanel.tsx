'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Check, FileText, Globe, Loader2, RefreshCw, Table2, Trash2, X, HelpCircle, ClipboardPaste } from 'lucide-react';

interface Source { id: string; kind: 'website' | 'pdf' | 'table' | 'qa' | 'text'; name: string; status: string; meta: Record<string, unknown>; chunks: number }
type Kind = Source['kind'];
const KIND: Record<Kind, { label: string; icon: typeof Globe }> = { website: { label: 'Website', icon: Globe }, pdf: { label: 'Document', icon: FileText }, table: { label: 'Table', icon: Table2 }, qa: { label: 'Q&A', icon: HelpCircle }, text: { label: 'Notes', icon: ClipboardPaste } };
const CARDS: Array<{ kind: Exclude<Kind, 'text'>; title: string; body: string }> = [
  { kind: 'website', title: 'Website URL', body: 'Answers from your website. RUNVAX reads up to 12 of its pages.' },
  { kind: 'pdf', title: 'Documents (PDF)', body: 'Answers straight from PDF documents with selectable text, up to 4 MB.' },
  { kind: 'table', title: 'Table (CSV)', body: 'Looks up answers in a spreadsheet saved as CSV, such as prices or a product list.' },
  { kind: 'qa', title: 'Questions & Answers (CSV)', body: 'Your FAQs as a CSV with two columns: question and answer.' },
];
const count = (n: unknown, one: string, many: string) => `${typeof n === 'number' ? n : '?'} ${n === 1 ? one : many}`;
const detail = (s: Source) => s.kind === 'website' || s.kind === 'pdf' ? count(s.meta.pages, 'page', 'pages') : s.kind === 'table' || s.kind === 'qa' ? count(s.meta.rows, 'row', 'rows') : count(s.chunks, 'part', 'parts');

/**
 * The assistant's knowledge base, tucked away: one quiet line until the owner chooses to update it.
 * Sources belong to the account and are reused; the ticked ones are what THIS assistant answers from.
 */
export default function KnowledgePanel({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const [sources, setSources] = useState<Source[] | null>(null); const [open, setOpen] = useState(false);
  const load = useCallback(() => { fetch('/api/client-acquisition/knowledge', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => setSources(j.sources)).catch(() => setSources([])); }, []);
  useEffect(() => { load(); }, [load]);
  const used = (sources ?? []).filter((s) => ids.includes(s.id));
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', background: '#fcfcff' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
        <BookOpen size={18} style={{ color: '#7e22ce', flex: 'none' }} />
        <div style={{ minWidth: 0, fontSize: 13.5 }}>
          <b>Knowledge base</b>
          <span className="acq-sub" style={{ marginLeft: 8 }}>{!sources ? 'Loading…' : used.length ? `${used.length} source${used.length === 1 ? '' : 's'} in use: ${used.slice(0, 3).map((s) => s.name).join(', ')}${used.length > 3 ? ` +${used.length - 3}` : ''}` : 'Add your website, PDFs, tables or Q&A so it answers from them.'}</span>
        </div>
      </div>
      <button type="button" className="acq-btn acq-btn-sm" onClick={() => setOpen(true)}>{used.length || (sources && sources.length) ? 'Update knowledge base' : 'Add knowledge base'}</button>
      {open && <Manager sources={sources ?? []} ids={ids} onChange={onChange} reload={load} close={() => setOpen(false)} />}
    </div>
  );
}

function Manager({ sources, ids, onChange, reload, close }: { sources: Source[]; ids: string[]; onChange: (ids: string[]) => void; reload: () => void; close: () => void }) {
  const [view, setView] = useState<'list' | 'add'>(sources.length ? 'list' : 'add'); const [kind, setKind] = useState<Kind | null>(null);
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [url, setUrl] = useState(''); const [name, setName] = useState(''); const [text, setText] = useState(''); const file = useRef<HTMLInputElement>(null);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [close]);
  const toggle = (id: string) => onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

  async function add() {
    if (!kind) return; setBusy('add'); setMsg(null);
    try {
      let res: Response;
      if (kind === 'website') res = await fetch('/api/client-acquisition/knowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, url }) });
      else if (kind === 'text') res = await fetch('/api/client-acquisition/knowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, name, text }) });
      else { const f = file.current?.files?.[0]; if (!f) { setMsg({ ok: false, t: 'Choose a file first.' }); setBusy(''); return; } const fd = new FormData(); fd.append('kind', kind); fd.append('file', f); res = await fetch('/api/client-acquisition/knowledge', { method: 'POST', body: fd }); }
      const j = await res.json().catch(() => ({})); setBusy('');
      if (!res.ok) { setMsg({ ok: false, t: j.error || 'Could not add that.' }); return; }
      onChange([...ids, j.source.id]); reload(); setKind(null); setUrl(''); setName(''); setText(''); setView('list');
      setMsg({ ok: true, t: `Added “${j.source.name}” and switched it on for this assistant.${j.note ? ` ${j.note}` : ''}` });
    } catch { setBusy(''); setMsg({ ok: false, t: 'Could not reach RUNVAX. Check your connection.' }); }
  }
  async function refresh(s: Source) { setBusy('r' + s.id); setMsg(null); const r = await fetch(`/api/client-acquisition/knowledge/${s.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }) }); const j = await r.json().catch(() => ({})); setBusy(''); setMsg(r.ok ? { ok: true, t: `Read “${s.name}” again (${j.pages} pages).` } : { ok: false, t: j.error || 'Could not read it again.' }); reload(); }
  async function remove(s: Source) { if (!window.confirm(`Delete “${s.name}”? Assistants stop using it.`)) return; setBusy('d' + s.id); await fetch(`/api/client-acquisition/knowledge/${s.id}`, { method: 'DELETE' }); setBusy(''); onChange(ids.filter((x) => x !== s.id)); reload(); }

  return (
    <div role="dialog" aria-modal="true" aria-label="Knowledge base" style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(15,23,42,.45)', display: 'grid', placeItems: 'center', padding: 16 }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div style={{ background: '#fff', borderRadius: 18, width: 'min(760px, 100%)', maxHeight: '88vh', overflow: 'auto', padding: 22, display: 'grid', gap: 16, boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <h3 className="acq-title" style={{ fontSize: 19 }}>{view === 'add' ? (kind ? CARDS.find((c) => c.kind === kind)?.title ?? 'Paste notes' : 'Add knowledge') : 'Knowledge base'}</h3>
          <button type="button" className="acq-icon-btn" aria-label="Close" onClick={close}><X size={18} /></button>
        </div>
        {msg && <p role="status" className="acq-notice" style={{ fontSize: 13, color: msg.ok ? '#166534' : '#b91c1c' }}>{msg.t}</p>}

        {view === 'list' && <>
          <p className="acq-sub" style={{ fontSize: 13 }}>Tick what this assistant should answer from.</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {sources.length === 0 && <p className="acq-sub">Nothing added yet.</p>}
            {sources.map((s) => { const I = KIND[s.kind]?.icon ?? FileText; return (
              <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px' }}>
                <input type="checkbox" aria-label={`Use ${s.name} in this assistant`} checked={ids.includes(s.id)} onChange={() => toggle(s.id)} style={{ accentColor: '#9333ea', width: 18, height: 18 }} />
                <I size={18} style={{ color: '#7e22ce', flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div><div className="acq-faint" style={{ fontSize: 12 }}>{KIND[s.kind]?.label} · {detail(s)}{s.kind === 'website' && s.meta.readAt ? ` · read ${new Date(String(s.meta.readAt)).toLocaleDateString('en-GB', { dateStyle: 'medium' })}` : ''}</div></div>
                {s.kind === 'website' && <button type="button" className="acq-btn acq-btn-sm" aria-label={`Read ${s.name} again`} disabled={!!busy} onClick={() => void refresh(s)}>{busy === 'r' + s.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}</button>}
                <button type="button" className="acq-btn acq-btn-sm" aria-label={`Delete ${s.name}`} disabled={!!busy} onClick={() => void remove(s)}><Trash2 size={13} /></button>
              </div>); })}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <button type="button" className="acq-btn" onClick={() => { setView('add'); setKind(null); setMsg(null); }}>+ Add knowledge</button>
            <button type="button" className="acq-btn acq-btn-primary" onClick={close}><Check size={15} /> Done</button>
          </div>
        </>}

        {view === 'add' && !kind && <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="group" aria-label="Kinds of knowledge">
            {CARDS.map((c) => { const I = KIND[c.kind].icon; return (
              <button key={c.kind} type="button" onClick={() => { setKind(c.kind); setMsg(null); }} style={{ textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, background: '#fff', cursor: 'pointer', display: 'grid', gap: 6 }}>
                <I size={22} style={{ color: '#7e22ce' }} /><b style={{ fontSize: 14.5 }}>{c.title}</b><span className="acq-sub" style={{ fontSize: 12.5 }}>{c.body}</span>
              </button>); })}
          </div>
          <button type="button" className="acq-link" style={{ justifySelf: 'start' }} onClick={() => { setKind('text'); setMsg(null); }}>Or paste text</button>
          <p className="acq-faint" style={{ fontSize: 12 }}>Notion, Google Drive, Slack, Zendesk, SharePoint and Confluence connectors are coming soon.</p>
          {sources.length > 0 && <div><button type="button" className="acq-btn acq-btn-sm" onClick={() => setView('list')}>← Back to my knowledge base</button></div>}
        </>}

        {view === 'add' && kind && <>
          {kind === 'website' && <div><label className="acq-label" htmlFor="kn-url">Website address</label><input id="kn-url" className="acq-input" placeholder="yourcompany.com" value={url} onChange={(e) => setUrl(e.target.value)} /><p className="acq-faint" style={{ fontSize: 12, marginTop: 4 }}>RUNVAX reads up to 12 pages once, politely, and skips pages the site asks tools not to read. Use the refresh button later to read it again.</p></div>}
          {(kind === 'pdf' || kind === 'table' || kind === 'qa') && <div><label className="acq-label" htmlFor="kn-file">{kind === 'pdf' ? 'PDF file (up to 4 MB)' : 'CSV file (up to 2 MB)'}</label><input id="kn-file" ref={file} type="file" accept={kind === 'pdf' ? '.pdf,application/pdf' : '.csv,.txt,text/csv,text/plain'} className="acq-input" style={{ height: 'auto', padding: 8 }} /><p className="acq-faint" style={{ fontSize: 12, marginTop: 4 }}>{kind === 'pdf' ? 'Scanned pages (pictures of text) cannot be read.' : kind === 'table' ? 'The first row must be the column names.' : 'Two columns: question and answer.'}</p></div>}
          {kind === 'text' && <><div><label className="acq-label" htmlFor="kn-name">Name</label><input id="kn-name" className="acq-input" placeholder="e.g. Pricing notes" value={name} onChange={(e) => setName(e.target.value)} /></div><div><label className="acq-label" htmlFor="kn-text">Text</label><textarea id="kn-text" className="acq-textarea" rows={8} value={text} onChange={(e) => setText(e.target.value)} /></div></>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="acq-btn acq-btn-primary" disabled={!!busy || (kind === 'website' && !url.trim()) || (kind === 'text' && text.trim().length < 20)} onClick={() => void add()}>{busy === 'add' && <Loader2 size={15} className="animate-spin" />}{kind === 'website' ? 'Read my website' : 'Add'}</button>
            <button type="button" className="acq-btn" disabled={!!busy} onClick={() => { setKind(null); setMsg(null); }}>Back</button>
            {busy === 'add' && kind === 'website' && <span className="acq-faint" style={{ fontSize: 12.5 }}>Reading your website. This can take up to 40 seconds.</span>}
          </div>
        </>}
      </div>
    </div>
  );
}
