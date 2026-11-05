'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  Bell, Bot, ChevronDown, ChevronsLeft, ChevronsRight, Crown, FileText, Home, Lock, Mail, Menu, MessageCircle,
  Search, Send, Settings, Users, Wand2, Zap, MapPin,
} from 'lucide-react';
import { DEFAULT_HOME } from '@/lib/home';
import { useUpgrade } from '@/context/UpgradeContext';
import { PRICING_ENABLED } from '@/lib/promo';
import Logo from './Logo';
import { useAcq } from './AcqProvider';

/** One menu for the whole product: Find Prospects first (it is the default page), then the Client Acquisition tools, then the classic prospecting pages. */
const NAV_GROUPS: Array<{ heading?: string; items: ReadonlyArray<{ href: string; label: string; icon: typeof Home; exact?: boolean; badge?: boolean }> }> = [
  { items: [
    { href: DEFAULT_HOME, label: 'Find Prospects', icon: MapPin },
  ] },
  { heading: 'Client Acquisition', items: [
    { href: '/client-acquisition', label: 'Overview', icon: Home, exact: true },
    { href: '/client-acquisition/leads', label: 'Lead Lists', icon: Users },
    { href: '/client-acquisition/campaigns', label: 'Campaigns', icon: Send },
    { href: '/client-acquisition/automation', label: 'Automation Builder', icon: Wand2 },
    { href: '/client-acquisition/activity', label: 'Email Activity', icon: Mail },
    { href: '/client-acquisition/inbox', label: 'Inbox & Opportunities', icon: MessageCircle, badge: true },
    { href: '/client-acquisition/agents', label: 'AI Agents', icon: Bot },
    { href: '/client-acquisition/templates', label: 'Templates', icon: FileText },
    { href: '/client-acquisition/integrations', label: 'Integrations', icon: Zap },
  ] },
  { heading: 'Prospecting', items: [
    { href: '/', label: 'Classic Find Prospects', icon: Search, exact: true },
  ] },
  { items: [
    { href: '/settings', label: 'Settings', icon: Settings },
  ] },
];

interface SearchResults {
  campaigns: Array<{ id: string; name: string; status: string }>;
  leads: Array<{ id: string; campaignId: string; campaignName: string; email: string; business: string | null }>;
}

function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<SearchResults | null>(null);
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus(); setOpen(true); }
      if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
    };
    const onClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClick); };
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/client-acquisition/search?q=${encodeURIComponent(q.trim())}`);
        if (r.ok) setRes(await r.json() as SearchResults);
      } catch { /* the box just stays empty */ }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const go = (href: string) => { setOpen(false); setQ(''); router.push(href); };
  const empty = res && res.campaigns.length === 0 && res.leads.length === 0;

  return (
    <div className="acq-search" ref={boxRef}>
      <Search size={17} style={{ position: 'absolute', left: 13, top: 12, color: '#64748b' }} />
      <input
        ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        placeholder="Search leads, campaigns, or emails…" aria-label="Search"
        onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) go(`/client-acquisition/leads?q=${encodeURIComponent(q.trim())}`); }}
      />
      <span className="acq-kbd">{isMac ? '⌘' : 'Ctrl'} K</span>
      {open && q.trim().length >= 2 && (
        <div className="acq-dropdown" style={{ top: 46, left: 0, right: 0, padding: 8, maxHeight: 420, overflowY: 'auto' }}>
          {!res && <p className="acq-sub" style={{ padding: 10, fontSize: 13 }}>Searching…</p>}
          {empty && <p className="acq-sub" style={{ padding: 10, fontSize: 13 }}>Nothing found for &ldquo;{q}&rdquo;.</p>}
          {res && res.campaigns.length > 0 && (
            <>
              <p className="acq-faint" style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>Campaigns</p>
              {res.campaigns.map((c) => (
                <button key={c.id} onClick={() => go(`/client-acquisition/campaigns/${c.id}`)} className="acq-nav-item" style={{ width: '100%', height: 38, border: 0, background: 'transparent', textAlign: 'left' }}>
                  <Send size={15} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                </button>
              ))}
            </>
          )}
          {res && res.leads.length > 0 && (
            <>
              <p className="acq-faint" style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>Leads</p>
              {res.leads.map((l) => (
                <button key={l.id} onClick={() => go(`/client-acquisition/leads?q=${encodeURIComponent(l.email)}`)} className="acq-nav-item" style={{ width: '100%', height: 'auto', padding: '8px 14px', border: 0, background: 'transparent', textAlign: 'left', alignItems: 'flex-start', flexDirection: 'column', gap: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{l.email}</span>
                  <span className="acq-sub" style={{ fontSize: 12 }}>{[l.business, l.campaignName].filter(Boolean).join(' · ')}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);
  const name = session?.user?.name ?? session?.user?.email?.split('@')[0] ?? 'Account';
  const plan = (session?.user as { plan?: string } | undefined)?.plan ?? 'free';
  const planLabel = `${plan.charAt(0).toUpperCase()}${plan.slice(1)} Plan`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 0, padding: 4 }} aria-haspopup="menu" aria-expanded={open}>
        <span style={{ width: 38, height: 38, borderRadius: 999, background: '#9333ea', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
          {name[0]?.toUpperCase() ?? '?'}
        </span>
        <span className="acq-only-desktop" style={{ textAlign: 'left', lineHeight: 1.2 }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{name}</span>
          <span style={{ display: 'block', fontSize: 12, color: '#64748b' }}>{planLabel}</span>
        </span>
        <ChevronDown size={16} className="acq-only-desktop" style={{ color: '#64748b' }} />
      </button>
      {open && (
        <div className="acq-dropdown" role="menu" style={{ top: 50, right: 0, width: 220, padding: 6 }}>
          <Link href={DEFAULT_HOME} className="acq-nav-item" style={{ height: 38 }}>Find Prospects</Link>
          <Link href="/pipeline" className="acq-nav-item" style={{ height: 38 }}>Prospect CRM</Link>
          <Link href="/command-centre" className="acq-nav-item" style={{ height: 38 }}>Dashboard</Link>
          <Link href="/settings" className="acq-nav-item" style={{ height: 38 }}>Settings</Link>
          <button onClick={() => void signOut({ callbackUrl: '/' })} className="acq-nav-item" style={{ height: 38, width: '100%', border: 0, background: 'transparent', color: '#b91c1c', textAlign: 'left' }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

function GateCard({ gate }: { gate: 'signin' | 'locked' | 'unverified' | 'setup' }) {
  const { triggerUpgrade } = useUpgrade();
  const copy = {
    signin: { title: 'Sign in to start winning clients', body: 'Client Acquisition is where your campaigns, leads and replies live.', action: <Link href="/auth/signin" className="acq-btn acq-btn-primary">Sign in</Link> },
    locked: { title: 'Client Acquisition is part of Email Blast', body: 'Available on Pro and Agency plans.', action: <button className="acq-btn acq-btn-primary" onClick={() => triggerUpgrade('feature', 'Email Blast')}><Lock size={15} /> See plans</button> },
    setup: { title: 'Client Acquisition needs one database update', body: 'The tables for campaigns and contacts have not been created yet. An administrator needs to apply migration 5_outreach_campaigns once. Nothing else is affected.', action: null },
    unverified: { title: 'Verify your email first', body: 'We sent you a verification link. Campaigns are only for verified accounts, so your emails reach inboxes and not spam folders.', action: null },
  }[gate];
  return (
    <div className="acq-card" style={{ padding: '56px 24px', textAlign: 'center', maxWidth: 560, margin: '48px auto' }}>
      <h2 className="acq-title" style={{ fontSize: 20, marginBottom: 8 }}>{copy.title}</h2>
      <p className="acq-sub" style={{ marginBottom: copy.action ? 20 : 0 }}>{copy.body}</p>
      {copy.action}
    </div>
  );
}

export default function AcqShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data, gate } = useAcq();
  const [rail, setRail] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { try { setRail(localStorage.getItem('acq_rail') === '1'); } catch { /* default open */ } }, []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  const toggleRail = () => setRail((v) => { try { localStorage.setItem('acq_rail', v ? '0' : '1'); } catch { /* not saved */ } return !v; });

  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const inbox = data?.inboxCount ?? 0;
  const running = (data?.runningCampaigns ?? 0) > 0;
  const sending = data?.sending ?? { today: 0, limit: 200 };
  const pctUsed = sending.limit ? Math.min(100, Math.round((sending.today / sending.limit) * 100)) : 0;

  return (
    <div className="acq-root">
      {mobileOpen && <div className="acq-scrim" onClick={() => setMobileOpen(false)} />}

      <aside className={`acq-sidebar${rail ? ' rail' : ''}${mobileOpen ? ' open' : ''}`} aria-label="Client Acquisition navigation">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: rail ? 'center' : 'space-between', height: 64, padding: rail ? 0 : '0 16px 0 20px' }}>
          <Link href={DEFAULT_HOME} aria-label="RUNVAX Find Prospects"><Logo compact={rail} /></Link>
          {!rail && (
            <button className="acq-icon-btn acq-only-desktop" onClick={toggleRail} aria-label="Collapse sidebar"><ChevronsLeft size={18} /></button>
          )}
        </div>
        {rail && <button className="acq-icon-btn acq-only-desktop" onClick={toggleRail} aria-label="Expand sidebar" style={{ alignSelf: 'center', marginBottom: 6 }}><ChevronsRight size={18} /></button>}

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: rail ? '8px 10px' : '8px 12px', flex: 1, overflowY: 'auto' }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: gi === 0 ? 0 : 10 }}>
              {group.heading && !rail && <p className="acq-faint" style={{ padding: '4px 14px 2px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{group.heading}</p>}
              {group.heading && rail && <span style={{ height: 1, background: 'var(--line)', margin: '2px 8px' }} />}
              {group.items.map((item) => {
                const Icon = item.icon;
                const on = active(item.href, item.exact);
                return (
                  <Link key={item.href} href={item.href} className={`acq-nav-item${on ? ' active' : ''}`} title={rail ? item.label : undefined} style={rail ? { justifyContent: 'center', padding: 0, position: 'relative' } : undefined} aria-current={on ? 'page' : undefined}>
                    <Icon size={19} />
                    {!rail && <span>{item.label}</span>}
                    {item.badge && inbox > 0 && (
                      rail
                        ? <span style={{ position: 'absolute', top: 6, right: 8, width: 9, height: 9, borderRadius: 999, background: '#ef4444' }} />
                        : <span className="acq-badge">{inbox > 99 ? '99+' : inbox}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {!rail && (
          <div className="acq-card" style={{ margin: 16, padding: 16 }}>
            <p style={{ fontWeight: 700, fontSize: 15 }}>Sending today</p>
            <p className="acq-sub" style={{ fontSize: 13.5, margin: '6px 0 10px' }}>{sending.today.toLocaleString('en-US')} / {sending.limit.toLocaleString('en-US')}</p>
            <div className="acq-progress"><i style={{ width: `${pctUsed}%` }} /></div>
            {PRICING_ENABLED ? (
              <Link href="/pricing" className="acq-btn" style={{ width: '100%', marginTop: 14, background: '#f3e8ff', borderColor: '#f3e8ff', color: '#9333ea' }}><Crown size={16} /> Upgrade Plan</Link>
            ) : (
              <Link href="/settings" className="acq-btn" style={{ width: '100%', marginTop: 14, background: '#f3e8ff', borderColor: '#f3e8ff', color: '#9333ea' }}><Settings size={16} /> Email settings</Link>
            )}
          </div>
        )}
      </aside>

      <div className="acq-main" style={{ paddingLeft: undefined }}>
        <style>{`@media (min-width:1024px){.acq-main{padding-left:${rail ? 76 : 250}px}}`}</style>
        <header className="acq-topbar">
          <button className="acq-icon-btn acq-only-mobile" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <GlobalSearch />
          <div style={{ flex: 1 }} />
          <span className={`acq-status acq-only-desktop${running ? '' : ' idle'}`}><span className="acq-dot" />{running ? 'Campaigns Running' : 'Nothing Running'}</span>
          <Link href="/client-acquisition/inbox" className="acq-icon-btn" aria-label={inbox > 0 ? `${inbox} replies waiting` : 'Inbox'} style={{ position: 'relative', width: 40, height: 40 }}>
            <Bell size={20} />
            {inbox > 0 && <span style={{ position: 'absolute', top: 7, right: 8, width: 9, height: 9, borderRadius: 999, background: '#ef4444', border: '2px solid #f6f8fc' }} />}
          </Link>
          <UserMenu />
        </header>

        <main className="acq-content">
          {gate && !(gate !== 'signin' && pathname === DEFAULT_HOME) ? <GateCard gate={gate} /> : children}
        </main>
      </div>
    </div>
  );
}
