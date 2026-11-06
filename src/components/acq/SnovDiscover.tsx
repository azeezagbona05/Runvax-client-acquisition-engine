'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Sparkles } from 'lucide-react';
import { COMPANY_SIZES, LEVELS, autoPick, groupByCompany, maskedName } from '@/lib/snovDiscover';
import type { DbProspect, ManagementLevel } from '@/lib/snov';
import { Card, EmptyState } from './ui';
import { useAcq } from './AcqProvider';

type Result = { total: number; page: number; totalPages: number; prospects: DbProspect[] };
type Revealed = { name?: string; email?: string; smtpStatus?: string; linkedin?: string };
type Suggestion = string | { locality: string; location_type: string };
const label = { fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, display: 'block' } as const;

/** Find people at companies by industry, place and seniority with Snov.io, reveal the top few emails, and add them to a campaign. */
export default function SnovDiscover({ onAdded }: { onAdded: (msg: string) => void }) {
  const { data } = useAcq();
  const [info, setInfo] = useState<{ available: boolean; balance?: number | null; industries?: string[] } | null>(null);
  const [problem, setProblem] = useState('');
  const [industry, setIndustry] = useState('Medical Practice');
  const [locality, setLocality] = useState('');
  const [locType, setLocType] = useState<'state' | 'city' | 'country'>('state');
  const [levels, setLevels] = useState<ManagementLevel[]>(['c_level', 'director_level']);
  const [size, setSize] = useState('');
  const [titles, setTitles] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [suggest, setSuggest] = useState<Suggestion[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<Record<string, Revealed>>({});
  const [revealing, setRevealing] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [target, setTarget] = useState('');
  const [adding, setAdding] = useState(false);
  const [includeUnconfirmed, setIncludeUnconfirmed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/snov/discover').then(async (r) => {
      const j = await r.json().catch(() => ({})) as { available?: boolean; balance?: number | null; industries?: string[]; error?: string };
      if (!live) return;
      if (!r.ok) { setProblem(j.error ?? 'Not available.'); setInfo({ available: false }); return; }
      setInfo({ available: !!j.available, balance: j.balance, industries: j.industries });
      setBalance(j.balance ?? null);
    }).catch(() => { if (live) setProblem('Could not reach the discovery service.'); });
    return () => { live = false; };
  }, []);

  const groups = useMemo(() => groupByCompany(result?.prospects ?? []), [result]);
  const campaigns = data?.campaigns ?? [];

  const search = async (page = 1, over?: { locality: string; type: string }) => {
    setBusy(true); setError(''); setSuggest([]);
    try {
      const res = await fetch('/api/snov/discover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        industry, page, levels, size: size || undefined,
        location: over ?? (locality.trim() ? { locality: locality.trim(), type: locType } : undefined),
        jobTitles: titles.split(',').map((t) => t.trim()).filter(Boolean), specialties: specialties.split(',').map((t) => t.trim()).filter(Boolean),
      }) });
      const j = await res.json().catch(() => ({})) as Result & { error?: string; suggestions?: Suggestion[]; balance?: number | null };
      if (!res.ok) { setError(j.error ?? 'The search failed.'); setSuggest(j.suggestions ?? []); return; }
      setResult(j); if (page === 1) setPicked(new Set());
      if (typeof j.balance === 'number') setBalance(j.balance);
    } catch { setError('Could not reach the search.'); } finally { setBusy(false); }
  };

  const toggle = (url: string) => setPicked((s) => { const n = new Set(s); if (n.has(url)) n.delete(url); else n.add(url); return n; });
  const toReveal = (result?.prospects ?? []).filter((p) => picked.has(p.revealUrl) && !revealed[p.revealUrl]);

  /** Reveals the given people (default: everyone ticked). One credit each, only when an email is found. */
  const reveal = async (list: typeof toReveal = toReveal) => {
    if (!list.length || revealing) return;
    if (!window.confirm(`Reveal ${list.length === 1 ? 'this email' : `emails for ${list.length} people`}?\n\nThis uses up to ${list.length} email reveal${list.length === 1 ? '' : 's'} (1 for each email found, nothing if none is found or if you revealed it before). You have ${balance ?? 'an unknown number of'} left.`)) return;
    setError('');
    let done = 0;
    try {
      for (let i = 0; i < list.length; i += 10) {
        setRevealing(`${done} of ${list.length} revealed…`);
        const res = await fetch('/api/snov/reveal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls: list.slice(i, i + 10).map((p) => p.revealUrl) }) });
        const j = await res.json().catch(() => ({})) as { results?: Record<string, Revealed>; reveals?: number; error?: string; stopped?: string; code?: string };
        if (!res.ok) { setError(j.error ?? 'Could not reveal the emails.'); break; }
        setRevealed((r) => ({ ...r, ...(j.results ?? {}) }));
        if (typeof j.reveals === 'number') setBalance(j.reveals);
        done += Math.min(10, list.length - i);
        if (j.stopped) { setError(j.stopped); break; }
      }
    } finally { setRevealing(''); }
  };

  const leadFor = (p: DbProspect) => {
    const r = revealed[p.revealUrl];
    if (!r?.email) return null;
    if (r.smtpStatus !== 'valid' && !includeUnconfirmed) return null;
    return { email: r.email, name: r.name ?? maskedName(p), business: p.company.name, website: p.company.domain || undefined };
  };
  const readyLeads = (result?.prospects ?? []).filter((p) => picked.has(p.revealUrl)).map(leadFor).filter((x): x is NonNullable<typeof x> => !!x);

  const add = async () => {
    if (!target || !readyLeads.length) return;
    setAdding(true); setError('');
    try {
      const res = await fetch(`/api/outreach-campaigns/${target}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leads: readyLeads }) });
      const j = await res.json().catch(() => ({})) as { added?: number; duplicates?: number; error?: string };
      if (!res.ok) { setError(j.error ?? 'Could not add them.'); return; }
      onAdded(`Added ${j.added ?? 0} contact${j.added === 1 ? '' : 's'} to the campaign${j.duplicates ? `; ${j.duplicates} were already there` : ''}.`);
      setPicked(new Set());
    } catch { setError('Could not add them.'); } finally { setAdding(false); }
  };

  if (!info) return <Card title="Discover by industry"><p className="acq-sub">{problem || 'Loading…'}</p></Card>;
  if (!info.available) return <Card title="Discover by industry"><EmptyState title="Not available yet" body={problem || 'Discover by industry needs a paid plan and discovery switched on for this account.'} /></Card>;

  const locSuggestions = suggest.filter((s): s is { locality: string; location_type: string } => typeof s === 'object');
  const textSuggestions = suggest.filter((s): s is string => typeof s === 'string');

  return (
    <Card title="Discover by industry" right={<span className="acq-sub" style={{ fontSize: 12.5 }}>{balance !== null ? `${balance.toLocaleString('en-US')} email reveals left` : ''}</span>}>
      <p className="acq-sub" style={{ fontSize: 13, marginBottom: 12 }}>Find the managers and owners of businesses by industry and place. Searching is free. Revealing an email uses one of your email reveals, and only when one is found.</p>
      <form onSubmit={(e) => { e.preventDefault(); void search(1); }} style={{ display: 'grid', gap: 12 }}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div><label style={label} htmlFor="sd-ind">Industry</label>
            <select id="sd-ind" className="acq-select" value={industry} onChange={(e) => setIndustry(e.target.value)}>{(info.industries ?? []).map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
          <div style={{ gridColumn: 'span 2' }}><label style={label} htmlFor="sd-loc">Place</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input id="sd-loc" className="acq-input" value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="e.g. Lagos, Nigeria" maxLength={120} />
              <select className="acq-select" aria-label="Kind of place" style={{ width: 110 }} value={locType} onChange={(e) => setLocType(e.target.value as 'state' | 'city' | 'country')}><option value="state">State</option><option value="city">City</option><option value="country">Country</option></select>
            </div></div>
          <div><label style={label} htmlFor="sd-size">Company size</label>
            <select id="sd-size" className="acq-select" value={size} onChange={(e) => setSize(e.target.value)}><option value="">Any</option>{COMPANY_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748b' }}>Seniority</span>
          {LEVELS.map((l) => (
            <label key={l.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={levels.includes(l.id)} onChange={() => setLevels((v) => (v.includes(l.id) ? v.filter((x) => x !== l.id) : [...v, l.id]))} style={{ accentColor: '#9333ea' }} /> {l.label}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><label style={label} htmlFor="sd-titles">Job titles (optional, comma separated)</label><input id="sd-titles" className="acq-input" value={titles} onChange={(e) => setTitles(e.target.value)} placeholder="e.g. dentist, owner, medical director" /><span className="acq-faint" style={{ fontSize: 11.5 }}>Best for narrow niches: there may be no &ldquo;dental&rdquo; industry, but &ldquo;dentist&rdquo; as a title finds them.</span></div>
          <div><label style={label} htmlFor="sd-spec">Company specialties (optional)</label><input id="sd-spec" className="acq-input" value={specialties} onChange={(e) => setSpecialties(e.target.value)} placeholder="exact wording" /><span className="acq-faint" style={{ fontSize: 11.5 }}>Matches exact wording only, so it often finds nothing. Try job titles first.</span></div>
        </div>
        <div><button className="acq-btn acq-btn-primary" type="submit" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Find people</button></div>
      </form>

      {error && <p role="alert" className="acq-warn" style={{ marginTop: 12 }}>{error}</p>}
      {(locSuggestions.length > 0 || textSuggestions.length > 0) && (
        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="acq-sub" style={{ fontSize: 12.5 }}>Did you mean:</span>
          {locSuggestions.map((s) => <button key={`${s.locality}-${s.location_type}`} type="button" className="acq-btn acq-btn-sm" onClick={() => { setLocality(s.locality); setLocType(s.location_type as 'state' | 'city' | 'country'); void search(1, { locality: s.locality, type: s.location_type }); }}>{s.locality} <span className="acq-faint">({s.location_type})</span></button>)}
          {textSuggestions.map((s) => <button key={s} type="button" className="acq-btn acq-btn-sm" onClick={() => setIndustry(s)}>{s}</button>)}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16 }}>
          {groups.length === 0 ? <EmptyState title="No people found" body="Try a wider place, another industry, or more seniority levels." /> : (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                <b style={{ fontSize: 14 }}>{result.total.toLocaleString('en-US')} people match</b>
                <span className="acq-sub" style={{ fontSize: 12.5 }}>page {result.page} of {result.totalPages.toLocaleString('en-US')} · {groups.length} companies here</span>
                <button type="button" className="acq-btn acq-btn-sm" onClick={() => setPicked(autoPick(groups, 3))}><Sparkles size={13} /> Pick the top 3 per company</button>
                <button type="button" className="acq-btn acq-btn-sm" onClick={() => setPicked(new Set())} disabled={!picked.size}>Clear</button>
                <button type="button" className="acq-btn acq-btn-primary acq-btn-sm" disabled={!toReveal.length || !!revealing} onClick={() => void reveal()}>{revealing ? <><Loader2 size={14} className="animate-spin" /> {revealing}</> : `Reveal emails for ${toReveal.length} (up to ${toReveal.length} reveals)`}</button>
                <select className="acq-select" aria-label="Add to campaign" style={{ width: 'auto', minWidth: 190, height: 36, marginLeft: 'auto' }} value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Choose a campaign…</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <button type="button" className="acq-btn acq-btn-primary acq-btn-sm" disabled={!target || !readyLeads.length || adding} onClick={() => void add()}>{adding ? <Loader2 size={14} className="animate-spin" /> : null} Add {readyLeads.length} to campaign</button>
              </div>
              <label className="acq-faint" style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, marginBottom: 8 }}><input type="checkbox" checked={includeUnconfirmed} onChange={(e) => setIncludeUnconfirmed(e.target.checked)} style={{ accentColor: '#9333ea' }} /> Also add emails that could not be confirmed (default: only confirmed ones, so nothing bounces)</label>
              <div style={{ overflowX: 'auto' }}>
                <table className="acq-table banded" style={{ minWidth: 1020, tableLayout: 'fixed' }}>
                  <colgroup><col style={{ width: 46 }} /><col style={{ width: '17%' }} /><col style={{ width: '20%' }} /><col style={{ width: '23%' }} /><col style={{ width: '17%' }} /><col style={{ width: '23%' }} /></colgroup>
                  <thead><tr><th><span className="sr-only">Select</span></th><th>Person</th><th>Job title</th><th>Company</th><th>Location</th><th>Email</th></tr></thead>
                  <tbody>
                    {groups.map((g) => <GroupRows key={g.key} g={g} picked={picked} toggle={toggle} revealed={revealed} busy={!!revealing} onReveal={(p) => void reveal([p])} />)}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
                <button type="button" className="acq-btn acq-btn-sm" disabled={busy || result.page <= 1} onClick={() => void search(result.page - 1)}>Previous page</button>
                <span style={{ fontSize: 13 }}>Page {result.page} of {result.totalPages.toLocaleString('en-US')}</span>
                <button type="button" className="acq-btn acq-btn-sm" disabled={busy || result.page >= result.totalPages} onClick={() => void search(result.page + 1)}>Next page</button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

const clip = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;

function GroupRows({ g, picked, toggle, revealed, busy, onReveal }: { g: ReturnType<typeof groupByCompany>[number]; picked: Set<string>; toggle: (url: string) => void; revealed: Record<string, Revealed>; busy: boolean; onReveal: (p: ReturnType<typeof groupByCompany>[number]['people'][number]) => void }) {
  const site = g.company.domain ? `https://${g.company.domain}` : '';
  const detail = [g.company.size && `${g.company.size} people`, g.company.industry].filter(Boolean).join(' · ');
  return (
    <>
      {g.people.map((p, i) => {
        const r = revealed[p.revealUrl];
        const first = i === 0;
        return (
          <tr key={p.revealUrl} style={first ? { borderTop: '2px solid #ede9fe' } : undefined}>
            <td><input type="checkbox" aria-label={`Select ${maskedName(p)}`} checked={picked.has(p.revealUrl)} onChange={() => toggle(p.revealUrl)} style={{ accentColor: '#9333ea' }} /></td>
            <td style={{ fontWeight: 600, ...clip }} title={r?.name ?? maskedName(p)}>{r?.name ?? maskedName(p)}</td>
            <td className="acq-muted" style={clip} title={p.jobTitle}>{p.jobTitle || '—'}</td>
            <td style={clip}>
              {first ? (
                <>
                  <b style={{ display: 'block', color: '#0f172a', ...clip }} title={g.company.name || g.company.domain}>{g.company.name || g.company.domain}</b>
                  <span className="acq-sub" style={{ fontSize: 12, display: 'block', ...clip }}>
                    {site && <a href={site} target="_blank" rel="noopener noreferrer" style={{ color: '#7e22ce', textDecoration: 'underline' }}>{g.company.domain}</a>}{site && detail ? ' · ' : ''}{detail}
                  </span>
                </>
              ) : <span className="acq-faint" style={{ fontSize: 12 }} aria-label={`Same company: ${g.company.name || g.company.domain}`}>↳ same company</span>}
            </td>
            <td className="acq-muted" style={clip} title={p.location}>{p.location || '—'}</td>
            <td style={clip}>{r?.email ? <span style={{ color: r.smtpStatus === 'valid' ? '#15803d' : '#b45309' }} title={r.smtpStatus === 'valid' ? 'Confirmed to exist' : 'This address could not be confirmed'}>{r.smtpStatus === 'valid' ? '✓ ' : ''}{r.email}</span> : r ? <span className="acq-faint">No email found</span> : <button type="button" className="acq-btn acq-btn-sm" disabled={busy} onClick={() => onReveal(p)}>Reveal email</button>}</td>
          </tr>
        );
      })}
    </>
  );
}
