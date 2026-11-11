'use client';

import { Fragment, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Loader2, Play, Search } from 'lucide-react';

/**
 * Prospect Lab (admin only): the Find Prospect idea with the experimental email engine beside the current email finder,
 * so we can judge the engine on real prospects before any customer sees it. Nothing here is saved or sent.
 */
interface Biz { id?: string; name?: string; website?: string; address?: string; phone?: string }
interface Disc { email: string; name?: string; title?: string; sources: Array<{ url: string; method: string; discoveredAt: string }>; verification: { status: string; confidence: number; reasons: string[] }; match: { person: { name: string }; level: string; score: number } | null }
interface Cand { email: string; rank: number; score: number; basis: string; verification?: { status: string } }
interface Engine { domain: string; discovered: Disc[]; patterns: { dominant: string | null; basis: string; patterns: Array<{ id: string; example: string; observations: number; confidence: number }> }; candidates: Cand[]; pagesScanned: number; people: Array<{ name: string; title?: string }>; meta: { elapsedMs: number } }
type Run<T> = { state: 'idle' | 'running' | 'done' | 'error'; data?: T; error?: string };
interface Row { key: string; label: string; website: string; person: string; address?: string; engine: Run<Engine>; current: Run<{ email: string | null; source: string | null }> }

const GOOD = new Set(['VERIFIED', 'LIKELY_VALID']);
const tone = (s: string) => (GOOD.has(s) ? 'text-emerald-400' : ['INVALID', 'DISPOSABLE'].includes(s) ? 'text-red-400' : 'text-amber-400');
const bestEngine = (e?: Engine) => e?.discovered.filter((d) => d.verification.status !== 'ROLE_BASED').sort((a, b) => b.verification.confidence - a.verification.confidence)[0]?.email
  ?? e?.discovered[0]?.email ?? null;

function verdict(r: Row): string {
  if (r.engine.state !== 'done' || r.current.state === 'running' || r.current.state === 'idle') return '';
  const a = bestEngine(r.engine.data)?.toLowerCase() ?? null; const b = r.current.data?.email?.toLowerCase() ?? null;
  return a && b ? (a === b ? 'Same' : 'Different') : a ? 'Engine only' : b ? 'Current only' : 'Neither';
}

export default function ProspectLabPanel() {
  const [mode, setMode] = useState<'paste' | 'search'>('paste');
  const [pasted, setPasted] = useState('');
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [alsoCurrent, setAlsoCurrent] = useState(true);
  const [running, setRunning] = useState(false);
  const stop = useRef(false);

  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const mk = (website: string, label: string, person = '', address?: string): Row => ({ key: `${website}|${person}|${Math.random().toString(36).slice(2, 7)}`, label, website, person, address, engine: { state: 'idle' }, current: { state: 'idle' } });

  function loadPasted() {
    const next = pasted.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 50).map((l) => { const [w, ...n] = l.split(','); return mk(w.trim(), w.trim(), n.join(',').trim()); });
    setRows(next); setMsg(next.length ? `${next.length} prospect(s) loaded (max 50).` : 'Nothing to load.');
  }
  async function search() {
    if (!query.trim()) return; setSearching(true); setMsg('');
    try {
      const res = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, ...(country.length === 2 ? { country } : {}) }) });
      const j = await res.json().catch(() => ({})) as { businesses?: Biz[]; error?: string };
      if (!res.ok) throw new Error(j.error || 'Search failed');
      const withSite = (j.businesses ?? []).filter((b) => b.website);
      setRows(withSite.map((b) => mk(b.website!, b.name || b.website!, '', b.address)));
      setMsg(`${(j.businesses ?? []).length} businesses found, ${withSite.length} with a website. (This used one of your own searches.)`);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Search failed'); } finally { setSearching(false); }
  }

  async function runOne(r: Row) {
    patch(r.key, { engine: { state: 'running' }, current: { state: alsoCurrent ? 'running' : 'idle' } });
    const eng = fetch('/api/admin/email-engine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ website: r.website, name: r.person || undefined }) })
      .then(async (res) => { const j = await res.json(); if (!res.ok) throw new Error(j.error || 'Failed'); patch(r.key, { engine: { state: 'done', data: j } }); })
      .catch((e) => patch(r.key, { engine: { state: 'error', error: e instanceof Error ? e.message : 'Failed' } }));
    const cur = alsoCurrent
      ? fetch('/api/enrich-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ website: r.website, name: r.label, location: r.address }) })
          .then(async (res) => { const j = await res.json(); if (!res.ok) throw new Error(j.error || 'Failed'); patch(r.key, { current: { state: 'done', data: j } }); })
          .catch((e) => patch(r.key, { current: { state: 'error', error: e instanceof Error ? e.message : 'Failed' } }))
      : Promise.resolve();
    await Promise.all([eng, cur]);
  }
  async function runAll() {
    stop.current = false; setRunning(true);
    const queue = rows.filter((r) => r.engine.state !== 'done');
    const worker = async () => { for (let r = queue.shift(); r && !stop.current; r = queue.shift()) await runOne(r); };
    await Promise.all([worker(), worker()]); setRunning(false);
  }

  const stats = useMemo(() => {
    const v = rows.map(verdict).filter(Boolean); const c = (k: string) => v.filter((x) => x === k).length;
    return { done: rows.filter((r) => r.engine.state === 'done').length, engineFound: rows.filter((r) => bestEngine(r.engine.data)).length, currentFound: rows.filter((r) => r.current.data?.email).length, same: c('Same'), different: c('Different'), engineOnly: c('Engine only'), currentOnly: c('Current only'), neither: c('Neither') };
  }, [rows]);

  function exportCsv() {
    const q = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = [['website', 'engine_email', 'engine_status', 'current_email', 'verdict'].join(',')];
    for (const r of rows) { const e = r.engine.data?.discovered.find((d) => d.email === bestEngine(r.engine.data)); lines.push([r.website, e?.email, e?.verification.status, r.current.data?.email, verdict(r)].map(q).join(',')); }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); a.download = 'prospect-lab.csv'; a.click(); URL.revokeObjectURL(a.href);
  }

  const card = 'bg-gray-900 border border-white/8 rounded-2xl p-5';
  const input = 'bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400';
  return (
    <div className="space-y-4">
      <div className={card}>
        <h2 className="text-base font-bold text-white">Prospect Lab</h2>
        <p className="text-sm text-gray-400 mt-1">Compare the experimental email engine with the current email finder on real prospects. Admin only. Nothing is saved, sent or shown to customers. Mailbox checks are off here, so verification stops at "mail server exists".</p>
        <div className="flex gap-2 mt-4">
          {(['paste', 'search'] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${mode === m ? 'bg-indigo-500 text-white' : 'bg-gray-800 text-gray-400'}`}>{m === 'paste' ? 'Paste websites' : 'Search businesses'}</button>)}
        </div>
        {mode === 'paste' ? (
          <div className="mt-3 space-y-2">
            <textarea className={`${input} w-full h-28 font-mono`} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={'One per line: website, optional person name\nacme.com, James Brown\nexample-dental.co.uk'} />
            <button onClick={loadPasted} className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-semibold">Load list</button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <input className={`${input} w-72`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. dentists in Lekki" onKeyDown={(e) => e.key === 'Enter' && search()} />
            <input className={`${input} w-24`} value={country} maxLength={2} onChange={(e) => setCountry(e.target.value.toUpperCase())} placeholder="Country" />
            <button onClick={search} disabled={searching} className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">{searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search</button>
            <span className="text-xs text-gray-500">Uses the same search as Find Prospect and counts against your own search allowance.</span>
          </div>
        )}
        {msg && <p className="text-sm text-gray-300 mt-3">{msg}</p>}
      </div>

      {rows.length > 0 && (
        <div className={card}>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={runAll} disabled={running} className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50">{running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run engine on {rows.filter((r) => r.engine.state !== 'done').length} prospect(s)</button>
            {running && <button onClick={() => { stop.current = true; }} className="px-3 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm">Stop</button>}
            <label className="text-sm text-gray-300 flex items-center gap-2"><input type="checkbox" checked={alsoCurrent} onChange={(e) => setAlsoCurrent(e.target.checked)} /> Also run the current email finder (uses its normal lookups)</label>
            <button onClick={exportCsv} className="ml-auto px-3 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm flex items-center gap-2"><Download className="w-4 h-4" /> CSV</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {[['Run', stats.done], ['Engine found an email', stats.engineFound], ['Current finder found', stats.currentFound], ['Same email', stats.same], ['Different email', stats.different], ['Engine only', stats.engineOnly], ['Current only', stats.currentOnly], ['Neither', stats.neither]].map(([l, v]) => (
              <div key={l as string} className="bg-gray-800/60 rounded-xl p-3"><p className="text-xl font-black text-white">{v}</p><p className="text-[11px] text-gray-500 uppercase tracking-wide">{l}</p></div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">"Different" and "Engine only" need a human check: the engine reads the website itself, the current finder also uses directories, so neither is automatically right.</p>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wide text-gray-500"><th className="py-2 pr-2" /><th className="py-2 pr-3">Prospect</th><th className="py-2 pr-3">Engine</th><th className="py-2 pr-3">Current finder</th><th className="py-2">Result</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const e = r.engine.data; const best = e?.discovered.find((d) => d.email === bestEngine(e)); const isOpen = open === r.key;
                  return (<Fragment key={r.key}>
                    <tr className="border-t border-white/5 align-top">
                      <td className="py-2 pr-2"><button onClick={() => setOpen(isOpen ? null : r.key)} className="text-gray-500" aria-label="Details">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button></td>
                      <td className="py-2 pr-3"><p className="text-white font-semibold">{r.label}</p><p className="text-xs text-gray-500">{r.website}{r.person ? ` · ${r.person}` : ''}</p></td>
                      <td className="py-2 pr-3">{r.engine.state === 'running' ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : r.engine.state === 'error' ? <span className="text-red-400 text-xs">{r.engine.error}</span> : e ? (best ? <><p className="text-white">{best.email}</p><p className={`text-xs ${tone(best.verification.status)}`}>{best.verification.status.replace('_', ' ')} · {e.discovered.length} found</p></> : <p className="text-gray-500 text-xs">None found ({e.pagesScanned} pages){e.candidates[0] ? ` · guess: ${e.candidates[0].email}` : ''}</p>) : <span className="text-gray-600">—</span>}</td>
                      <td className="py-2 pr-3">{r.current.state === 'running' ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : r.current.state === 'error' ? <span className="text-red-400 text-xs">{r.current.error}</span> : r.current.state === 'done' ? (r.current.data?.email ? <><p className="text-white">{r.current.data.email}</p><p className="text-xs text-gray-500">{r.current.data.source}</p></> : <p className="text-gray-500 text-xs">None found</p>) : <span className="text-gray-600">—</span>}</td>
                      <td className="py-2 text-xs font-semibold text-gray-300">{verdict(r)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-800/40"><td /><td colSpan={4} className="py-3 pr-3 space-y-3 text-xs">
                        {!e ? <p className="text-gray-500">Run the engine to see details.</p> : <>
                          <div><p className="text-gray-400 font-semibold mb-1">Found on the website ({e.discovered.length})</p>
                            {e.discovered.length === 0 ? <p className="text-gray-500">No public emails on {e.pagesScanned} page(s).</p> : e.discovered.map((d) => (
                              <p key={d.email} className="text-gray-300"><span className="text-white">{d.email}</span> <span className={tone(d.verification.status)}>{d.verification.status.replace('_', ' ')}</span> · {d.sources[0].method} · <a className="text-indigo-300 underline" href={d.sources[0].url} target="_blank" rel="noopener noreferrer">source</a>{d.match ? ` · ${d.match.person.name} (${d.match.level.toLowerCase()})` : ''}</p>))}</div>
                          <div><p className="text-gray-400 font-semibold mb-1">Naming pattern</p>
                            {e.patterns.dominant ? <p className="text-gray-300">Learned <code>{e.patterns.dominant}</code> from {e.patterns.patterns[0]?.observations} example(s), {Math.round((e.patterns.patterns[0]?.confidence ?? 0) * 100)}% confidence.</p> : <p className="text-gray-500">Not enough named examples; the engine does not guess a pattern.</p>}</div>
                          {e.candidates.length > 0 && <div><p className="text-gray-400 font-semibold mb-1">Guesses for {r.person} (INFERRED, never confirmed)</p>
                            {e.candidates.map((c) => <p key={c.email} className="text-gray-300">{c.rank}. {c.email} <span className="px-1.5 rounded bg-amber-300 text-amber-900 font-bold">INFERRED</span> score {c.score} · {c.basis.replace(/_/g, ' ').toLowerCase()}{c.verification ? ` · ${c.verification.status.replace('_', ' ')}` : ''}</p>)}</div>}
                          <p className="text-gray-600">{e.pagesScanned} pages read in {e.meta.elapsedMs} ms.</p></>}
                      </td></tr>)}
                  </Fragment>);
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
