'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2, Search, FileUp } from 'lucide-react';
import { api } from './format';

interface Overview {
  industryKey: string;
  gate: { allowed: boolean; reasons: string[] };
  budget: { used: number; cap: number; pausedUntil: string | null };
  counts: Record<'pending_research' | 'no_independent_source' | 'promoted' | 'excluded', number>;
  plan: Array<{ area: string; queryIndex: number; textQuery: string }>;
}
interface Candidate { id: string; placeId: string; area: string | null; status: string; acqProspectId: string | null; discoveredAt: string }

const STATUS_LABEL: Record<string, string> = {
  no_independent_source: 'Needs an independent source', pending_research: 'Pending', promoted: 'Now a prospect', excluded: 'Excluded',
};

function PromoteForm({ c, onDone }: { c: Candidate; onDone: () => void }) {
  const [f, setF] = useState({ business_name: '', website: '', source: '', source_url: '', phone: '', email: '' });
  const [attest, setAttest] = useState(false);
  const [independent, setIndependent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const ready = f.business_name.trim().length >= 2 && f.website.trim().length >= 4 && f.source.trim().length >= 2 && attest && independent;

  const submit = async () => {
    setBusy(true); setMsg('');
    try {
      const body = { action: 'promote', ...Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()])), attest: true, independentSource: true };
      const r = await fetch(`/api/acquisition/candidates/${c.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (r.ok && j.ok) onDone();
      else setMsg(j.ok === false ? `Not added: ${j.outcome}${j.reasons?.length ? ' — ' + j.reasons.join('; ') : ''}` : (j.error ?? 'Could not add'));
    } catch { setMsg('Could not add'); } finally { setBusy(false); }
  };

  const input = 'w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600';
  return (
    <div className="mt-2 space-y-2 bg-black/20 rounded-xl p-3">
      <p className="text-[11px] text-gray-400">Google gave us only an ID. Identify this clinic from a source <b>other than Google Maps / Places</b> (its own website, an association list, a referral).</p>
      <div className="grid sm:grid-cols-2 gap-2">
        <input aria-label="Clinic name" placeholder="Clinic name" value={f.business_name} onChange={set('business_name')} className={input} />
        <input aria-label="Website" placeholder="Website (from the independent source)" value={f.website} onChange={set('website')} className={input} />
        <input aria-label="Source" placeholder="Source, e.g. Lagos Dental Association member list 2026" value={f.source} onChange={set('source')} className={input} />
        <input aria-label="Source URL" placeholder="Source URL (optional)" value={f.source_url} onChange={set('source_url')} className={input} />
        <input aria-label="Business phone" placeholder="Business phone (optional)" value={f.phone} onChange={set('phone')} className={input} />
        <input aria-label="Role inbox" placeholder="Role inbox, e.g. info@… (optional)" value={f.email} onChange={set('email')} className={input} />
      </div>
      <label className="flex items-start gap-2 text-[11px] text-gray-300"><input type="checkbox" checked={independent} onChange={(e) => setIndependent(e.target.checked)} className="mt-0.5" /> This information did not come from Google Maps / Places.</label>
      <label className="flex items-start gap-2 text-[11px] text-gray-300"><input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-0.5" /> I confirm the data was lawfully obtained from the source stated.</label>
      <div className="flex items-center gap-3">
        <button disabled={!ready || busy} onClick={submit} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-purple-600 text-white disabled:opacity-40">{busy ? 'Adding…' : 'Add as prospect'}</button>
        {msg && <span role="alert" className="text-[11px] text-red-300">{msg}</span>}
      </div>
    </div>
  );
}

/** Two ways to find clinics: independent sources (import) and the Places finder (off until cleared). */
export default function DiscoveryPanel({ industryKey, onChanged }: { industryKey: string; onChanged?: () => void }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [filter, setFilter] = useState('no_independent_source');
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const load = useCallback(async () => {
    try {
      setOv(await api<Overview>(`/api/acquisition/discovery?industry=${encodeURIComponent(industryKey)}`));
      setCands((await api<{ items: Candidate[] }>(`/api/acquisition/candidates?industry=${encodeURIComponent(industryKey)}&status=${filter}`)).items);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load'); }
  }, [industryKey, filter]);
  useEffect(() => { load(); }, [load]);

  const run = async (area: string, queryIndex: number) => {
    setFlash('');
    try { await api('/api/acquisition/discovery/run', { method: 'POST', body: JSON.stringify({ industryKey, area, queryIndex }) }); setFlash(`Queued: ${area}, search ${queryIndex + 1}. Run the task queue from the Overview to process it.`); }
    catch (e) { setFlash(e instanceof Error ? e.message : 'Could not queue'); }
  };
  const exclude = async (c: Candidate) => {
    const reason = window.prompt('Why exclude this one? (e.g. a dental lab, closed, not a clinic)');
    if (!reason || reason.trim().length < 3) return;
    await fetch(`/api/acquisition/candidates/${c.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'exclude', reason: reason.trim() }) });
    load();
  };

  if (error) return <div className="flex items-center gap-2 text-sm text-red-300"><AlertCircle className="w-4 h-4" /> {error}</div>;
  if (!ov) return <Loader2 className="w-5 h-5 animate-spin text-gray-400" />;
  const areas = Array.from(new Set(ov.plan.map((p) => p.area)));

  return (
    <div className="space-y-5">
      <section className="border border-white/8 bg-white/[0.02] rounded-2xl p-5 space-y-2">
        <h2 className="text-sm font-bold text-white flex items-center gap-2"><FileUp className="w-4 h-4" /> Route A: independent sources</h2>
        <p className="text-xs text-gray-400">Association member lists, directories you may use, clinic websites and referrals go in through the <b>Import</b> tab (CSV or one at a time). Each clinic carries the source you attest to; Google Maps / Places-sourced rows are refused.</p>
      </section>

      <section className="border border-white/8 bg-white/[0.02] rounded-2xl p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2"><Search className="w-4 h-4" /> Route B: Google Places finder</h2>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${ov.gate.allowed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>{ov.gate.allowed ? 'On' : 'Off'}</span>
          <span className="text-[11px] text-gray-500">Searches today: {ov.budget.used} of {ov.budget.cap}</span>
        </div>
        {!ov.gate.allowed && (
          <ul className="text-[11px] text-amber-600 list-disc pl-5 space-y-0.5">{ov.gate.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        )}
        <p className="text-xs text-gray-400">A search finds only a Google place ID. No name, phone, website or rating is stored. Each find waits below until you identify it from an independent source.</p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead><tr className="text-left text-gray-500"><th className="py-1 pr-3">Area</th>{Array.from(new Set(ov.plan.map((p) => p.queryIndex))).map((q) => <th key={q} className="pr-3">Search {q + 1}</th>)}</tr></thead>
            <tbody>{areas.map((a) => (
              <tr key={a} className="border-t border-white/5"><td className="py-1.5 pr-3 text-gray-300">{a}</td>
                {ov.plan.filter((p) => p.area === a).map((p) => (
                  <td key={p.queryIndex} className="pr-3"><button disabled={!ov.gate.allowed} title={ov.gate.allowed ? p.textQuery : 'Switched off'} onClick={() => run(a, p.queryIndex)} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed">Queue</button></td>
                ))}
              </tr>))}</tbody>
          </table>
        </div>
        {flash && <p role="status" className="text-xs text-gray-300">{flash}</p>}
      </section>

      <section className="border border-white/8 bg-white/[0.02] rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-bold text-white">Candidates found by the finder</h2>
        <div className="flex flex-wrap gap-2">
          {(['no_independent_source', 'promoted', 'excluded'] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${filter === s ? 'border-purple-500 text-white' : 'border-white/10 text-gray-400'}`}>{STATUS_LABEL[s]} ({ov.counts[s]})</button>
          ))}
        </div>
        {cands.length === 0 ? <p className="text-xs text-gray-500">None here. {ov.gate.allowed ? 'Queue a search above.' : 'Nothing has been found yet because the finder is off; use Route A.'}</p> : (
          <ul className="space-y-2">{cands.map((c) => (
            <li key={c.id} className="border border-white/8 rounded-xl p-3">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="text-gray-300">Place {c.placeId.slice(0, 12)}…</span><span className="text-gray-500">{c.area ?? 'area not recorded'}</span>
                <span className="text-gray-400">{STATUS_LABEL[c.status] ?? c.status}</span>
                {c.status === 'promoted' && <span className="text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> prospect created</span>}
                {c.status === 'no_independent_source' && (<span className="ml-auto flex gap-2">
                  <button onClick={() => setOpen(open === c.id ? null : c.id)} className="font-bold text-purple-300">{open === c.id ? 'Close' : 'Add independent source'}</button>
                  <button onClick={() => exclude(c)} className="text-gray-400 hover:text-gray-200">Exclude</button>
                </span>)}
              </div>
              {open === c.id && <PromoteForm c={c} onDone={() => { setOpen(null); load(); onChanged?.(); }} />}
            </li>))}</ul>
        )}
      </section>
    </div>
  );
}
