'use client';

import { celebrate } from '@/lib/celebrate';
import CountUp from './CountUp';
import { NO_AUTOFILL } from '@/lib/noAutofill';
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState, type VisibilityState } from '@tanstack/react-table';
import { Check, Loader2, Search, Square, Star, Zap } from 'lucide-react';
import { AREAS, STATES } from '@/lib/areas';
import SearchSelect, { MultiSearchSelect, type SearchOption } from './SearchSelect';
import { ACTION_LABEL, CONTACT_ACTION, CONTACT_LABEL, contactState, isVerifiedStatus, toCsv, FINDER_COUNTRIES, FINDER_INDUSTRIES, MAX_PAIRS, MAX_RUN_SEARCHES, advanceMulti, finderErrorMulti, finderPairs, finderQuery, multiStep, multiStepsLeft, multiStopReason, startFinder, startMulti, type FinderBusiness, type FinderCtx, type MultiCtx, type ContactAction, type ContactState, type Verdict } from '@/lib/acqFinder';
import { EMPTY_GROUP, applyGroup, makeRecord, searchRecords, type FilterGroup, type ProspectRecord } from '@/lib/prospectQuery';
import ProspectToolbar from './ProspectToolbar';
import { BizLogo, Card, EmptyState } from './ui';
import { useAcq } from './AcqProvider';
import SignupPrompt from './SignupPrompt';

const PENDING_KEY = 'rv_pending_find';

type Email = { state: 'loading' } | { state: 'done'; email: string | null };
type Person = { name: string; title: string; email?: string; emailStatus?: string; source: string; sourcePage?: string; match?: 'confirmed' | 'likely'; evidence?: { url: string; snippet: string }; linkedin?: string };
type Channel = { type: 'decision_maker_email' | 'general_email' | 'contact_form' | 'business_phone' | 'none'; value?: string; person?: string; sourcePage?: string };
type People = { state: 'loading' } | { state: 'done'; people: Person[]; channels: Channel[]; note?: string };
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const label = { fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, display: 'block' } as const;

const COLUMN_LABEL: Record<string, string> = { check: '', name: 'Business', address: 'Address', phone: 'Phone', website: 'Website', rating: 'Rating', reviews: 'Reviews', contact: 'Email' };
const COLUMN_PICKER = [{ id: 'address', label: 'Address' }, { id: 'phone', label: 'Phone' }, { id: 'website', label: 'Website' }, { id: 'rating', label: 'Rating' }, { id: 'reviews', label: 'Reviews' }, { id: 'contact', label: 'Email' }];
const CONTACT_ORDER: ContactState[] = ['verified', 'unverified', 'person_no_email', 'business_only', 'untouched', 'none'];
const TABLE_COLUMNS: ColumnDef<ProspectRecord>[] = [
  { id: 'check', header: '', enableSorting: false, enableHiding: false, accessorFn: () => null },
  { id: 'name', accessorFn: (r) => r.b.name.toLowerCase(), sortingFn: 'text' },
  { id: 'address', accessorFn: (r) => r.b.address?.toLowerCase() ?? '', sortingFn: 'text' },
  { id: 'phone', accessorFn: (r) => (r.b.phone ? 0 : 1), sortingFn: 'basic' },
  { id: 'website', accessorFn: (r) => (r.b.website?.trim() ? 1 : 0), sortingFn: 'basic' },
  // A missing rating always sorts last, whichever way the column is sorted.
  { id: 'rating', accessorFn: (r) => r.b.rating, sortUndefined: 'last', sortingFn: 'basic' },
  { id: 'reviews', accessorFn: (r) => r.b.reviewCount ?? 0, sortingFn: 'basic' },
  { id: 'contact', accessorFn: (r) => CONTACT_ORDER.indexOf(r.contact), sortingFn: 'basic' },
];

/** Finds businesses with the same search RUNVAX 1.0 uses, lists them, finds their emails and adds them to a campaign. */
export default function ProspectFinder({ onAdded }: { onAdded: (msg: string) => void }) {
  const { data, guest } = useAcq();
  const [prompt, setPrompt] = useState('');
  const [guestHidden, setGuestHidden] = useState(0);
  const [country, setCountry] = useState('NG');
  const [allCountries, setAllCountries] = useState<Array<{ code: string; name: string }> | null>(null);
  const [regions, setRegions] = useState<Array<{ code: string; name: string }>>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [state, setState] = useState('');
  const [locations, setLocations] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<FinderBusiness[] | null>(null);
  const [cached, setCached] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [emails, setEmails] = useState<Record<string, Email>>({});
  const [target, setTarget] = useState('');
  const [adding, setAdding] = useState(false);
  const [finding, setFinding] = useState(false);
  const [ctx, setCtx] = useState<MultiCtx | null>(null);
  const [running, setRunning] = useState(false);
  const [maxRun, setMaxRun] = useState(MAX_RUN_SEARCHES);
  const [want, setWant] = useState(100);
  const [wantText, setWantText] = useState('100');
  const [progress, setProgress] = useState('');
  const [people, setPeople] = useState<Record<string, People>>({});
  const [findingDm, setFindingDm] = useState(false);
  const [credits, setCredits] = useState<{ on: boolean; balance: number | null } | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [verifying, setVerifying] = useState<Set<string>>(new Set());
  const [verifyingAll, setVerifyingAll] = useState(false);
  const [includeUnverified, setIncludeUnverified] = useState(false);
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');
  const [searchPending, startSearch] = useTransition();
  const [foundNote, setFoundNote] = useState<{ n: number; where: string; hit: boolean } | null>(null);
  const wasWorking = useRef(false);
  const [group, setGroup] = useState<FilterGroup>(EMPTY_GROUP);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [colVis, setColVis] = useState<VisibilityState>({ reviews: false });
  const seen = useRef(new Set<string>());
  const stop = useRef(false);
  useEffect(() => () => { stop.current = true; }, []);

  // Every country comes from the server once; a country's regions load when it is chosen.
  useEffect(() => {
    let live = true;
    fetch('/api/finder/geo').then((r) => r.json()).then((j: { countries?: Array<{ code: string; name: string }> }) => { if (live && j.countries) setAllCountries(j.countries); }).catch(() => {});
    return () => { live = false; };
  }, []);
  useEffect(() => {
    // Nigeria keeps its own state list, which also knows each state's neighbourhoods.
    if (country === 'NG' || country === 'OTHER') { setRegions([]); return; }
    let live = true;
    setRegions([]);
    fetch(`/api/finder/geo?country=${encodeURIComponent(country)}`).then((r) => r.json()).then((j: { regions?: Array<{ code: string; name: string }> }) => { if (live) setRegions(j.regions ?? []); }).catch(() => {});
    return () => { live = false; };
  }, [country]);

  // Whether the credit-based people lookup is on for this account, so the page can say what a lookup costs.
  useEffect(() => {
    if (guest || !results || credits) return;
    let live = true;
    fetch('/api/client-acquisition/people').then((r) => (r.ok ? r.json() : null)).then((j: { credits?: boolean; balance?: number | null } | null) => { if (live) setCredits({ on: !!j?.credits, balance: j?.balance ?? null }); }).catch(() => { if (live) setCredits({ on: false, balance: null }); });
    return () => { live = false; };
  }, [guest, results, credits]);

  const countryOptions = useMemo<SearchOption[]>(() => [
    ...FINDER_COUNTRIES.filter((c) => c.code !== 'OTHER').map((c) => ({ value: c.code, label: c.name, group: 'Popular' })),
    ...(allCountries ?? []).filter((c) => !FINDER_COUNTRIES.some((f) => f.code === c.code)).map((c) => ({ value: c.code, label: c.name, group: 'All countries' })),
  ], [allCountries]);
  const countryName = (allCountries ?? FINDER_COUNTRIES).find((c) => c.code === country)?.name ?? country;
  const states = country === 'NG' || country === 'OTHER' ? STATES.filter((s) => s.country === country) : regions;
  const stateOptions: SearchOption[] = states.length ? [{ value: '', label: 'Any' }, ...states.map((s) => ({ value: s.code, label: s.name }))] : [];
  const places = useMemo(() => {
    const cities = state ? STATES.find((s) => s.code === state)?.cities ?? null : null;
    const areas = AREAS.filter((a) => a.country === country && (!cities || cities.includes(a.city))).map((a) => a.name);
    if (country === 'NG') return Array.from(new Set(areas)).slice(0, 600);
    // Elsewhere: the chosen region (or every region), plus any neighbourhoods we know. Any other place can be typed in.
    const r = regions.filter((x) => !state || x.code === state).map((x) => x.name);
    return Array.from(new Set([...r, ...areas])).slice(0, 600);
  }, [country, state, regions]);
  const placeOptions = useMemo<SearchOption[]>(() => places.map((p) => ({ value: p, label: p })), [places]);
  const industryOptions = useMemo<SearchOption[]>(() => FINDER_INDUSTRIES.map((i) => ({ value: i, label: i })), []);
  const pairs = finderPairs(industries, locations);
  const pairsWanted = industries.length * locations.length;
  const campaigns = (data?.campaigns ?? []).filter((c) => c.status !== 'completed' || true);

  /** Signed-out visitors can look, but anything that does work for them needs an account. Remembers the search so it is still here after sign-up. */
  const needAccount = (why: string): boolean => {
    if (!guest) return false;
    try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ country, state, locations, industries })); } catch { /* not saved */ }
    setPrompt(why);
    return true;
  };

  // Coming back from sign-up: put the search form back the way they left it.
  useEffect(() => {
    if (guest) return;
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return;
      sessionStorage.removeItem(PENDING_KEY);
      const p = JSON.parse(raw) as { country?: string; state?: string; location?: string; industry?: string; locations?: string[]; industries?: string[] };
      if (p.country) setCountry(p.country);
      if (p.state) setState(p.state);
      const locs = Array.isArray(p.locations) ? p.locations : p.location ? [p.location] : [];
      const inds = Array.isArray(p.industries) ? p.industries : p.industry ? [p.industry] : [];
      if (locs.length) setLocations(locs.filter((x) => typeof x === 'string'));
      if (inds.length) setIndustries(inds.filter((x) => typeof x === 'string'));
    } catch { /* ignore */ }
  }, [guest]);

  /** Runs one Google Maps search and returns the businesses not already in the table. */
  const fetchFresh = async (body: Record<string, unknown>, room: number, foundBy: string): Promise<{ fresh: FinderBusiness[]; all: FinderBusiness[]; status: number; j: { error?: string; cached?: boolean; code?: string; guestHidden?: number } }> => {
    const res = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({})) as { businesses?: FinderBusiness[]; error?: string; cached?: boolean; code?: string; guestHidden?: number };
    if (!res.ok) return { fresh: [], all: [], status: res.status, j };
    const all = j.businesses ?? [];
    const fresh = all.filter((b) => !seen.current.has(b.id)).slice(0, Math.max(0, room)).map((b) => ({ ...b, foundBy }));
    fresh.forEach((b) => seen.current.add(b.id));
    return { fresh, all, status: res.status, j };
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const bad = finderErrorMulti(industries, locations);
    if (bad) { setError(bad); return; }
    stop.current = true; setRunning(false); setProgress('');
    setBusy(true); setError(''); setResults(null); setFoundNote(null); wasWorking.current = false; setQuery(''); setApplied(''); setGroup(EMPTY_GROUP); setSorting([]); setPicked(new Set()); setEmails({}); setPeople({}); setVerdicts({}); setCtx(null); seen.current = new Set();
    // A free search covers one category in one place; more need an account.
    const run = guest ? pairs.slice(0, 1) : pairs;
    const multi = run.length > 1;
    const ctxs: FinderCtx[] = [];
    let anyCached = true; let firstError = '';
    try {
      for (let k = 0; k < run.length; k++) {
        const { industry, location } = run[k];
        if (multi) setProgress(`Searching ${industry} in ${location} (${k + 1} of ${run.length})…`);
        const r = await fetchFresh({ industry, location, country, radius: 5, query: finderQuery(industry, location), ...(guest ? { guestPreview: true } : {}) }, want - seen.current.size, multi ? `${industry} in ${location}` : 'First search');
        if (r.status === 402 && r.j.code === 'GUEST_LIMIT') { needAccount('You have used your free searches for today.'); setError(r.j.error ?? ''); return; }
        if (r.status === 402) { firstError = r.j.error ?? 'You have used all of today\'s searches on your plan.'; break; }
        if (r.status >= 400) { firstError = firstError || (r.j.error ?? 'The search failed. Try again in a moment.'); continue; }
        if (guest) setGuestHidden(r.j.guestHidden ?? 0);
        anyCached = anyCached && !!r.j.cached;
        if (r.fresh.length) setResults((x) => [...(x ?? []), ...r.fresh]);
        const withLoc = r.all.filter((b) => b.location);
        const centre = withLoc.length ? { lat: withLoc.reduce((a2, b2) => a2 + b2.location!.latitude, 0) / withLoc.length, lng: withLoc.reduce((a2, b2) => a2 + b2.location!.longitude, 0) / withLoc.length } : undefined;
        ctxs.push(startFinder(industry, location, country, state, centre));
        if (seen.current.size >= want) break;
      }
      if (!ctxs.length) { setError(firstError || 'The search failed. Try again in a moment.'); return; }
      setResults((x) => x ?? []);
      if (!guest) setGuestHidden(0);
      setCached(anyCached);
      if (firstError) setError(firstError);
      setProgress(multi ? `Searched ${ctxs.length} of ${run.length} category and location pairs: ${seen.current.size} businesses.` : '');
      const m = startMulti(ctxs);
      setCtx(m);
      if (seen.current.size < want && !guest && !firstError) { setBusy(false); void keepFinding(m); }
    } catch { setError('Could not reach the search. Check your connection.'); } finally { setBusy(false); }
  };

  /** Runs one load-more step. Returns the new context, how many new prospects it found, and a reason to stop if it must. */
  const runStep = async (m: MultiCtx, room = Infinity): Promise<{ ctx: MultiCtx; fresh: number; halt?: string }> => {
    const next = multiStep(m);
    if (!next) return { ctx: m, fresh: 0 };
    const { i, step } = next;
    try {
      const r = await fetchFresh({ query: step.query, lat: step.lat, lng: step.lng, radius: m.ctxs[i].radius, location: step.location, country: m.ctxs[i].country }, room, step.label);
      if (r.status === 402) return { ctx: m, fresh: 0, halt: r.j.error ?? 'You have used all of today\'s searches on your plan.' };
      if (r.status >= 400) return { ctx: advanceMulti(m, i, 0), fresh: 0, ...(r.status >= 500 ? { halt: r.j.error ?? 'The search failed. Try again in a moment.' } : {}) };
      if (r.fresh.length) setResults((x) => [...(x ?? []), ...r.fresh]);
      return { ctx: advanceMulti(m, i, r.fresh.length), fresh: r.fresh.length };
    } catch { return { ctx: m, fresh: 0, halt: 'Could not reach the search. Check your connection.' }; }
  };

  const loadMore = async () => {
    if (needAccount('Loading more results needs an account.')) return;
    if (!ctx || running) return;
    setBusy(true); setError('');
    const label = multiStep(ctx)?.step.label;
    const r = await runStep(ctx);
    setCtx(r.ctx); setBusy(false);
    setProgress(r.halt ? '' : `${label}: ${r.fresh} new`);
    if (r.halt) setError(r.halt);
  };

  /** Keeps running steps until Google has nothing more, the plan's searches run out, or the user stops it. */
  const keepFinding = async (from: MultiCtx | null = ctx) => {
    if (needAccount('Searching until there is no more needs an account.')) return;
    if (!from || running) return;
    stop.current = false; setRunning(true); setError('');
    let c = from; let total = 0; let n = 0;
    while (!stop.current) {
      const why = seen.current.size >= want ? `Found ${seen.current.size} businesses, your target.` : n >= maxRun ? `Reached your limit of ${maxRun} searches for this run.` : multiStopReason(c);
      if (why) { setProgress(`Done: ${seen.current.size} businesses in the table (${n} extra searches). ${why}`); break; }
      setProgress(`${multiStep(c)?.step.label} · ${seen.current.size} of ${want} businesses`);
      const r = await runStep(c, want - seen.current.size);
      n++; total += r.fresh; c = r.ctx; setCtx(c);
      if (r.halt) { setError(r.halt); setProgress(`Stopped: ${total} new prospects found in ${n} searches.`); break; }
    }
    if (stop.current) setProgress(`Stopped: ${total} new prospects found in ${n} searches.`);
    setRunning(false);
  };

  const findEmail = async (b: FinderBusiness) => {
    if (needAccount('Finding business emails needs an account.')) return;
    setEmails((m) => ({ ...m, [b.id]: { state: 'loading' } }));
    try {
      const res = await fetch('/api/enrich-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ website: b.website, name: b.name, location: b.address, phone: b.phone }) });
      const j = await res.json().catch(() => ({})) as { email?: string | null };
      setEmails((m) => ({ ...m, [b.id]: { state: 'done', email: j.email && EMAIL_OK.test(j.email) ? j.email : null } }));
    } catch { setEmails((m) => ({ ...m, [b.id]: { state: 'done', email: null } })); }
  };
  const findForSelected = async () => {
    if (needAccount('Finding business emails needs an account.')) return;
    setFinding(true);
    const todo = (results ?? []).filter((b) => picked.has(b.id) && !emails[b.id]);
    for (let i = 0; i < todo.length; i += 3) await Promise.all(todo.slice(i, i + 3).map(findEmail));
    setFinding(false);
  };

  /**
   * The people at one business and their emails. The first search looks the business's website up for everyone attached to it
   * (paid plans); if that finds nobody, RUNVAX's own contact intelligence takes over. `deep` is the extra paid search for a name with no email.
   */
  const findPeople = async (b: FinderBusiness, opts: { deep?: boolean; max?: number } = {}) => {
    if (needAccount('Finding decision-makers needs an account.')) return;
    setPeople((m) => ({ ...m, [b.id]: { state: 'loading' } }));
    try {
      if (opts.deep) {
        const res = await fetch('/api/decision-maker/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: b.name, address: b.address, website: b.website, category: b.category, deep: true }) });
        const j = await res.json().catch(() => ({})) as { candidates?: Person[]; channels?: Channel[]; error?: string };
        setPeople((m) => ({ ...m, [b.id]: { state: 'done', people: j.candidates ?? [], channels: j.channels ?? [], note: res.ok ? undefined : (res.status === 403 ? 'A deeper email search needs a paid plan.' : j.error ?? 'Lookup failed.') } }));
        return;
      }
      const res = await fetch('/api/client-acquisition/people', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: b.name, address: b.address, website: b.website, category: b.category, max: opts.max ?? 5 }) });
      const j = await res.json().catch(() => ({})) as { people?: Array<{ name: string; title: string; email?: string; emailState?: 'confirmed' | 'unconfirmed'; linkedin?: string; sourcePage?: string; match?: 'confirmed' | 'likely'; evidence?: { url: string; snippet: string } }>; channels?: Channel[]; note?: string; error?: string; balance?: number | null };
      if (!res.ok) { setPeople((m) => ({ ...m, [b.id]: { state: 'done', people: [], channels: [], note: j.error ?? 'Lookup failed.' } })); return; }
      if (typeof j.balance === 'number') setCredits((c) => (c ? { ...c, balance: j.balance ?? null } : c));
      const list: Person[] = (j.people ?? []).map((p) => ({ name: p.name, title: p.title, source: 'lookup', ...(p.email ? { email: p.email, emailStatus: p.emailState === 'confirmed' ? 'valid' : 'unconfirmed' } : {}), ...(p.linkedin ? { linkedin: p.linkedin } : {}), ...(p.sourcePage ? { sourcePage: p.sourcePage } : {}), ...(p.match ? { match: p.match } : {}), ...(p.evidence ? { evidence: p.evidence } : {}) }));
      setPeople((m) => ({ ...m, [b.id]: { state: 'done', people: list, channels: j.channels ?? [], note: list.length ? undefined : j.note } }));
    } catch { setPeople((m) => ({ ...m, [b.id]: { state: 'done', people: [], channels: [], note: 'Lookup failed.' } })); }
  };
  /** One row's dropdown: up to N people. Says what it can cost first when the credit-based lookup is on. */
  const askPeople = (b: FinderBusiness, n: number) => {
    if (needAccount('Finding decision-makers needs an account.')) return;
    if (credits?.on && !window.confirm(`Find up to ${n} people at ${b.name}?\n\nYou are charged 1 email reveal for each email found (up to ${n}), nothing for a person with no email or for an address you revealed before. You have ${credits.balance ?? 'an unknown number of'} reveals left. If nobody is found, RUNVAX's own contact search is tried next, which is free.`)) return;
    void findPeople(b, { max: n });
  };
  const findPeopleForSelected = async () => {
    if (needAccount('Finding decision-makers needs an account.')) return;
    const todo = (results ?? []).filter((b) => picked.has(b.id) && !people[b.id]);
    if (!todo.length) return;
    if (credits?.on && !window.confirm(`Find up to 5 people at ${todo.length} business${todo.length === 1 ? '' : 'es'}?\n\nThis can use up to ${todo.length * 5} email reveals (1 for each email found, nothing otherwise). You have ${credits.balance ?? 'an unknown number of'} left. Businesses with nobody found fall back to RUNVAX's own contact search, which is free.`)) return;
    setFindingDm(true);
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
    if (needAccount('Verifying emails needs an account.')) return;
    setVerifying((s) => new Set(s).add(b.id));
    try { await verifyEmailsOf(usablePeople(b).filter((p) => !personOk(p)).map((p) => p.email!)); }
    finally { setVerifying((s) => { const n = new Set(s); n.delete(b.id); return n; }); }
  };
  const verifySelected = async () => {
    if (needAccount('Verifying emails needs an account.')) return;
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
  // Every business with what we know about it, flattened for the search and the advanced filter.
  const records = useMemo(() => (results ?? []).map((b) => makeRecord(b, {
    contact: stateOf(b),
    emails: [generalEmailOf(b), ...(peopleOf(b) ?? []).map((p) => p.email)].filter((x): x is string => !!x),
    people: peopleOf(b) ?? [],
  })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results, emails, people, verdicts]);
  // The search runs a moment after typing stops, as a low-priority update, so typing never stalls on a big list.
  useEffect(() => {
    if (query === applied) return;
    const t = setTimeout(() => startSearch(() => setApplied(query)), 200);
    return () => clearTimeout(t);
  }, [query, applied]);
  const searching = query !== applied || searchPending;
  // When a search ends with results, land the number and say so. A small burst only if it reached the number asked for.
  useEffect(() => {
    if (busy || running) { wasWorking.current = true; return; }
    if (!wasWorking.current || !results?.length) return;
    wasWorking.current = false;
    const where = locations.slice(0, 2).join(', ') + (locations.length > 2 ? ` +${locations.length - 2}` : '');
    const hit = results.length >= want;
    setFoundNote({ n: results.length, where, hit });
    if (hit) celebrate({ kind: 'done', title: `${results.length.toLocaleString('en-US')} businesses found`, body: where ? `In ${where}. Filter them, then find who runs them.` : 'Filter them, then find who runs them.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, running, results]);
  const matched = useMemo(() => applyGroup(searchRecords(records, applied), group), [records, applied, group]);
  const table = useReactTable<ProspectRecord>({
    data: matched, columns: TABLE_COLUMNS, getRowId: (r) => r.b.id,
    state: { sorting, columnVisibility: colVis }, onSortingChange: setSorting, onColumnVisibilityChange: setColVis,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
  });
  const sortedRows = table.getRowModel().rows;
  const visibleIds = table.getVisibleLeafColumns().map((c) => c.id);
  const shown = useMemo(() => sortedRows.map((r) => r.original.b), [sortedRows]);
  const clearFilters = () => { setQuery(''); setApplied(''); setGroup(EMPTY_GROUP); setSorting([]); };
  const allOn = !!shown.length && shown.every((b) => picked.has(b.id));
  // Pagination: the table shows one page of the matching rows at a time.
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize));
  const curPage = Math.min(page, pageCount);
  const pageRows = useMemo(() => shown.slice((curPage - 1) * pageSize, curPage * pageSize), [shown, curPage, pageSize]);
  const from = shown.length ? (curPage - 1) * pageSize + 1 : 0;
  const to = Math.min(shown.length, curPage * pageSize);
  // A new search, filter, sort or page size starts again from page 1.
  useEffect(() => { setPage(1); }, [applied, group, sorting, pageSize]);
  const pageAllOn = pageRows.length > 0 && pageRows.every((b) => picked.has(b.id));
  const togglePage = () => setPicked((s) => { const n = new Set(s); if (pageAllOn) pageRows.forEach((b) => n.delete(b.id)); else pageRows.forEach((b) => n.add(b.id)); return n; });
  const pager = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0' }} role="navigation" aria-label="Pages of prospects">
      <span className="acq-sub" style={{ fontSize: 13 }}>Showing {from.toLocaleString('en-US')}–{to.toLocaleString('en-US')} of {shown.length.toLocaleString('en-US')}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>Rows
          <select className="acq-select" aria-label="Rows per page" style={{ height: 32, width: 'auto' }} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {[25, 50, 100, 250, 500].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button type="button" className="acq-btn acq-btn-sm" disabled={curPage <= 1} onClick={() => setPage(1)} aria-label="First page">«</button>
        <button type="button" className="acq-btn acq-btn-sm" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>Previous</button>
        <span style={{ fontSize: 13, minWidth: 90, textAlign: 'center' }}>Page <input {...NO_AUTOFILL} name="pf-page" type="number" min={1} max={pageCount} className="acq-input" aria-label="Page number" style={{ width: 62, height: 30, padding: '0 6px', textAlign: 'center' }} value={curPage} onChange={(e) => { const n = Math.floor(Number(e.target.value)); if (n >= 1) setPage(Math.min(n, pageCount)); }} /> of {pageCount.toLocaleString('en-US')}</span>
        <button type="button" className="acq-btn acq-btn-sm" disabled={curPage >= pageCount} onClick={() => setPage(curPage + 1)}>Next</button>
        <button type="button" className="acq-btn acq-btn-sm" disabled={curPage >= pageCount} onClick={() => setPage(pageCount)} aria-label="Last page">»</button>
      </div>
    </div>
  );

  /** Downloads the rows on screen (with what was found so far) as a CSV: for a manual quality review, or as input for scripts/contact-intel-experiment.ts. */
  const exportCsv = () => {
    if (needAccount('Exporting needs an account.')) return;
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
    if (needAccount('Adding prospects to a campaign needs an account.')) return;
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
    <Card title="Find prospects">
      <form onSubmit={search} autoComplete="off" style={{ display: 'grid', gap: 12 }}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div><label style={label} htmlFor="pf-country">1 · Country</label>
            <SearchSelect id="pf-country" value={country} options={countryOptions} placeholder="Choose a country" searchPlaceholder="Search all countries" onChange={(v) => { setCountry(v); setState(''); setLocations([]); }} /></div>
          <div><label style={label} htmlFor="pf-state">2 · State or region</label>
            <SearchSelect id="pf-state" value={state} options={stateOptions} disabled={!states.length} placeholder={states.length ? 'Any' : country === 'NG' || regions.length ? 'Not needed' : 'Loading…'} searchPlaceholder="Search regions" onChange={(v) => { setState(v); const r = regions.find((x) => x.code === v); setLocations(country === 'NG' || !r ? [] : [r.name]); }} /></div>
          <div><label style={label} htmlFor="pf-loc">3 · Locations</label>
            <MultiSearchSelect id="pf-loc" values={locations} options={placeOptions} onChange={setLocations} allowCustom max={MAX_PAIRS} customLabel={(q) => `Add "${q.slice(0, 120)}" as a location`} placeholder={country === 'NG' ? 'e.g. Lekki, Ikeja' : `Pick or type cities in ${countryName}`} searchPlaceholder="Search or type a place" emptyText="Type a place name to add it" /></div>
          <div><label style={label} htmlFor="pf-ind">4 · Business categories</label>
            <MultiSearchSelect id="pf-ind" values={industries} options={industryOptions} onChange={setIndustries} max={MAX_PAIRS} placeholder="e.g. Dental Clinics" searchPlaceholder="Search categories" /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>5 · How many businesses <input {...NO_AUTOFILL} name="pf-count" type="number" min={1} inputMode="numeric" className="acq-input" aria-label="How many businesses" style={{ width: 110, height: 36 }} value={wantText} onChange={(e) => { setWantText(e.target.value); const n = Math.floor(Number(e.target.value)); if (n >= 1) setWant(n); }} onBlur={() => setWantText(String(want))} /></label>
          <button className="acq-btn acq-btn-primary" type="submit" disabled={busy || running}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Find prospects</button>
          {pairsWanted > 1 && <span className="acq-sub" role="status" style={{ fontSize: 12.5, color: pairsWanted > MAX_PAIRS ? '#b45309' : undefined }}>{industries.length} {industries.length === 1 ? 'category' : 'categories'} × {locations.length} {locations.length === 1 ? 'location' : 'locations'}: searches every category in every location ({Math.min(pairsWanted, MAX_PAIRS)} searches to start{pairsWanted > MAX_PAIRS ? `; only the first ${MAX_PAIRS} pairs run, remove some to cover the rest` : ''}).{guest ? ' Without an account only the first pair is searched.' : ''}</span>}
          <span className="acq-faint" style={{ fontSize: 12 }}>One search returns up to about 20 to 60 businesses, so RUNVAX keeps searching the same location, then nearby areas, until it reaches your number. Each search counts toward your plan&apos;s daily searches.</span>
        </div>
      </form>
      {error && <p role="alert" className="acq-warn" style={{ marginTop: 12 }}>{error}</p>}
      {prompt && <SignupPrompt reason={prompt} onClose={() => setPrompt('')} />}
      {guest && results && results.length > 0 && (
        <div role="status" className="acq-notice" style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 220 }}>
            {guestHidden > 0 ? <>Showing <b>{results.length}</b> of <b>{results.length + guestHidden}</b> businesses found. </> : null}
            Create a free account to see all of them, find owner emails, verify them and start a campaign.
          </span>
          <button className="acq-btn acq-btn-primary acq-btn-sm" onClick={() => needAccount('See every result and find the people who run these businesses.')}>Create free account</button>
        </div>
      )}

      {(busy || running) && (() => {
        const n = results?.length ?? 0;
        const pct = Math.min(100, Math.round((n / Math.max(1, want)) * 100));
        return (
          <div role="status" aria-live="polite" style={{ marginTop: 14, padding: '14px 16px', background: '#faf5ff', border: '1px solid #f3e8ff', borderRadius: 14, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Loader2 size={22} className="animate-spin" style={{ color: '#9333ea', flex: 'none' }} />
              <b style={{ fontSize: 15 }}>Searching for prospects…</b>
              <span style={{ marginLeft: 'auto', fontSize: 15 }}><b style={{ fontSize: 22, color: '#7e22ce' }}><CountUp value={n} /></b> <span className="acq-sub">of {want} found</span></span>
            </div>
            <div style={{ height: 8, background: '#ede9fe', borderRadius: 999, overflow: 'hidden' }} role="progressbar" aria-valuenow={n} aria-valuemin={0} aria-valuemax={want} aria-label="Prospects found">
              <div style={{ width: `${pct}%`, height: '100%', background: '#9333ea', transition: 'width .4s ease' }} />
            </div>
            <p className="acq-sub" style={{ fontSize: 12.5 }}>{running ? (progress || 'Starting…') : 'Searching for businesses…'}</p>
          </div>
        );
      })()}

      {results && (
        <div style={{ marginTop: 16 }}>
          {results.length === 0 ? <EmptyState title="No businesses found" body="Try a nearby area or a different category." /> : (
            <>
              {foundNote && (
                <div className="acq-found" role="status">
                  <span className="acq-found-check"><Check size={18} strokeWidth={3} /></span>
                  <span style={{ fontSize: 14.5 }}><b style={{ fontSize: 17, color: '#7e22ce' }}><CountUp value={foundNote.n} /></b> businesses found{foundNote.where ? ` in ${foundNote.where}` : ''}. {foundNote.hit ? 'You hit your target.' : 'That is every match this search could reach.'}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                <b style={{ fontSize: 14 }}>{shown.length !== results.length ? `${shown.length} of ${results.length}` : results.length} prospects{cached ? ' (first search from a recent search)' : ''}</b>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={allOn} onChange={() => setPicked(allOn ? new Set() : new Set(shown.map((b) => b.id)))} style={{ accentColor: '#9333ea' }} /> Select all {shown.length.toLocaleString('en-US')}</label>
                <button className="acq-btn acq-btn-sm" disabled={!picked.size || finding} onClick={() => void findForSelected()}>{finding ? <Loader2 size={14} className="animate-spin" /> : null} Find business emails for {picked.size || 'selected'}</button>
                <button className="acq-btn acq-btn-primary acq-btn-sm" disabled={!picked.size || findingDm} onClick={() => void findPeopleForSelected()}>{findingDm ? <Loader2 size={14} className="animate-spin" /> : null} Find decision-makers for {picked.size || 'selected'}</button>
                <button className="acq-btn acq-btn-sm" disabled={!picked.size || verifyingAll} onClick={() => void verifySelected()}>{verifyingAll ? <Loader2 size={14} className="animate-spin" /> : null} Verify emails for {picked.size || 'selected'}</button>
                <button className="acq-btn acq-btn-sm" onClick={exportCsv} title="Download the rows on screen as a CSV">Export CSV</button>
                <select className="acq-select" aria-label="Add to campaign" style={{ width: 'auto', minWidth: 200, height: 36, marginLeft: 'auto' }} value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">Choose a campaign…</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button className="acq-btn acq-btn-primary acq-btn-sm" disabled={!target || !ready.length || adding} onClick={() => void add()}>{adding ? <Loader2 size={14} className="animate-spin" /> : null} Add {ready.length} ready to campaign</button>
              </div>
              <ProspectToolbar query={query} onQuery={setQuery} searching={searching} group={group} onGroup={setGroup} sorting={sorting} onSorting={setSorting}
                columns={COLUMN_PICKER} visibility={colVis} onVisibility={setColVis} shown={shown.length} total={results.length} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '4px 0 10px', padding: 10, background: '#faf5ff', border: '1px solid #f3e8ff', borderRadius: 12 }}>
                {running
                  ? <button className="acq-btn acq-btn-sm" onClick={() => { stop.current = true; }}><Square size={13} /> Stop</button>
                  : <>
                      <button className="acq-btn acq-btn-primary acq-btn-sm" disabled={!ctx || !multiStep(ctx) || busy} onClick={() => void keepFinding()}><Zap size={14} /> Keep finding until there is no more</button>
                      <button className="acq-btn acq-btn-sm" disabled={!ctx || !multiStep(ctx) || busy} onClick={() => void loadMore()}>{busy && ctx ? <Loader2 size={14} className="animate-spin" /> : null} Load more: {ctx && multiStep(ctx) ? multiStep(ctx)!.step.label : 'nothing left'}</button>
                    </>}
                {!running && <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>Up to <input {...NO_AUTOFILL} name="pf-runs" type="number" min={1} inputMode="numeric" className="acq-input" aria-label="Searches per run" style={{ width: 90, height: 30 }} value={maxRun} onChange={(e) => setMaxRun(Math.max(1, Math.floor(Number(e.target.value)) || 1))} /> searches</label>}
                <span className="acq-sub" style={{ fontSize: 12.5 }} role="status">{running && <Loader2 size={13} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />}{progress || (ctx && multiStep(ctx) ? `Tries the same location first, then nearby areas, then a wider area${ctx.ctxs.length > 1 ? `, taking turns across your ${ctx.ctxs.length} category and location pairs` : ''}. Up to ${multiStepsLeft(ctx)} searches left; each counts toward your daily searches.` : 'Everything nearby has been tried.')}</span>
              </div>
              <p className="acq-faint" style={{ fontSize: 12, marginBottom: 6, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>Only <b>verified</b> contacts are added to a campaign, so nothing bounces.{picked.size > 0 && notReady > 0 ? ` ${notReady} of your ${picked.size} selected ${notReady === 1 ? 'is' : 'are'} not ready yet.` : ''}{campaigns.length === 0 ? ' Create a campaign first to add prospects to it.' : ''}</span>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={includeUnverified} onChange={(e) => setIncludeUnverified(e.target.checked)} style={{ accentColor: '#9333ea' }} /> Also add unverified and business-only emails</label>
              </p>
              {pager}
              <div style={{ overflowX: 'auto' }}>
                <table className="acq-table acq-cards" style={{ minWidth: 980 }}>
                  <thead>{table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>{hg.headers.map((h) => h.column.id === 'check'
                      ? <th key={h.id} style={{ width: 32 }}><input type="checkbox" aria-label="Select this page" title="Select this page" checked={pageAllOn} onChange={togglePage} style={{ accentColor: '#9333ea' }} /></th>
                      : <th key={h.id} aria-sort={h.column.getIsSorted() === 'asc' ? 'ascending' : h.column.getIsSorted() === 'desc' ? 'descending' : 'none'}>
                          <button type="button" className="acq-sort" onClick={h.column.getToggleSortingHandler()} title="Sort by this column">{COLUMN_LABEL[h.column.id]}<span aria-hidden="true">{h.column.getIsSorted() === 'asc' ? ' ▲' : h.column.getIsSorted() === 'desc' ? ' ▼' : ''}</span></button>
                        </th>)}</tr>))}</thead>
                  <tbody>
                    {shown.length === 0 && <tr><td data-cell="empty" colSpan={Math.max(1, visibleIds.length)} className="acq-sub" style={{ textAlign: 'center', padding: 20 }}>No prospects match this search and these filters. <button type="button" className="acq-btn acq-btn-sm" onClick={clearFilters}>Clear them</button></td></tr>}
                    {pageRows.map((b) => {
                      const e = emails[b.id];
                      const host = b.website ? b.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : '';
                      const href = b.website ? (/^https?:\/\//i.test(b.website) ? b.website : `https://${b.website}`) : '';
                      const cells: Record<string, ReactNode> = {
                        check: <td key="check" data-cell="check"><input type="checkbox" aria-label={`Select ${b.name}`} checked={picked.has(b.id)} onChange={() => toggle(b.id)} style={{ accentColor: '#9333ea' }} /></td>,
                        name: <td key="name" data-cell="biz" style={{ maxWidth: 240 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <BizLogo name={b.name} website={b.website} />
                              <span style={{ minWidth: 0 }}>
                                <span style={{ display: 'block', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                                <span className="acq-sub" style={{ fontSize: 12 }}>{b.category}{b.foundBy && b.foundBy !== 'First search' ? <span className="acq-pill acq-pill-purple" style={{ marginLeft: 6, fontWeight: 500 }}>{b.foundBy}</span> : null}</span>
                              </span>
                            </span>
                          </td>,
                        address: <td key="address" data-cell="addr" className="acq-muted" style={{ maxWidth: 240 }}>{b.address || <span className="acq-faint">—</span>}</td>,
                        phone: <td key="phone" data-cell="phone" style={{ whiteSpace: 'nowrap' }}>{b.phone || <span className="acq-faint">No phone</span>}</td>,
                        website: <td key="website" data-cell="web" style={{ maxWidth: 200 }}>{href ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#7e22ce', textDecoration: 'underline', overflowWrap: 'anywhere' }}>{host}</a> : <span className="acq-faint">No website</span>}</td>,
                        rating: <td key="rating" data-cell="rating" style={{ whiteSpace: 'nowrap' }}>{typeof b.rating === 'number' ? <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Star size={12} />{b.rating}{b.reviewCount ? ` (${b.reviewCount})` : ''}</span> : <span className="acq-faint">—</span>}</td>,
                        contact: <td key="contact" data-cell="email" style={{ minWidth: 220 }}>
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
                                        {p.match ? <span className={`acq-pill ${p.match === 'confirmed' ? 'acq-pill-green' : 'acq-pill-amber'}`} style={{ marginLeft: 6 }} title={p.evidence?.snippet ? `Why: ${p.evidence.snippet}` : p.match === 'confirmed' ? 'Their own profile names this business next to this title.' : 'This business is named near them, but not on their own headline.'}>{p.match === 'confirmed' ? 'Confirmed' : 'Likely'}</span> : null}
                                        <br />
                                        {p.email
                                          ? v === 'invalid' ? <span className="acq-faint" style={{ textDecoration: 'line-through' }} title="The email check says this address does not exist">{p.email}</span>
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
                                    : action === 'find_dm'
                                      ? <select className="acq-select" aria-label={`Find people at ${b.name}`} style={{ height: 32, width: 'auto', minWidth: 150, fontWeight: 600, color: '#7e22ce' }} value="" onChange={(ev) => { const n = Number(ev.target.value); ev.target.value = ''; if (n) askPeople(b, n); }}>
                                          <option value="">Find people ▾</option><option value="3">Up to 3 people</option><option value="5">Up to 5 people</option><option value="10">Up to 10 people</option>
                                        </select>
                                      : action && <button className={`acq-btn acq-btn-sm ${action === 'retry' ? '' : 'acq-btn-primary'}`} onClick={() => act(b, action)}>{ACTION_LABEL[action]}</button>}
                                  {!busyRow && (st === 'untouched' || st === 'none') && e?.state !== 'done' && (
                                    <button type="button" className="acq-btn acq-btn-sm" style={{ border: 0, background: 'transparent', color: '#64748b', padding: 0, height: 'auto' }} onClick={() => void findEmail(b)}>Business email only</button>
                                  )}
                                </div>
                              );
                            })()}
                          </td>,
                        reviews: <td key="reviews" data-cell="reviews" style={{ whiteSpace: 'nowrap' }}>{b.reviewCount ? b.reviewCount.toLocaleString('en-US') : <span className="acq-faint">0</span>}</td>,
                      };
                      return <tr key={b.id}>{visibleIds.map((id) => cells[id])}</tr>;
                    })}
                  </tbody>
                </table>
              </div>
              {shown.length > 10 && pager}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
