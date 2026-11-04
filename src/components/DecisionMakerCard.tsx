'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, UserCheck, UserRound, ShieldAlert, HelpCircle, Search, Pencil, X, Check, Sparkles, ExternalLink, Mail, Phone } from 'lucide-react';
import type { Business } from '@/types';
import { assessReach, type ReachLevel } from '@/lib/decisionMaker';

type DM = NonNullable<Business['decisionMaker']>;
type Cand = NonNullable<Business['dmCandidates']>[number];

interface Props {
  /** The business as the sender currently sees it (including any email typed in the modal). */
  business: Business;
  onChange: (dm: DM | null) => void;
}

const STYLE: Record<ReachLevel, { box: string; text: string; icon: typeof UserCheck }> = {
  direct:     { box: 'border-green-500/25 bg-green-500/[0.05]',   text: 'text-green-400',  icon: UserCheck },
  likely:     { box: 'border-blue-500/25 bg-blue-500/[0.05]',     text: 'text-blue-400',   icon: UserRound },
  gatekeeper: { box: 'border-yellow-500/25 bg-yellow-500/[0.05]', text: 'text-yellow-400', icon: ShieldAlert },
  unknown:    { box: 'border-white/10 bg-white/[0.03]',           text: 'text-gray-400',   icon: HelpCircle },
};

export default function DecisionMakerCard({ business, onChange }: Props) {
  const reach = useMemo(() => assessReach(business), [business]);
  const [finding, setFinding] = useState<false | 'free' | 'deep'>(false);
  const [candidates, setCandidates] = useState<Cand[]>(business.dmCandidates ?? []);
  const [paidAvailable, setPaidAvailable] = useState(false);
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(business.decisionMaker?.name ?? '');
  const [title, setTitle] = useState(business.decisionMaker?.title ?? '');
  const [email, setEmail] = useState(business.decisionMaker?.email ?? '');
  const [phone, setPhone] = useState(business.decisionMaker?.phone ?? '');
  // Whether a paid source (Hunter, Apollo, Apify) is configured, so the contact lookup can be offered up front.
  const [paidConfigured, setPaidConfigured] = useState(false);
  useEffect(() => {
    let live = true;
    fetch('/api/decision-maker').then((r) => (r.ok ? r.json() : null))
      .then((j: { paidConfigured?: boolean } | null) => { if (live) setPaidConfigured(!!j?.paidConfigured); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  const dm = business.decisionMaker;
  const canFindContact = paidConfigured && !!dm && !dm.email;

  const style = STYLE[reach.level];
  const Icon = style.icon;

  const find = async (deep = false) => {
    setFinding(deep ? 'deep' : 'free');
    setMsg('');
    try {
      const res = await fetch('/api/decision-maker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id, name: business.name, address: business.address, website: business.website, category: business.category, categoryTypes: business.categoryTypes, deep }),
      });
      const json = await res.json() as { decisionMaker?: DM | null; candidates?: Cand[]; paidAvailable?: boolean; error?: string };
      if (res.status === 401) setMsg('Sign in to look up decision-makers.');
      else if (!res.ok) setMsg(json.error ?? 'Lookup failed');
      else {
        setCandidates(json.candidates ?? []);
        setPaidAvailable(!!json.paidAvailable);
        if (!json.decisionMaker) setMsg(deep ? "Still couldn't find a named owner. Add one yourself if you know it." : "Couldn't find a named owner in public sources.");
        else {
          onChange(json.decisionMaker);
          if (deep && !json.decisionMaker.email) setMsg('Found the person, but no paid source had their email. Try their LinkedIn, or ask the front desk.');
        }
      }
    } catch {
      setMsg('Lookup failed — try again.');
    } finally {
      setFinding(false);
    }
  };

  const pick = async (c: Cand) => {
    try {
      const res = await fetch('/api/decision-maker', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id, name: c.name, title: c.title, source: c.source, linkedin: c.linkedin, email: c.email, phone: c.phone }),
      });
      const json = await res.json() as { decisionMaker?: DM | null };
      if (res.ok && json.decisionMaker) onChange(json.decisionMaker);
    } catch { setMsg('Could not switch — try again.'); }
  };

  const save = async (clear = false) => {
    const body = clear ? { name: '' } : { name, title, email, phone };
    try {
      const res = await fetch('/api/decision-maker', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id, ...body }),
      });
      const json = await res.json() as { decisionMaker?: DM | null; error?: string };
      if (res.status === 401) { setMsg('Sign in to save a contact.'); return; }
      if (!res.ok) { setMsg(json.error ?? 'Could not save'); return; }
      onChange(json.decisionMaker ?? null);
      if (clear) { setName(''); setTitle(''); setEmail(''); setPhone(''); }
      setEditing(false);
      setMsg('');
    } catch {
      setMsg('Could not save — try again.');
    }
  };

  const inputCls = 'w-full bg-gray-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60';

  return (
    <div className={`rounded-xl border p-4 ${style.box}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${style.text}`} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Who this reaches</p>
          <p className={`text-sm font-bold mt-0.5 ${style.text}`}>{reach.headline}</p>
          <p className="text-xs text-gray-400 mt-1 leading-snug">{reach.detail}</p>
          <p className="text-xs text-gray-300 mt-1.5 leading-snug"><span className="font-semibold">Next:</span> {reach.nextStep}</p>
          {(dm?.email || dm?.phone) && (
            <div className="mt-2 space-y-1 text-xs">
              {dm.email && (
                <p className="flex items-center gap-1.5 text-green-300 min-w-0">
                  <Mail className="w-3 h-3 flex-shrink-0" /><span className="truncate font-semibold">{dm.email}</span>
                  {dm.emailStatus && <span className="text-gray-500 flex-shrink-0">· {dm.emailStatus}</span>}
                </p>
              )}
              {dm.phone && (
                <p className="flex items-center gap-1.5 text-green-300"><Phone className="w-3 h-3 flex-shrink-0" /><span className="font-semibold">{dm.phone}</span></p>
              )}
            </div>
          )}
          {business.decisionMaker?.linkedin && (
            <a href={business.decisionMaker.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1.5">
              <ExternalLink className="w-3 h-3" /> View LinkedIn profile
            </a>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Role, e.g. Owner" />
            <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their email (optional)" type="email" />
            <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Their phone (optional)" type="tel" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => void save()} disabled={!name.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold">
              <Check className="w-3.5 h-3.5" /> Save
            </button>
            {business.decisionMaker && (
              <button onClick={() => void save(true)} className="px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 rounded-lg">Remove</button>
            )}
            <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white rounded-lg">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!business.decisionMaker && (
            <button onClick={() => void find()} disabled={!!finding} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 rounded-lg text-xs font-bold disabled:opacity-60">
              {finding === 'free' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              {finding === 'free' ? 'Searching…' : 'Find decision-maker'}
            </button>
          )}
          {(paidAvailable || canFindContact) && (
            <button onClick={() => void find(true)} disabled={!!finding} title="Uses paid lookup credits" className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-bold disabled:opacity-60">
              {finding === 'deep' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {finding === 'deep' ? 'Searching deeper…' : canFindContact ? 'Find their email' : 'Search deeper'}
            </button>
          )}
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 rounded-lg text-xs font-bold">
            <Pencil className="w-3.5 h-3.5" /> {business.decisionMaker ? 'Edit contact' : 'Add name'}
          </button>
        </div>
      )}
      {msg && <p className="text-xs text-gray-400 mt-2">{msg}</p>}

      {!editing && candidates.filter((c) => c.name !== business.decisionMaker?.name).length > 0 && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Others we found</p>
          <ul className="space-y-1.5">
            {candidates.filter((c) => c.name !== business.decisionMaker?.name).map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-gray-300">
                  <span className="font-semibold">{c.name}</span>{c.title ? `, ${c.title}` : ''}
                  <span className="text-gray-600"> · {c.source}</span>
                  {c.email && <span className="text-green-400"> · {c.email}</span>}
                </span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  {c.linkedin && <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300"><ExternalLink className="w-3 h-3" /></a>}
                  <button onClick={() => void pick(c)} className="font-bold text-purple-400 hover:text-purple-300">Use</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
