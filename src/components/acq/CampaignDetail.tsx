'use client';

import CampaignPipeline from './CampaignPipeline';
import { sanitizeAutomation } from '@/lib/automation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, ArrowLeft, Check, Eye, FileText, Link2, Loader2, Mail, MessageCircle, Pause, Pencil, Play, Plus, Send, ShieldCheck, Sparkles, Trash2, Undo2, Wand2, X,
} from 'lucide-react';
import CampaignWhatsApp from './CampaignWhatsApp';
import { useRouter } from 'next/navigation';
import { useHandleAIResponse } from '@/context/UpgradeContext';
import type { LeadStage } from '@/lib/outreachCampaign';
import { timeAgoShort } from '@/lib/acqOverview';
import { useAcq } from './AcqProvider';
import CampaignFormModal from './CampaignFormModal';
import ImportLeadsModal from './ImportLeadsModal';
import { CAMPAIGN_STATUS_LABEL, Card, Pill, Skeleton, fmtNum } from './ui';
import type { CampaignDetailData, LeadDto } from './types';

const STAGE_PILL: Record<LeadStage, { label: string; tone: string }> = {
  queued: { label: 'Queued', tone: 'acq-pill-gray' },
  sent: { label: 'Sent', tone: 'acq-pill-sent' },
  opened: { label: 'Opened', tone: 'acq-pill-blue' },
  needs_follow_up: { label: 'Needs follow-up', tone: 'acq-pill-amber' },
  replied: { label: 'Replied', tone: 'acq-pill-green' },
  unsubscribed: { label: 'Unsubscribed', tone: 'acq-pill-red' },
  failed: { label: 'Failed', tone: 'acq-pill-red' },
  skipped: { label: 'Skipped', tone: 'acq-pill-gray' },
};

type Filter = 'all' | LeadStage | 'clicked' | 'interested';
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' }, { id: 'queued', label: 'Queued' }, { id: 'sent', label: 'Sent' }, { id: 'opened', label: 'Opened' },
  { id: 'clicked', label: 'Clicked' }, { id: 'needs_follow_up', label: 'Needs follow-up' }, { id: 'replied', label: 'Replied' },
  { id: 'interested', label: 'Interested' }, { id: 'unsubscribed', label: 'Unsubscribed' }, { id: 'failed', label: 'Failed' },
];

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '—');

const briefOf = (c: { automation?: unknown }) => (c.automation ? sanitizeAutomation(c.automation)?.brief ?? null : null);

interface BatchResponse { sent: number; failed: number; skipped: number; remainingToday: number; leftToSend: number; capReached: boolean; aborted?: string; message?: string; error?: string }

function Tile({ label, value, sub, color, hint, icon }: { label: string; value: number | string; sub?: string; color?: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="acq-card" style={{ padding: '14px 16px' }} title={hint}>
      <p className="acq-stat-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{icon}{label}</p>
      <p className="acq-stat-value" style={{ color: color ?? undefined, fontSize: 26 }}>{value}</p>
      {sub && <p className="acq-stat-foot">{sub}</p>}
    </div>
  );
}

export default function CampaignDetail({ id, openEdit }: { id: string; openEdit?: boolean }) {
  const router = useRouter();
  const handleGate = useHandleAIResponse();
  const { reload: reloadOverview, data: overview } = useAcq();
  const [data, setData] = useState<CampaignDetailData | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<null | 'run' | 'followup' | 'test'>(null);
  const [progress, setProgress] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [offer, setOffer] = useState<'website' | 'ai_system'>('ai_system');
  const [writing, setWriting] = useState('');
  const stop = useRef(false);

  const saveAsTemplate = async () => {
    const name = window.prompt('Template name', data?.campaign.name ?? '')?.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/client-acquisition/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaignId: id, name }) });
      const j = await res.json().catch(() => ({})) as { error?: string };
      setNotice(res.ok ? 'Saved to My Templates. Its emails and settings are kept; its contacts and results are not.' : j.error ?? 'Could not save the template.');
    } catch { setNotice('Could not save the template.'); }
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/outreach-campaigns/${id}`);
      const json = await res.json() as CampaignDetailData & { error?: string };
      if (!res.ok) { setError(res.status === 404 ? 'This campaign no longer exists.' : (json.error ?? 'Could not load this campaign.')); return; }
      setData(json); setError('');
    } catch { setError('Could not load this campaign.'); }
  }, [id]);

  const refresh = useCallback(async () => { await Promise.all([load(), reloadOverview()]); }, [load, reloadOverview]);

  useEffect(() => { void load(); }, [load]);
  // Opens and clicks trickle in while the page is open.
  useEffect(() => {
    const t = setInterval(() => { if (!busy && document.visibilityState === 'visible') void load(); }, 20_000);
    return () => clearInterval(t);
  }, [load, busy]);

  // Opened from /edit for a real campaign: go straight to the editing form once it has loaded.
  useEffect(() => { if (openEdit && data) setEditing(true); }, [openEdit, data]);

  const leads = data?.leads ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length };
    for (const l of leads) c[l.stage] = (c[l.stage] ?? 0) + 1;
    c.opened = leads.filter((l) => l.openedAt && l.sentAt).length;
    c.clicked = leads.filter((l) => l.clickedAt).length;
    c.interested = leads.filter((l) => l.repliedAt && l.outcome === 'interested').length;
    return c;
  }, [leads]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      const ok = filter === 'all' ? true
        : filter === 'opened' ? !!(l.openedAt && l.sentAt)
        : filter === 'clicked' ? !!l.clickedAt
        : filter === 'interested' ? !!(l.repliedAt && l.outcome === 'interested')
        : l.stage === filter;
      return ok && (!q || [l.email, l.name, l.business].some((v) => v?.toLowerCase().includes(q)));
    });
  }, [leads, filter, query]);

  /** Sends batches until nothing is left, the daily limit is hit, or something needs attention. */
  const runLoop = async (kind: 'initial' | 'followup') => {
    stop.current = false;
    let sent = 0, failed = 0, skipped = 0;
    let last: BatchResponse | null = null;
    for (let i = 0; i < 100 && !stop.current; i++) {
      const res = await fetch(`/api/outreach-campaigns/${id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) });
      const json = await res.json() as BatchResponse;
      if (handleGate(res, json) === true) return;
      if (res.status === 429) { setNotice('Sending too fast. Press the button again in a minute to continue.'); break; }
      if (!res.ok && !json.aborted) { setNotice(json.error ?? 'Sending stopped unexpectedly.'); break; }
      sent += json.sent; failed += json.failed; skipped += json.skipped;
      last = json;
      setProgress(`${sent} sent${failed ? ` · ${failed} failed` : ''}…`);
      await load();
      if (json.aborted || json.leftToSend === 0 || json.capReached || (json.sent + json.failed + json.skipped === 0)) break;
    }
    const bits = [`${sent} sent`];
    if (failed) bits.push(`${failed} failed`);
    if (skipped) bits.push(`${skipped} skipped`);
    let msg = bits.join(' · ');
    if (last?.aborted) msg += `. ${last.message ?? 'Stopped.'}`;
    else if (last?.capReached) msg += `. Daily limit reached. ${last.leftToSend} still waiting${kind === 'initial' ? ': they go out automatically tomorrow while the campaign is running, or press Resume then' : ': press the button again tomorrow'}.`;
    else if (stop.current) msg += '. Stopped.';
    setNotice(msg);
  };

  const run = async (kind: 'initial' | 'followup') => {
    if (!data) return;
    const { stats, campaign } = data;
    const who = kind === 'initial' ? stats.queued : stats.needsFollowUp;
    const ok = window.confirm(kind === 'initial'
      ? `Send "${campaign.subject}" to ${who} people, ${Math.min(who, campaign.dailyCap)} today (your daily limit is ${campaign.dailyCap})?\n\nIt goes from your own mailbox, and every email has an unsubscribe link. You can pause at any time.`
      : `Send the follow-up to ${who} people who haven't replied?`);
    if (!ok) return;
    setBusy(kind === 'initial' ? 'run' : 'followup');
    setNotice(''); setProgress('Starting…');
    try {
      if (kind === 'initial') {
        const res = await fetch(`/api/outreach-campaigns/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'run' }) });
        const json = await res.json() as { error?: string };
        if (handleGate(res, json) === true) return;
        if (!res.ok) { setNotice(json.error ?? 'Could not start the campaign.'); return; }
      }
      await runLoop(kind);
    } finally { setBusy(null); setProgress(''); await refresh(); }
  };

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/outreach-campaigns/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json() as { error?: string; replied?: number };
    if (!res.ok) { setNotice(json.error ?? 'That did not work.'); return null; }
    await refresh();
    return json;
  };
  const pause = async () => { stop.current = true; await patch({ action: 'pause' }); setNotice('Paused. Nothing more will be sent until you press Resume.'); };

  /** Writes each waiting lead's first email with the RUNVAX pitch engine, a few at a time, until none are left. */
  const [checkAvailable, setCheckAvailable] = useState(false);
  const [checking, setChecking] = useState('');
  useEffect(() => {
    let live = true;
    fetch(`/api/outreach-campaigns/${id}/verify`).then((r) => (r.ok ? r.json() : null)).then((j: { available?: boolean } | null) => { if (live) setCheckAvailable(!!j?.available); }).catch(() => {});
    return () => { live = false; };
  }, [id]);

  /** Checks every waiting address with Snov.io, 50 at a time, and removes the ones that do not exist. */
  const checkEmails = async () => {
    if (!window.confirm('Check every waiting email address with Snov.io? Addresses that do not exist are skipped so they never bounce. This uses one Snov.io credit per address.')) return;
    setChecking('Starting…'); setNotice('');
    let checked = 0, bad = 0, unsure = 0, unanswered = 0, stoppedMsg = '';
    try {
      let after: string | undefined;
      for (let i = 0; i < 100; i++) {
        const res = await fetch(`/api/outreach-campaigns/${id}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ after }) });
        const json = await res.json() as { checked?: number; invalid?: number; disposable?: number; unsure?: number; unanswered?: number; next?: string | null; error?: string };
        if (!res.ok) { stoppedMsg = json.error ?? 'Could not check the emails.'; break; }
        checked += json.checked ?? 0; bad += (json.invalid ?? 0) + (json.disposable ?? 0); unsure += json.unsure ?? 0; unanswered += json.unanswered ?? 0;
        setChecking(`${checked} checked…`);
        await load();
        if (!json.next) break;
        after = json.next;
      }
      setNotice(`${checked} address${checked === 1 ? '' : 'es'} checked: ${bad} bad removed${unsure ? `, ${unsure} could not be confirmed (still queued)` : ''}${unanswered ? `, ${unanswered} not answered` : ''}.${stoppedMsg ? ` ${stoppedMsg}` : ''}`);
    } finally { setChecking(''); await refresh(); }
  };

  const personalise = async () => {
    setWriting('Starting…'); setNotice('');
    let done = 0, failed = 0, stoppedMsg = '';
    try {
      for (let i = 0; i < 60; i++) {
        const res = await fetch(`/api/outreach-campaigns/${id}/personalize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offer }) });
        const json = await res.json() as { done?: number; failed?: number; left?: number; stopped?: string; error?: string };
        if (handleGate(res, json as { code?: string; error?: string; feature?: string }) === true) return;
        if (!res.ok) { stoppedMsg = json.error ?? 'Could not personalise.'; break; }
        done += json.done ?? 0; failed += json.failed ?? 0;
        setWriting(`${done} written…`);
        await load();
        if (json.stopped) { stoppedMsg = json.stopped; break; }
        if (!json.left || (json.done ?? 0) + (json.failed ?? 0) === 0) break;
      }
      setNotice(`${done} first email${done === 1 ? '' : 's'} written for individual businesses${failed ? `, ${failed} could not be written (they use the standard email)` : ''}.${stoppedMsg ? ` ${stoppedMsg}` : ''}`);
    } finally { setWriting(''); await refresh(); }
  };

  const sendTest = async () => {
    setBusy('test'); setNotice('');
    try {
      const res = await fetch(`/api/outreach-campaigns/${id}/test`, { method: 'POST' });
      const json = await res.json() as { to?: string; error?: string };
      setNotice(res.ok ? `Test email sent to ${json.to}. Check your inbox (and spam folder).` : (json.error ?? 'Could not send the test.'));
    } finally { setBusy(null); }
  };

  const leadAction = async (l: LeadDto, body: Record<string, unknown>) => {
    await fetch(`/api/outreach-campaigns/${id}/leads/${l.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    await refresh();
  };
  const removeLead = async (l: LeadDto) => {
    if (!window.confirm(l.sentAt ? `Stop emailing ${l.email}? They stay in the history.` : `Remove ${l.email} from this campaign?`)) return;
    await fetch(`/api/outreach-campaigns/${id}/leads/${l.id}`, { method: 'DELETE' });
    await refresh();
  };
  const submitReplies = async () => {
    const emails = replyText.split(/[\s,;]+/).map((e) => e.trim()).filter((e) => e.includes('@'));
    if (!emails.length) return;
    const r = await patch({ repliedEmails: emails });
    if (r) { setNotice(`${r.replied ?? 0} marked as replied${(r.replied ?? 0) < emails.length ? ` (${emails.length - (r.replied ?? 0)} didn't match anyone you've emailed)` : ''}.`); setReplyText(''); }
  };
  const del = async () => {
    if (!window.confirm('Delete this campaign and its history? This cannot be undone.')) return;
    await fetch(`/api/outreach-campaigns/${id}`, { method: 'DELETE' });
    await reloadOverview();
    router.push('/client-acquisition/campaigns');
  };

  if (error && !data) {
    return <div className="acq-warn" role="alert">{error} <Link href="/client-acquisition/campaigns" style={{ textDecoration: 'underline', fontWeight: 600 }}>Back to campaigns</Link></div>;
  }
  if (!data) return <div style={{ display: 'grid', gap: 16, paddingTop: 12 }}><Skeleton h={34} w={300} /><Skeleton h={90} /><Skeleton h={300} /></div>;

  const { campaign, stats, mailboxReady } = data;
  const running = campaign.status === 'running';
  const canRun = stats.queued > 0 && !busy && mailboxReady;

  return (
    <div className="acq-stack">
      <Link href="/client-acquisition/campaigns" className="acq-link" style={{ color: '#64748b', width: 'fit-content', paddingTop: 4 }}><ArrowLeft size={14} /> All campaigns</Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="acq-page-title" style={{ fontSize: 26, overflow: 'hidden', textOverflow: 'ellipsis' }}>{campaign.name}</h1>
          <p className="acq-sub" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Pill label={CAMPAIGN_STATUS_LABEL[campaign.status] ?? campaign.status} />
            <span>Up to {campaign.dailyCap} a day · &ldquo;{campaign.subject}&rdquo;</span>
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {running && !busy && <button className="acq-btn" onClick={() => void pause()}><Pause size={16} /> Pause</button>}
          {busy === 'run' || busy === 'followup' ? (
            <button className="acq-btn acq-btn-danger" onClick={() => { stop.current = true; }}><Loader2 size={16} className="animate-spin" /> {progress || 'Sending…'} Stop</button>
          ) : (
            <button className="acq-btn acq-btn-green" onClick={() => void run('initial')} disabled={!canRun}
              title={!mailboxReady ? 'Connect your email in Settings first' : stats.queued === 0 ? 'Nobody is waiting to be emailed' : undefined}>
              <Play size={16} /> {campaign.startedAt ? 'Resume sending' : 'Run campaign'}{stats.queued > 0 ? ` (${stats.queued})` : ''}
            </button>
          )}
        </div>
      </div>

      {!mailboxReady && (
        <div className="acq-warn" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertTriangle size={17} style={{ marginTop: 2, flex: 'none' }} />
          <span>Campaigns send from <b>your own mailbox</b>, so replies come to you. <Link href="/client-acquisition/integrations" style={{ textDecoration: 'underline', fontWeight: 600 }}>Connect your email in Integrations</Link> (sign in with Google, or use your own SMTP) to run this one.</span>
        </div>
      )}
      {notice && <div className="acq-notice" role="status" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{notice}</span><button className="acq-link" style={{ color: '#64748b' }} onClick={() => setNotice('')}>Dismiss</button></div>}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <Tile label="Leads" value={fmtNum(stats.total)} sub={stats.queued ? `${stats.queued} waiting` : undefined} />
        <Tile label="Sent" value={fmtNum(stats.sent)} color="#9333ea" />
        <Tile label="Opened" value={fmtNum(stats.opened)} sub={`${stats.openRate}% (estimate)`} color="#9333ea" icon={<Eye size={13} />} hint="Some mail apps load images automatically, so this can be higher than real reads. Readers who block images are never counted." />
        <Tile label="Clicked" value={fmtNum(stats.clicked)} color="#9333ea" icon={<Link2 size={13} />} sub="links in your email" />
        <Tile label="Replied" value={fmtNum(stats.replied)} sub={`${stats.replyRate}% of sent · ${stats.interested} interested`} color="#16a34a" />
        <Tile label="Needs follow-up" value={fmtNum(stats.needsFollowUp)} color="#b45309" sub={`after ${campaign.followUpAfterDays} days, no reply`} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {campaign.maxFollowUps > 0 && (
          <button className="acq-btn" style={{ background: '#fff8eb', borderColor: '#fcd9a6', color: '#92520a' }} onClick={() => void run('followup')} disabled={!!busy || stats.needsFollowUp === 0 || !mailboxReady}>
            <Send size={15} /> Send follow-up to {stats.needsFollowUp}
          </button>
        )}
        <button className="acq-btn" onClick={() => void sendTest()} disabled={!!busy || !mailboxReady}>{busy === 'test' ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Send me a test</button>
        <button className="acq-btn" onClick={() => setImporting(true)}><Plus size={15} /> Add leads</button>
        <button className="acq-btn acq-btn-primary" onClick={() => setEditing(true)}><Pencil size={15} /> Edit campaign</button>
        <Link href={`/client-acquisition/automation?campaign=${id}`} className="acq-btn"><Wand2 size={15} /> Automation</Link>
        <button className="acq-btn" onClick={() => void saveAsTemplate()}><FileText size={15} /> Save as template</button>
        <button className="acq-btn" style={{ marginLeft: 'auto', color: '#64748b', border: 0, background: 'transparent' }} onClick={() => void del()}><Trash2 size={15} /> Delete</button>
      </div>

      <CampaignWhatsApp campaignId={id} running={running} onSent={refresh} />

      <CampaignPipeline leads={data.leads} brief={briefOf(campaign)} onChanged={refresh} />

      {stats.queued > 0 && checkAvailable && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, background: '#dcfce7', color: '#16a34a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><ShieldCheck size={20} /></span>
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 14.5 }}>Check the waiting email addresses</p>
              <p className="acq-sub" style={{ fontSize: 13 }}>Finds addresses that do not exist before you send, so they never bounce and hurt your sender reputation. Checks {stats.queued} in bulk with Snov.io, one credit each.</p>
            </div>
            <button className="acq-btn acq-btn-primary" onClick={() => void checkEmails()} disabled={!!checking || !!writing || !!busy}>
              {checking ? <><Loader2 size={15} className="animate-spin" /> {checking}</> : <><ShieldCheck size={15} /> Check emails</>}
            </button>
          </div>
        </Card>
      )}

      {stats.queued > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, background: '#f3e8ff', color: '#9333ea', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Sparkles size={20} /></span>
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 14.5 }}>Personalise each first email with the RUNVAX pitch engine</p>
              <p className="acq-sub" style={{ fontSize: 13 }}>Writes a different opening for every business instead of one template. {data.personalised} of {stats.queued} waiting already done. Uses one AI call each.</p>
            </div>
            <select className="acq-select" aria-label="What you are pitching" value={offer} onChange={(e) => setOffer(e.target.value as 'website' | 'ai_system')} style={{ width: 'auto', minWidth: 190, height: 40 }} disabled={!!writing}>
              <option value="ai_system">Pitching an AI system</option><option value="website">Pitching a website</option>
            </select>
            <button className="acq-btn acq-btn-primary" onClick={() => void personalise()} disabled={!!writing || !!busy}>
              {writing ? <><Loader2 size={15} className="animate-spin" /> {writing}</> : <><Sparkles size={15} /> {data.personalised ? 'Write the rest' : 'Personalise'}</>}
            </button>
          </div>
        </Card>
      )}

      <details className="acq-card" style={{ padding: 0 }}>
        <summary style={{ cursor: 'pointer', padding: '14px 18px', fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageCircle size={16} style={{ color: '#16a34a' }} /> Got replies? Mark them here
          <span className="acq-faint" style={{ fontWeight: 400 }}>(replies arrive in your own inbox; RUNVAX can&apos;t read it yet)</span>
        </summary>
        <div style={{ padding: '0 18px 18px', display: 'grid', gap: 8 }}>
          <textarea className="acq-textarea" rows={3} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Paste the email addresses of people who replied, separated by spaces, commas or new lines" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
          <div><button className="acq-btn acq-btn-green acq-btn-sm" onClick={() => void submitReplies()} disabled={!replyText.includes('@')}>Mark as replied</button></div>
          <p className="acq-faint" style={{ fontSize: 12 }}>People marked as replied are never sent a follow-up. Then choose Interested or Not interested in the table or in your Inbox.</p>
        </div>
      </details>

      <Card pad={false}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid #eef2f8' }}>
          {FILTERS.map((f) => (
            <button key={f.id} className={`acq-tab${filter === f.id ? ' active' : ''}`} onClick={() => setFilter(f.id)}>{f.label} <span style={{ opacity: .7 }}>{counts[f.id] ?? 0}</span></button>
          ))}
          <input className="acq-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" aria-label="Search leads" style={{ marginLeft: 'auto', width: 220, height: 34, padding: '0 12px' }} />
        </div>
        {leads.length === 0 ? (
          <div className="acq-sub" style={{ padding: '48px 16px', textAlign: 'center' }}>No leads yet. Use <b>Add leads</b> to upload a list.</div>
        ) : (
          <div style={{ overflowX: 'auto', padding: '8px 18px 6px' }}>
            <table className="acq-table" style={{ minWidth: 820 }}>
              <thead><tr><th style={{ paddingTop: 8 }}>Lead</th><th>Status</th><th>Sent</th><th>Opens</th><th>Clicks</th><th>Follow-ups</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {shown.map((l) => {
                  const st = l.repliedAt && l.outcome === 'interested' ? { label: 'Interested', tone: 'acq-pill-green' } : l.repliedAt && l.outcome === 'not_interested' ? { label: 'Not interested', tone: 'acq-pill-gray' } : STAGE_PILL[l.stage];
                  return (
                    <tr key={l.id}>
                      <td style={{ maxWidth: 280 }}>
                        <p style={{ fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.email}</p>
                        <p className="acq-sub" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[l.name, l.business].filter(Boolean).join(' · ') || '—'}</p>
                      </td>
                      <td>
                        <span className={`acq-pill ${st.tone}`}>{st.label}</span>
                        {l.error && <p style={{ fontSize: 11, color: '#b91c1c', marginTop: 3, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.error}>{l.error}</p>}
                      </td>
                      <td className="acq-muted" style={{ whiteSpace: 'nowrap' }}>{fmt(l.sentAt)}</td>
                      <td className="acq-muted">{l.openCount > 0 ? <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color: '#9333ea' }} title={l.openedAt ? `First opened ${timeAgoShort(l.openedAt)}` : undefined}><Eye size={13} />{l.openCount}</span> : '—'}</td>
                      <td className="acq-muted">{l.clickCount > 0 ? <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color: '#9333ea' }}><Link2 size={13} />{l.clickCount}</span> : '—'}</td>
                      <td className="acq-muted">{l.followUpsSent || '—'}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {l.sentAt && !l.unsubscribedAt && (l.repliedAt ? (
                          <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', marginRight: 8 }}>
                            {l.outcome !== 'interested' && <button className="acq-link" style={{ color: '#16a34a', fontWeight: 600 }} onClick={() => void leadAction(l, { outcome: 'interested' })}><Check size={13} /> Interested</button>}
                            {l.outcome !== 'not_interested' && <button className="acq-link" style={{ color: '#64748b' }} onClick={() => void leadAction(l, { outcome: 'not_interested' })}><X size={13} /> Not interested</button>}
                            <button className="acq-link" style={{ color: '#64748b' }} title="Undo replied" onClick={() => void leadAction(l, { replied: false })}><Undo2 size={13} /> Undo</button>
                          </span>
                        ) : (
                          <button className="acq-link" style={{ color: '#16a34a', fontWeight: 600, marginRight: 12 }} onClick={() => void leadAction(l, { replied: true })}><MessageCircle size={13} /> Replied</button>
                        ))}
                        {l.status !== 'skipped' && <button className="acq-icon-btn" style={{ display: 'inline-flex', width: 28, height: 28 }} aria-label={`Remove ${l.email}`} title="Remove" onClick={() => void removeLead(l)}><Trash2 size={14} /></button>}
                      </td>
                    </tr>
                  );
                })}
                {shown.length === 0 && <tr><td colSpan={7} className="acq-sub" style={{ textAlign: 'center', padding: 28 }}>Nobody matches this filter.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
            <p className="acq-faint" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Check size={13} /> Every email carries an unsubscribe link. Anyone who unsubscribes is never emailed again from your account.</p>

      {editing && <CampaignFormModal existing={campaign} onClose={() => setEditing(false)} onGate={handleGate} onSaved={() => { setEditing(false); void refresh(); }} />}
      {importing && (
        <ImportLeadsModal
          campaignId={id} campaigns={(overview?.campaigns ?? [{ id, name: campaign.name }]).map((c) => ({ id: c.id, name: c.name }))}
          onClose={() => setImporting(false)} onNewCampaign={() => { setImporting(false); router.push('/client-acquisition/campaigns'); }}
          onImported={(msg) => { setImporting(false); setNotice(msg); void refresh(); }}
        />
      )}
    </div>
  );
}
