'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { ADMIN_STATUS_LABEL, CATEGORIES, type TicketStatus } from '@/lib/supportShared';

type Ticket = { id: string; ref: string; email: string; name: string | null; subject: string; category: string; status: TicketStatus; lastBy: 'user' | 'staff'; createdAt: string; lastReplyAt: string };
type Msg = { id: string; author: 'user' | 'staff'; authorName: string | null; body: string; createdAt: string };
type Detail = { ticket: Ticket; messages: Msg[]; customer: { plan: string; since: string } | null };

const card = 'bg-gray-900 border border-white/8 rounded-2xl';
const input = 'w-full bg-gray-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60';
const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const STATUS_STYLE: Record<TicketStatus, string> = { open: 'bg-red-500/15 text-red-300', pending: 'bg-amber-500/15 text-amber-300', resolved: 'bg-emerald-500/15 text-emerald-300', closed: 'bg-gray-500/15 text-gray-400' };
const FILTERS: Array<[string, string]> = [['open', 'Needs a reply'], ['pending', 'Waiting on customer'], ['resolved', 'Resolved'], ['closed', 'Closed'], ['all', 'All']];

export default function SupportPanel() {
  const [filter, setFilter] = useState('open');
  const [q, setQ] = useState('');
  const [list, setList] = useState<Ticket[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reply, setReply] = useState('');
  const [after, setAfter] = useState<'' | TicketStatus>('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/support?status=${filter}&q=${encodeURIComponent(q)}`, { cache: 'no-store' });
      const json = await res.json() as { tickets?: Ticket[]; counts?: Record<string, number>; error?: string };
      if (!res.ok) { setError(json.error ?? 'Could not load tickets.'); setList([]); return; }
      setList(json.tickets ?? []); setCounts(json.counts ?? {}); setError('');
    } catch { setError('Could not load tickets.'); setList([]); }
  }, [filter, q]);
  useEffect(() => { const t = setTimeout(() => void load(), q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);

  const open = useCallback(async (id: string) => {
    setSel(id); setDetail(null); setNote(''); setReply(''); setAfter('');
    const res = await fetch(`/api/admin/support/${id}`, { cache: 'no-store' }).catch(() => null);
    if (res?.ok) setDetail(await res.json() as Detail); else setNote('Could not load this ticket.');
  }, []);

  const send = async () => {
    if (!sel) return;
    setBusy(true); setNote('');
    try {
      const res = await fetch(`/api/admin/support/${sel}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: reply, ...(after ? { status: after } : {}) }) });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setNote(json.error ?? 'Could not send.'); return; }
      setReply(''); setAfter(''); setNote('Reply sent and emailed to the customer.');
      await Promise.all([open(sel).then(() => setNote('Reply sent and emailed to the customer.')), load()]);
    } catch { setNote('Could not reach the server.'); } finally { setBusy(false); }
  };
  const setStatus = async (status: TicketStatus) => {
    if (!sel) return;
    setBusy(true);
    const res = await fetch(`/api/admin/support/${sel}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }).catch(() => null);
    setNote(res?.ok ? `Marked ${ADMIN_STATUS_LABEL[status].toLowerCase()}.` : 'Could not update.');
    await Promise.all([open(sel).then(() => res?.ok && setNote(`Marked ${ADMIN_STATUS_LABEL[status].toLowerCase()}.`)), load()]);
    setBusy(false);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
      <div className={`${card} p-4`}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${filter === id ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                {label}{id !== 'all' && counts[id] ? ` ${counts[id]}` : ''}
              </button>
            ))}
          </div>
          <button onClick={() => void load()} aria-label="Refresh" className="p-1.5 rounded-lg text-gray-400 hover:bg-white/10"><RefreshCw className="w-4 h-4" /></button>
        </div>
        <input className={`${input} mb-3`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subject, email or RX- reference" />
        {error && <p role="alert" className="text-sm text-red-400 mb-2">{error}</p>}
        {list === null ? <p className="text-sm text-gray-500 py-6 text-center"><Loader2 className="inline w-4 h-4 animate-spin" /> Loading</p>
          : list.length === 0 && !error ? <p className="text-sm text-gray-500 py-6 text-center">No tickets here.</p>
          : <ul className="divide-y divide-white/5">
            {list.map((t) => (
              <li key={t.id}>
                <button onClick={() => void open(t.id)} className={`w-full text-left py-3 px-2 rounded-lg ${sel === t.id ? 'bg-white/5' : 'hover:bg-white/[.03]'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white truncate">{t.subject}</span>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[t.status]}`}>{ADMIN_STATUS_LABEL[t.status]}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{t.ref} · {t.email} · {fmt(t.lastReplyAt)}</p>
                </button>
              </li>
            ))}
          </ul>}
      </div>

      <div className={`${card} p-5 min-h-[320px]`}>
        {!sel ? <p className="text-sm text-gray-500">Select a ticket to read it and reply. Replies are emailed to the customer and appear in their Help &amp; support.</p>
          : !detail ? <p className="text-sm text-gray-500">{note || <><Loader2 className="inline w-4 h-4 animate-spin" /> Loading</>}</p>
          : <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-white">{detail.ticket.subject}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{detail.ticket.ref} · {CATEGORIES.find((c) => c.id === detail.ticket.category)?.label ?? detail.ticket.category} · {detail.ticket.name ? `${detail.ticket.name}, ` : ''}{detail.ticket.email}{detail.customer ? ` · plan ${detail.customer.plan}` : ''}</p>
              </div>
              <div className="flex gap-1.5">
                {(['resolved', 'closed', 'open'] as TicketStatus[]).filter((s) => s !== detail.ticket.status).map((s) => (
                  <button key={s} disabled={busy} onClick={() => void setStatus(s)} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-50">{s === 'open' ? 'Reopen' : `Mark ${s}`}</button>
                ))}
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {detail.messages.map((m) => (
                <div key={m.id} className={`rounded-xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${m.author === 'staff' ? 'bg-purple-500/10 text-purple-100 ml-8' : 'bg-white/5 text-gray-200 mr-8'}`}>
                  <p className="text-[11px] text-gray-500 mb-1">{m.author === 'staff' ? 'Support' : (m.authorName ?? 'Customer')} · {fmt(m.createdAt)}</p>
                  {m.body}
                </div>
              ))}
            </div>
            {detail.ticket.status === 'closed' ? <p className="text-sm text-gray-500 mt-4">Closed. Reopen it to reply.</p> : (
              <div className="mt-4 space-y-2">
                <textarea className={input} rows={5} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write your reply. It is emailed to the customer." />
                <div className="flex flex-wrap items-center gap-3">
                  <button disabled={busy || reply.trim().length < 2} onClick={() => void send()} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Sending...' : 'Send reply'}</button>
                  <label className="text-xs text-gray-400">After sending:{' '}
                    <select value={after} onChange={(e) => setAfter(e.target.value as '' | TicketStatus)} className="bg-gray-950 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
                      <option value="">Wait on customer</option><option value="resolved">Mark resolved</option><option value="closed">Close</option>
                    </select>
                  </label>
                </div>
              </div>
            )}
            {note && <p role="status" className="text-xs text-emerald-400 mt-3">{note}</p>}
          </>}
      </div>
    </div>
  );
}
