'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, Square, Star, Zap } from 'lucide-react';
import { AREAS, STATES } from '@/lib/areas';
import { ACTION_LABEL, CONTACT_ACTION, CONTACT_LABEL, contactState, isVerifiedStatus, DEFAULT_FILTERS, toCsv, FINDER_COUNTRIES, FINDER_INDUSTRIES, MAX_RUN_SEARCHES, advanceFinder, filterResults, filtersActive, finderError, finderQuery, planStep, startFinder, stepsLeft, stopReason, type FinderBusiness, type FinderCtx, type ContactAction, type ContactState, type RatingFilter, type ResultFilters, type Verdict, type SortKey, type WebsiteFilter } from '@/lib/acqFinder';
import { BizLogo, Card, EmptyState } from './ui';
import { useAcq } from './AcqProvider';

type Email = { state: 'loading' } | { state: 'done'; email: string | null };
type Person = { name: string; title: string; email?: string; emailStatus?: string; source: string; sourcePage?: string; linkedin?: string };
type Channel = { type: 'decision_maker_email' | 'general_email' | 'contact_form' | 'business_phone' | 'none'; value?: string; person?: string; sourcePage?: string };
type People = { state: 'loading' } | { state: 'done'; people: Person[]; channels: Channel[]; note?: string };
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const label = { fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, display: 'block' } as const;

/** Finds businesses on Google Maps with the same search RUNVAX 1.0 uses, lists them, finds their emails and adds them to a campaign. */
export default function ProspectFinder({ onAdded }: { onAdded: (msg: string) => void }) {
  const { data } = useAcq();
  const [country, setCountry] = useState('NG');
  const [state, setState] = useState('');
  const [location, setLocation] = useState('');
  const [industry, setIndustry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<FinderBusiness[] | null>(null);
  const [cached, setCached] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [emails, setEmails] = useState<Record<string, Email>>({});
  const [target, setTarget] = useState('');
  const [adding, setAdding] = useState(false);
  const [finding, setFinding] = useState(false);
  const [ctx, setCtx] = useState<FinderCtx | null>(null);
  const [running, setRunning] = useState(false);
  const [maxRun, setMaxRun] = useState(MAX_RUN_SEARCHES);
  const [want, setWant] = useState(100);
  const [progress, setProgress] = useState('');
  const [people, setPeople] = useState<Record<string, People>>({});
  const [findingDm, setFindingDm] = useState(false);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [verifying, setVerifying] = useState<Set<string>>(new Set());
  const [verifyingAll, setVerifyingAll] = useState(false);
  const [includeUnverified, setIncludeUnverified] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ContactState | 'any'>('any');
  const [filters, setFilters] = useState<ResultFilters>(DEFAULT_FILTERS);
  const seen = useRef(new Set<string>());
  const stop = useRef(false);
  useEffect(() => () => { stop.current = true; }, []);

  const states = STATES.filter((s) => s.country === country);
  const places = useMemo(() => {
    const cities = state ? STATES.find((s) => s.code === state)?.cities ?? [] : null;
    return AREAS.filter((a) => a.country === country && (!cities || cities.includes(a.city))).map((a) => a.name).slice(0, 400);
  }, [country, state]);
  const campaigns = (data?.campaigns ?? []).filter((c) => c.status !== 'completed' || true);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const bad = finderError(industry, location);
    if (bad) { setError(bad); return; }
    stop.current = true; setRunning(false); setProgress('');
    setBusy(true); setError(''); setResults(null); setFilters(DEFAULT_FILTERS); setPicked(new Set()); setEmails({}); setPeople({}); setVerdicts({}); setStatusFilter('any'); setCtx(null); seen.current = new Set();
    try {
      const res = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ industry, location, country, radius: 5, query: finderQuery(industry, location) }) });
      const j = await res.json().catch(() => ({})) as { businesses?: FinderBusiness[]; error?: string; cached?: boolean };
      if (!res.ok) { setError(j.error ?? 'The search failed. Try again in a moment.'); return; }
      const found = (j.businesses ?? []).slice(0, want).map((b) => ({ ...b, foundBy: 'First search' }));
      setResults(found); setCached(!!j.cached);
      found.forEach((b) => seen.current.add(b.id));
      const withLoc = found.filter((b) => b.location);
      const centre = withLoc.length ? { lat: withLoc.reduce((a, b) => a + b.location!.latitude, 0) / withLoc.length, lng: withLoc.reduce((a, b) => a + b.location!.longitude, 0) / withLoc.length } : undefined;
      const c0 = startFinder(industry.trim(), location.trim(), country, state, centre);
      setCtx(c0);
      if (found.length < want) { setBusy(false); void keepFinding(c0); }
    } catch { setError('Could not reach the search. Check your connection.'); } finally { setBusy(false); }
  };

  /** Runs one load-more step. Returns the new context, how many new prospects it found, and a reason to stop if it must. */
  const runStep = async (c: FinderCtx, room = Infinity): Promise<{ ctx: FinderCtx; fresh: number; halt?: string }> => {
    const step = planStep(c);
    if (!step) return { ctx: c, fresh: 0 };
    try {
      const res = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: step.query, lat: step.lat, lng: step.lng, radius: c.radius, location: step.location, country: c.country }) });
      const j = await res.json().catch(() => ({})) as { businesses?: FinderBusiness[]; error?: string; code?: string };
      if (res.status === 402) return { ctx: c, fresh: 0, halt: j.error ?? 'You have used all of today\'s searches on your plan.' };
      if (!res.ok) return { ctx: advanceFinder(c, 0), fresh: 0, ...(res.status >= 500 ? { halt: j.error ?? 'The search failed. Try again in a moment.' } : {}) };
      const fresh = (j.businesses ?? []).filter((b) => !seen.current.has(b.id)).slice(0, room).map((b) => ({ ...b, foundBy: step.label }));
      fresh.forEach((b) => seen.current.add(b.id));
      if (fresh.length) setResults((r) => [...(r ?? []), ...fresh]);
      return { ctx: advanceFinder(c, fresh.length), fresh: fresh.length };
    } catch { return { ctx: c, fresh: 0, halt: 'Could not reach the search. Check your connection.' }; }
  };

  const loadMore = async () => {
    if (!ctx || running) return;
    setBusy(true); setError('');
    const r = await runStep(ctx);
    setCtx(r.ctx); setBusy(false);
    setProgress(r.halt ? '' : `${planStep(ctx)?.label}: ${r.fresh} new`);
    if (r.halt) setError(r.halt);
  };

  /** Keeps running steps until Google has nothing more, the plan's searches run out, or the user stops it. */
  const keepFinding = async (from: FinderCtx | null = ctx) => {
    if (!from || running) return;
    stop.current = false; setRunning(true); setError('');
    let c = from; let dry = 0; let total = 0; let n = 0;
    while (!stop.current) {
      const why = seen.current.size >= want ? `Found ${seen.current.size} businesses, your target.` : n >= maxRun ? `Reached your limit of ${maxRun} searches for this run.` : stopReason(c, dry);
      if (why) { setProgress(`Done: ${seen.current.size} businesses in the table (${n} extra searches). ${why}`); break; }
      setProgress(`${planStep(c)?.label} · ${seen.current.size} of ${want} businesses`);
      const r = await runStep(c, want - seen.current.size);
      n++; total += r.fresh; dry = r.fresh === 0 ? dry + 1 : 0; c = r.ctx; setCtx(c);
      if (r.halt) { setError(r.halt); setProgress(`Stopped: ${total} new prospects found in ${n} searches.`); break; }
    }
    if (stop.current) setProgress(`Stopped: ${total} new prospects found in ${n} searches.`);
    setRunning(false);
  };

  const findEmail = async (b: FinderBusiness) => {
    setEmails((m) => ({ ...m, [b.id]: { state: 'loading' } }));
    try {
      const res = await fetch('/api/enrich-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ website: b.website, name: b.name, location: b.address, phone: b.phone }) });
      const j = await res.json().catch(() => ({})) as { email?: string | null };
      setEmails((m) => ({ ...m, [b.id]: { state: 'done', email: j.email && EMAIL_OK.test(j.email) ? j.email : null } }));
    } catch { setEmails((m) => ({ ...m, [b.id]: { state: 'done', email: null } })); }
  };
  const findForSelected = async () => {
    setFinding(true);
    const todo = (results ?? []).filter((b) => picked.has(b.id) && !emails[b.id]);
    for (let i = 0; i < todo.length; i += 3) await Promise.all(todo.slice(i, i + 3).map(findEmail));
    setFinding(false);
  };

  /** Decision-makers and their emails for one business: the free sources first, then the paid ones (Snov.io, Hunter…) when allowed. */
  const findPeople = async (b: FinderBusiness, opts: { deep?: boolean } = {}) => {
    setPeople((m) => ({ ...m, [b.id]: { state: 'loading' } }));
    const ask = async (deep: boolean) => {
      const res = await fetch('/api/decision-maker/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: b.name, address: b.address, website: b.website, category: b.category, deep }) });
      const j = await res.json().catch(() => ({})) as { candidates?: Person[]; channels?: Channel[]; error?: string };
      return { ok: res.ok, status: res.status, people: j.candidates ?? [], channels: j.channels ?? [], error: j.error };
    };
    try {
      // "Find email" and "Retry discovery" go straight to the deeper (paid) search; a first search starts with the free sources.
      let r = opts.deep ? { ok: true, status: 200, people: [] as Person[], channels: [] as Channel[], error: undefined as string | undefined } : await ask(false);
      let note: string | undefined;
      if (r.ok && !r.people.some((p) => p.email)) {
        const deep = await ask(true);
        if (deep.ok) r = deep;
        else if (opts.deep) r = deep;
        else if (deep.status === 403) note = 'A deeper email search needs a paid plan.';
        else if (deep.status === 429) note = deep.error;
      }
      setPeople((m) => ({ ...m, [b.id]: { state: 'done', people: r.people, channels: r.channels, note: r.ok ? note : (r.error ?? 'Lookup failed.') } }));
    } catch { setPeople((m) => ({ ...m, [b.id]: { state: 'done', people: [], channels: [], note: 'Lookup failed.' } })); }
  };
  const findPeopleForSelected = async () => {
    setFindingDm(true);
    const todo = (results ?? []).filter((b) => picked.has(b.id) && !people[b.id]);
    // Two at a time: each can chain several provider calls.
    for (let i = 0; i < todo.length; i += 2) await Promise.all(todo.slice(i, i + 2).map((b) => findPeople(b)));
    setFindingDm(false);
  };
  const peopleOf = (b: FinderBusiness): Person[] | null => { const p = people[b.id]; return p?.state === 'done' ? p.people : null; };
  const emailOf = (b: FinderBusiness) => { const e = emails[b.id]; return e?.state === 'done' ? e.email : null; };
  const channelsOf = (b: FinderBusiness): Channel[] => { const p = people[b.id]; return p?.state === 'done' ? p.channels : []; };
  const generalEmailOf = (b: FinderBusiness) => emailOf(b) ?? channelsOf(b).find((c) => c.type === 'general_email')?.value ?? null;
  const stateOf = (b: FinderBusiness): ContactState => contactState({
    people: peopleOf(b), businessEmail: emails[b.id]?.state === 'done' ? emailOf(b) : undefined,
    businessChannel: channelsOf(b).some((c) => c.type === 'general_email' || c.type === 'contact_form'), verdicts,
  });
  const personOk = (p: Person) => { const v = p.email ? verdicts[p.email.toLowerCase()] : undefined; return v ? v === 'valid' : isVerifiedStatus(p.emailStatus); };
  const usablePeople = (b: FinderBusiness) => (peopleOf(b) ?? []).filter((p) => p.email && verdicts[p.email.toLowerCase()] !== 'invalid');

  /** Check the addresses of one business's people with Snov.io and remember each answer. */
  const verifyEmailsOf = async (emailsToCheck: string[]): Promise<boolean> => {
    for (let i = 0; i < emailsToCheck.length; i += 10) {
      const res = await fetch('/api/decision-maker/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emails: emailsToCheck.slice(i, i + 10) }) });
      const j = await res.json().catch(() => ({})) as { results?: Record<string, Verdict>; error?: string };
      if (!res.ok) { setError(j.error ?? 'Could not verify the emails.'); return false; }
      setVerdicts((v) => ({ ...v, ...(j.results ?? {}) }));
    }
    return true;
  };
  const verifyOne = async (b: FinderBusiness) => {
    setVerifying((s) => new Set(s).add(b.id));
    try { await verifyEmailsOf(usablePeople(b).filter((p) => !personOk(p)).map((p) => p.email!)); }
    finally { setVerifying((s) => { const n = new Set(s); n.delete(b.id); return n; }); }
  };
  const verifySelected = async () => {
    setVerifyingAll(true); setError('');
    try { await verifyEmailsOf(Array.from(new Set((results ?? []).filter((b) => picked.has(b.id)).flatMap((b) => usablePeople(b).filter((p) => !personOk(p)).map((p) => p.email!.toLowerCase()))))); }
    finally { setVerifyingAll(false); }
  };
  const act = (b: FinderBusiness, action: ContactAction) => {
    if (action === 'verify') return void verifyOne(b);
    if (action === 'find_dm') return void findPeople(b);
    return void findPeople(b, { deep: true }); // find_email, retry
  };

  // Ready for a campaign: only contacts whose address is verified, unless the sender chooses to include the rest.
  type Lead = { email: string; name?: string; business: string; website?: string };
  const leadsFor = (b: FinderBusiness): Lead[] => {
    const base = { business: b.name, website: b.website ?? undefined };
    const verified = usablePeople(b).filter(personOk).slice(0, 3);
    if (verified.length) return verified.map((p) => ({ email: p.email!, name: p.name, ...base }));
    if (!includeUnverified) return [];
    const loose = usablePeople(b).slice(0, 3);
    if (loose.length) return loose.map((p) => ({ email: p.email!, name: p.name, ...base }));
    const biz = generalEmailOf(b);
    return biz ? [{ email: biz, ...base }] : [];
  };
  const ready = (results ?? []).filter((b) => picked.has(b.id) && leadsFor(b).length > 0);
  const notReady = (results ?? []).filter((b) => picked.has(b.id) && leadsFor(b).length === 0).length;
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const shown = useMemo(() => filterResults(results ?? [], filters, (b) => { const e = emails[b.id]; return e?.state === 'done' && !!e.email; }).filter((b) => statusFilter === 'any' || stateOf(b) === statusFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results, filters, emails, people, verdicts, statusFilter]);
  const setF = <K extends keyof ResultFilters>(k: K, v: ResultFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const allOn = !!shown.length && shown.every((b) => picked.has(b.id));

  /** Downloads the rows on screen (with what was found so far) as a CSV: for a manual quality review, or as input for scripts/contact-intel-experiment.ts. */
  const exportCsv = () => {
    const rows: unknown[][] = [['name', 'website', 'address', 'phone', 'category', 'rating', 'reviews', 'contact_status', 'people', 'general_email', 'contact_form']];
    for (const b of shown) {
      const ch = channelsOf(b);
      rows.push([b.name, b.website ?? '', b.address, b.phone ?? '', b.category ?? '', b.rating ?? '', b.reviewCount ?? '', CONTACT_LABEL[stateOf(b)],
        (peopleOf(b) ?? []).map((p) => `${p.name} (${p.title})${p.email ? ` <${p.email}>` : ''}`).join(' | '), generalEmailOf(b) ?? '', ch.find((c) => c.type === 'contact_form')?.value ?? '']);
    }
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const add = async () => {
    if (!target || !ready.length) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/outreach-campaigns/${target}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leads: ready.flatMap(leadsFor) }) });
      const j = await res.json().catch(() => ({})) as { added?: number; duplicates?: number; error?: string };
      if (!res.ok) { setError(j.error ?? 'Could not add them.'); return; }
      onAdded(`Added ${j.added ?? 0} prospect${j.added === 1 ? '' : 's'} to the campaign${j.duplicates ? `; ${j.duplicates} were already there` : ''}.`);
      setPicked(new Set());
    } catch { setError('Could not add them.'); } finally { setAdding(false); }
  };

  return (
    <Card title="Find prospects on Google Maps">
      <form onSubmit={search} style={{ display: 'grid', gap: 12 }}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div><label style={label} htmlFor="pf-country">1 · Country</label><select id="pf-country" className="acq-select" value={country} onChange={(e) => { setCountry(e.target.value); setState(''); setLocation(''); }}>{FINDER_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
          <div><label style={label} htmlFor="pf-state">2 · State or region</label><select id="pf-state" className="acq-select" value={state} onChange={(e) => { setState(e.target.value); setLocation(''); }} disabled={!states.length}><option value="">{states.length ? 'Any' : 'Not needed'}</option>{states.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></div>
          <div><label style={label} htmlFor="pf-loc">3 · Location</label><input id="pf-loc" className="acq-input" list="pf-places" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Lekki, Lagos" maxLength={120} /><datalist id="pf-places">{places.map((p) => <option key={p} value={p} />)}</datalist></div>
          <div><label style={label} htmlFor="pf-ind">4 · Business category</label><input id="pf-ind" className="acq-input" list="pf-inds" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Dental Clinics" maxLength={80} /><datalist id="pf-inds">{FINDER_INDUSTRIES.map((i) => <option key={i} value={i} />)}</datalist></div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>5 · How many businesses <input type="number" min={1} max={100} className="acq-input" aria-label="How many businesses" style={{ width: 80, height: 36 }} value={want} onChange={(e) => setWant(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} /></label>
          <button className="acq-btn acq-btn-primary" type="submit" disabled={busy || running}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Find prospects</button>
          <span className="acq-faint" style={{ fontSize: 12 }}>One search returns up to about 20 to 60 businesses, so RUNVAX keeps searching the same location, then nearby areas, until it reaches your number. Each search counts toward your plan&apos;s daily searches.</span>
        </div>
      </form>
      {error && <p role="alert" className="acq-warn" style={{ marginTop: 12 }}>{error}</p>}

      {(busy || running) && (() => {
        const n = results?.length ?? 0;
        const pct = Math.min(100, Math.round((n / Math.max(1, want)) * 100));
        return (
          <div role="status" aria-live="polite" style={{ marginTop: 14, padding: '14px 16px', background: '#faf5ff', border: '1px solid #f3e8ff', borderRadius: 14, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Loader2 size={22} className="animate-spin" style={{ color: '#9333ea', flex: 'none' }} />
              <b style={{ fontSize: 15 }}>Searching for prospects…</b>
              <span style={{ marginLeft: 'auto', fontSize: 15 }}><b style={{ fontSize: 22, color: '#7e22ce' }}>{n}</b> <span className="acq-sub">of {want} found</span></span>
            </div>
            <div style={{ height: 8, background: '#ede9fe', borderRadius: 999, overflow: 'hidden' }} role="progressbar" aria-valuenow={n} aria-valuemin={0} aria-valuemax={want} aria-label="Prospects found">
              <div style={{ width: `${pct}%`, height: '100%', background: '#9333ea', transition: 'width .4s ease' }} />
            </div>
            <p className="acq-sub" style={{ fontSize: 12.5 }}>{running ? (progress || 'Starting…') : 'Searching Google Maps…'}</p>
          </div>
        );
      })()}

      {results && (
        <div style={{ marginTop: 16 }}>
          {results.length === 0 ? <EmptyState title="No businesses found" body="Try a nearby area or a different category." /> : (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                <b style={{ fontSize: 14 }}>{filtersActive(filters) || statusFilter !== 'any' ? `${shown.length} of ${results.length}` : results.length} prospects{cached ? ' (first search from a recent search)' : ''}</b>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={allOn} onChange={() => setPicked(allOn ? new Set() : new Set(shown.map((b) => b.id)))} style={{ accentColor: '#9333ea' }} /> Select all</label>
                <button className="acq-btn acq-btn-sm" disabled={!picked.size || finding} onClick={() => void findForSelected()}>{finding ? <Loader2 size={14} className="animate-spin" /> : null} Find business emails for {picked.size || 'selected'}</button>
                <button className="acq-btn acq-btn-primary acq-btn-sm" disabled={!picked.size || findingDm} onClick={() => void findPeopleForSelected()}>{findingDm ? <Loader2 size={14} className="animate-spin" /> : null} Find decision-makers for {picked.size || 'selected'}</button>
                <button className="acq-btn acq-btn-sm" disabled={!picked.size || verifyingAll} onClick={() => void verifySelected()}>{verifyingAll ? <Loader2 size={14} className="animate-spin" /> : null} Verify emails for {picked.size || 'selected'}</button>
                <button className="acq-btn acq-btn-sm" onClick={exportCsv} title="Download the rows on screen as a CSV">Export CSV</button>
                <select className="acq-select" aria-label="Add to campaign" style={{ width: 'auto', minWidth: 200, height: 36, marginLeft: 'auto' }} value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">Choose a campaign…</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button className="acq-btn acq-btn-primary acq-btn-sm" disabled={!target || !ready.length || adding} onClick={() => void add()}>{adding ? <Loader2 size={14} className="animate-spin" /> : null} Add {ready.length} ready to campaign</button>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', margin: '4px 0 10px', padding: 10, border: '1px solid #e2e8f0', borderRadius: 12 }} role="group" aria-label="Filter and sort the prospects">
                <div><label style={label} htmlFor="pf-f-web">Website</label>
                  <select id="pf-f-web" className="acq-select" style={{ height: 34, width: 'auto' }} value={filters.website} onChange={(e) => setF('website', e.target.value as WebsiteFilter)}>
                    <option value="any">Any</option><option value="without">No website</option><option value="with">Has a website</option>
                  </select></div>
                <div><label style={label} htmlFor="pf-f-rate">Rating</label>
                  <select id="pf-f-rate" className="acq-select" style={{ height: 34, width: 'auto' }} value={filters.rating} onChange={(e) => setF('rating', e.target.value as RatingFilter)}>
                    <option value="any">Any</option><option value="4.5+">4.5 and up</option><option value="4+">4.0 and up</option><option value="3.5+">3.5 and up</option><option value="3+">3.0 and up</option>
                    <option value="under4">Under 4.0</option><option value="under3.5">Under 3.5</option><option value="unrated">No rating yet</option>
                  </select></div>
                <div><label style={label} htmlFor="pf-f-rev">Reviews</label>
                  <select id="pf-f-rev" className="acq-select" style={{ height: 34, width: 'auto' }} value={filters.minReviews} onChange={(e) => setF('minReviews', Number(e.target.value))}>
                    <option value={0}>Any</option><option value={5}>5 or more</option><option value={20}>20 or more</option><option value={50}>50 or more</option><option value={100}>100 or more</option>
                  </select></div>
                <div><label style={label} htmlFor="pf-f-sort">Show first</label>
                  <select id="pf-f-sort" className="acq-select" style={{ height: 34, width: 'auto' }} value={filters.sort} onChange={(e) => setF('sort', e.target.value as SortKey)}>
                    <option value="found">Order found</option><option value="no-website-first">No website first</option><option value="website-first">Has a website first</option>
                    <option value="rating-high">Highest rated</option><option value="rating-low">Lowest rated</option><option value="reviews-high">Most reviews</option>
                  </select></div>
                <div><label style={label} htmlFor="pf-f-status">Contact status</label>
                  <select id="pf-f-status" className="acq-select" style={{ height: 34, width: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ContactState | 'any')}>
                    <option value="any">Any</option>{(Object.keys(CONTACT_LABEL) as ContactState[]).map((k) => <option key={k} value={k}>{CONTACT_LABEL[k]}</option>)}
                  </select></div>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, height: 34 }}><input type="checkbox" checked={filters.phoneOnly} onChange={(e) => setF('phoneOnly', e.target.checked)} style={{ accentColor: '#9333ea' }} /> Has a phone</label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, height: 34 }}><input type="checkbox" checked={filters.emailOnly} onChange={(e) => setF('emailOnly', e.target.checked)} style={{ accentColor: '#9333ea' }} /> Email found</label>
                {filtersActive(filters) || filters.sort !== 'found' || statusFilter !== 'any' ? <button type="button" className="acq-btn acq-btn-sm" onClick={() => { setFilters(DEFAULT_FILTERS); setStatusFilter('any'); }}>Clear</button> : null}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '4px 0 10px', padding: 10, background: '#faf5ff', border: '1px solid #f3e8ff', borderRadius: 12 }}>
                {running
                  ? <button className="acq-btn acq-btn-sm" onClick={() => { stop.current = true; }}><Square size={13} /> Stop</button>
                  : <>
                      <button className="acq-btn acq-btn-primary acq-btn-sm" disabled={!ctx || !planStep(ctx) || busy} onClick={() => void keepFinding()}><Zap size={14} /> Keep finding until there is no more</button>
                      <button className="acq-btn acq-btn-sm" disabled={!ctx || !planStep(ctx) || busy} onClick={() => void loadMore()}>{busy && ctx ? <Loader2 size={14} className="animate-spin" /> : null} Load more: {ctx && planStep(ctx) ? planStep(ctx)!.label : 'nothing left'}</button>
                    </>}
                {!running && <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>Up to <input type="number" min={1} max={MAX_RUN_SEARCHES} className="acq-input" aria-label="Searches per run" style={{ width: 72, height: 30 }} value={maxRun} onChange={(e) => setMaxRun(Math.max(1, Math.min(MAX_RUN_SEARCHES, Number(e.target.value) || 1)))} /> searches</label>}
                <span className="acq-sub" style={{ fontSize: 12.5 }} role="status">{running && <Loader2 size={13} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />}{progress || (ctx && planStep(ctx) ? `Tries the same location first, then nearby areas, then a wider area. Up to ${stepsLeft(ctx)} searches left; each counts toward your daily searches.` : 'Everything nearby has been tried.')}</span>
              </div>
              <p className="acq-faint" style={{ fontSize: 12, marginBottom: 6, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>Only <b>verified</b> contacts are added to a campaign, so nothing bounces.{picked.size > 0 && notReady > 0 ? ` ${notReady} of your ${picked.size} selected ${notReady === 1 ? 'is' : 'are'} not ready yet.` : ''}{campaigns.length === 0 ? ' Create a campaign first to add prospects to it.' : ''}</span>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={includeUnverified} onChange={(e) => setIncludeUnverified(e.target.checked)} style={{ accentColor: '#9333ea' }} /> Also add unverified and business-only emails</label>
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table className="acq-table" style={{ minWidth: 980 }}>
                  <thead><tr><th style={{ width: 32 }}><span className="sr-only">Select</span></th><th>Business</th><th>Address</th><th>Phone</th><th>Website</th><th>Rating</th><th>Email</th></tr></thead>
                  <tbody>
                    {shown.length === 0 && <tr><td colSpan={7} className="acq-sub" style={{ textAlign: 'center', padding: 20 }}>No prospects match these filters. <button type="button" className="acq-btn acq-btn-sm" onClick={() => { setFilters(DEFAULT_FILTERS); setStatusFilter('any'); }}>Clear filters</button></td></tr>}
                    {shown.map((b) => {
                      const e = emails[b.id];
                      const host = b.website ? b.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : '';
                      const href = b.website ? (/^https?:\/\//i.test(b.website) ? b.website : `https://${b.website}`) : '';
                      return (
                        <tr key={b.id}>
                          <td><input type="checkbox" aria-label={`Select ${b.name}`} checked={picked.has(b.id)} onChange={() => toggle(b.id)} style={{ accentColor: '#9333ea' }} /></td>
                          <td style={{ maxWidth: 240 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <BizLogo name={b.name} website={b.website} />
                              <span style={{ minWidth: 0 }}>
                                <span style={{ display: 'block', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                                <span className="acq-sub" style={{ fontSize: 12 }}>{b.category}{b.foundBy && b.foundBy !== 'First search' ? <span className="acq-pill acq-pill-purple" style={{ marginLeft: 6, fontWeight: 500 }}>{b.foundBy}</span> : null}</span>
                              </span>
                            </span>
                          </td>
                          <td className="acq-muted" style={{ maxWidth: 240 }}>{b.address || <span className="acq-faint">—</span>}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{b.phone || <span className="acq-faint">No phone</span>}</td>
                          <td style={{ maxWidth: 200 }}>{href ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#7e22ce', textDecoration: 'underline', overflowWrap: 'anywhere' }}>{host}</a> : <span className="acq-faint">No website</span>}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{typeof b.rating === 'number' ? <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Star size={12} />{b.rating}{b.reviewCount ? ` (${b.reviewCount})` : ''}</span> : <span className="acq-faint">—</span>}</td>
                          <td style={{ minWidth: 220 }}>
                            {(() => {
                              const st = stateOf(b);
                              const action = CONTACT_ACTION[st];
                              const pp = people[b.id];
                              const busyRow = pp?.state === 'loading' || e?.state === 'loading' || verifying.has(b.id);
                              const tone: Record<ContactState, string> = { verified: 'acq-pill-green', unverified: 'acq-pill-amber', person_no_email: 'acq-pill-blue', business_only: 'acq-pill-gray', none: 'acq-pill-gray', untouched: 'acq-pill-gray' };
                              const list = pp?.state === 'done' ? pp.people : [];
                              const biz = emailOf(b);
                              return (
                                <div style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
                                  {st !== 'untouched' && <span className={`acq-pill ${tone[st]}`}>{CONTACT_LABEL[st]}</span>}
                                  {list.map((p) => {
                                    const v = p.email ? verdicts[p.email.toLowerCase()] : undefined;
                                    return (
                                      <span key={`${p.name}-${p.title}`} style={{ fontSize: 12 }}>
                                        <b>{p.name}</b>{p.title ? <span className="acq-sub"> · {p.title}</span> : null}
                                        {p.sourcePage ? <a href={p.sourcePage} target="_blank" rel="noopener noreferrer" className="acq-faint" style={{ marginLeft: 6, textDecoration: 'underline' }} title="The page where we found this person">source</a> : null}
                                        {p.linkedin ? <a href={p.linkedin} target="_blank" rel="noopener noreferrer" className="acq-faint" style={{ marginLeft: 6, textDecoration: 'underline' }}>LinkedIn</a> : null}
                                        <br />
                                        {p.email
                                          ? v === 'invalid' ? <span className="acq-faint" style={{ textDecoration: 'line-through' }} title="Snov.io says this address does not exist">{p.email}</span>
                                            : <span style={{ color: personOk(p) ? '#15803d' : '#b45309' }} title={personOk(p) ? 'Verified' : 'Not verified yet'}>{personOk(p) ? '✓ ' : ''}{p.email}</span>
                                          : <span className="acq-faint">no email yet</span>}
                                      </span>
                                    );
                                  })}
                                  {(() => {
                                    const ch = channelsOf(b);
                                    const general = biz ?? ch.find((c) => c.type === 'general_email')?.value;
                                    const form = ch.find((c) => c.type === 'contact_form');
                                    return (
                                      <>
                                        {general && <span style={{ fontSize: 12 }}><span className="acq-sub">General business email: </span><b>{general}</b></span>}
                                        {form?.value && <span style={{ fontSize: 12 }}><span className="acq-sub">Contact form: </span><a href={form.value} target="_blank" rel="noopener noreferrer" style={{ color: '#7e22ce', textDecoration: 'underline' }}>open</a></span>}
                                      </>
                                    );
                                  })()}
                                  {pp?.state === 'done' && st === 'none' && <span className="acq-faint" style={{ fontSize: 11.5 }}>No usable public contact found</span>}
                                  {pp?.state === 'done' && pp.note && <span className="acq-faint" style={{ fontSize: 11.5 }}>{pp.note}</span>}
                                  {busyRow
                                    ? <span className="acq-sub" style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}><Loader2 size={13} className="animate-spin" /> {verifying.has(b.id) ? 'Verifying…' : pp?.state === 'loading' ? 'Searching…' : 'Looking…'}</span>
                                    : action && <button className={`acq-btn acq-btn-sm ${action === 'retry' ? '' : 'acq-btn-primary'}`} onClick={() => act(b, action)}>{ACTION_LABEL[action]}</button>}
                                  {!busyRow && (st === 'untouched' || st === 'none') && e?.state !== 'done' && (
                                    <button type="button" className="acq-btn acq-btn-sm" style={{ border: 0, background: 'transparent', color: '#64748b', padding: 0, height: 'auto' }} onClick={() => void findEmail(b)}>Business email only</button>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
