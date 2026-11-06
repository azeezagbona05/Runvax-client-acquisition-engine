'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, FlaskConical, GitBranch, Loader2, Mail, MessageSquare, Pencil, Rocket, Search, Send, Sparkles, Upload, Wand2 } from 'lucide-react';
import { useHandleAIResponse } from '@/context/UpgradeContext';
import { SEND_IF_LABEL, dayNumbers, sanitizeAutomation, summarize, type Automation } from '@/lib/automation';
import { OBJECTIVES, sanitizeBrief, type CampaignBrief } from '@/lib/campaignBrief';
import { planFromGoal } from '@/lib/campaignBuilder';
import { PLAY_LABEL, PLAY_ACTION, ACTION_LABEL } from '@/lib/replyPlaybook';
import type { LeadInput } from '@/lib/outreachCampaign';
import LeadPicker from '../LeadPicker';
import WorkflowCanvas from './WorkflowCanvas';
import CampaignTest from './CampaignTest';

const EXAMPLES = [
  'I want to sell AI agents to dental clinics: visibility, receptionist, follow up and patient reactivation',
  'Sell our website redesign service to restaurants in Lagos, book 10 calls',
  'Pitch an AI receptionist to law firms in London, formal tone',
  'Promote our bookkeeping software to small accounting firms, 5 emails, 20 a day',
];

interface BuildStep { title: string; items: string[] }
type Phase = 'idle' | 'building' | 'done' | 'error';
type Tab = 'workflow' | 'emails' | 'replies' | 'test' | 'leads';

const STEP_TITLES = [
  'Reading your request',
  'Understanding your offer and market',
  'Writing the email sequence',
  'Adding the conditions and branches',
  'Writing what to say to every kind of reply',
  'Setting the sending rules and safety checks',
  'Creating your campaign',
];

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** What each build stage produced, as short lines that appear one by one. */
function stepItems(prompt: string, a: Automation, b: CampaignBrief): string[][] {
  const days = dayNumbers(a);
  return [
    [`"${prompt.length > 120 ? `${prompt.slice(0, 117)}…` : prompt}"`],
    [
      `Offer: ${b.offer || 'your service'}`, `Market: ${b.audience || 'your prospects'}`,
      `Objective: ${OBJECTIVES.find((o) => o.id === b.objective)?.label ?? 'Book meetings'}`,
      ...(b.goal ? [`Goal: ${b.goal}`] : []), ...b.features.slice(0, 6).map((f) => `Includes ${f.split(':')[0]}`),
    ],
    a.emails.map((e, i) => `Day ${days[i]} · ${i === 0 ? 'Introduction' : i === a.emails.length - 1 ? 'Final note' : 'Follow-up'}: ${e.subject}`),
    [
      ...a.emails.slice(1).map((e, k) => `Email ${k + 2}: wait ${e.waitDays} day${e.waitDays === 1 ? '' : 's'}, send if ${SEND_IF_LABEL[e.sendIf].toLowerCase()}${e.openedVariant ? ', with a second version for people who opened' : ''}`),
      a.stopOnReply ? 'Any reply stops the follow-ups' : 'Replies do not stop the follow-ups',
      `Out-of-office replies pause for ${a.replyRules.outOfOfficePauseDays} days, then loop back in`,
    ],
    (a.playbook ?? []).map((p) => `${PLAY_LABEL[p.replyClass]} → ${ACTION_LABEL[PLAY_ACTION[p.replyClass]].split(',')[0].toLowerCase()}`),
    [`Up to ${a.dailyCap} emails a day, ${a.windowStart}:00 to ${a.windowEnd}:00${a.weekdaysOnly ? ', weekdays' : ''}`, 'Unsubscribe link in every email, unsubscribed and bounced addresses never contacted', 'Follow-ups wait for your click before they go out'],
    [],
  ];
}

export default function AutopilotSetup({ onManual }: { onManual: (a: Automation, b: CampaignBrief, campaignId: string | null) => void }) {
  const handleGate = useHandleAIResponse();
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [steps, setSteps] = useState<BuildStep[]>([]);
  const [active, setActive] = useState(-1);
  const [auto, setAuto] = useState<Automation | null>(null);
  const [brief, setBrief] = useState<CampaignBrief | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [source, setSource] = useState<'ai' | 'rules'>('rules');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('workflow');
  const [leads, setLeads] = useState<LeadInput[]>([]);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(0);
  const [refine, setRefine] = useState('');
  const [refining, setRefining] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);

  const reveal = async (i: number, items: string[]) => {
    setActive(i);
    setSteps((s) => s.map((x, k) => (k === i ? { ...x, items: [] } : x)));
    for (let k = 0; k < items.length; k++) {
      await wait(140);
      if (!live.current) return;
      setSteps((s) => s.map((x, j) => (j === i ? { ...x, items: [...x.items, items[k]] } : x)));
    }
    await wait(380);
  };

  const build = async (text: string) => {
    const p = text.trim();
    if (!p) return;
    setPhase('building'); setNotice(''); setCampaignId(null); setAdded(0); setTab('workflow');
    setSteps(STEP_TITLES.map((t) => ({ title: t, items: [] })));
    setActive(0);

    // The plan is requested straight away; the first stages animate while it is written.
    const planning = (async (): Promise<{ a: Automation; b: CampaignBrief; source: 'ai' | 'rules'; notice?: string } | 'gated'> => {
      try {
        const res = await fetch('/api/client-acquisition/automation/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: p }) });
        const j = await res.json() as { automation?: unknown; brief?: unknown; source?: 'ai' | 'rules'; notice?: string; error?: string; code?: string };
        if (handleGate(res, j) === true) return 'gated';
        const a = res.ok && j.automation ? sanitizeAutomation(j.automation) : null;
        if (a) return { a, b: sanitizeBrief(j.brief ?? a.brief ?? {}), source: j.source ?? 'rules', notice: j.notice };
      } catch { /* the built-in planner answers below */ }
      const built = planFromGoal(p, null);
      return { a: built.automation, b: built.brief, source: 'rules', notice: 'Built by the built-in planner (the AI could not be reached).' };
    })();

    await reveal(0, [`"${p.length > 120 ? `${p.slice(0, 117)}…` : p}"`]);
    setActive(1);
    const plan = await planning;
    if (!live.current) return;
    if (plan === 'gated') { setPhase('idle'); return; }
    const a = { ...plan.a, brief: plan.b };
    setAuto(a); setBrief(plan.b); setSource(plan.source); if (plan.notice) setNotice(plan.notice);

    const all = stepItems(p, a, plan.b);
    for (let i = 1; i < 6; i++) { await reveal(i, all[i]); if (!live.current) return; }

    setActive(6);
    try {
      const res = await fetch('/api/outreach-campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: a.name, automation: a }) });
      const j = await res.json() as { id?: string; error?: string; code?: string };
      if (handleGate(res, j) === true) { setPhase('done'); return; }
      if (!res.ok || !j.id) {
        setSteps((s) => s.map((x, k) => (k === 6 ? { ...x, items: [res.status === 401 ? 'Sign in to save the campaign. Everything above is ready.' : j.error ?? 'The campaign could not be saved. Everything above is ready to save again.'] } : x)));
      } else {
        setCampaignId(j.id);
        setSteps((s) => s.map((x, k) => (k === 6 ? { ...x, items: ['Saved as a draft campaign. Nothing is sent until you add leads and press Run.'] } : x)));
      }
    } catch {
      setSteps((s) => s.map((x, k) => (k === 6 ? { ...x, items: ['Could not reach the server to save. Check your connection.'] } : x)));
    }
    await wait(500);
    setActive(7);
    setPhase('done');
  };

  const saveAgain = async () => {
    if (!auto) return;
    const res = await fetch('/api/outreach-campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: auto.name, automation: auto }) });
    const j = await res.json().catch(() => ({})) as { id?: string; error?: string };
    if (handleGate(res, j) === true) return;
    if (res.ok && j.id) { setCampaignId(j.id); setNotice('Campaign saved as a draft.'); } else setNotice(j.error ?? 'Could not save the campaign.');
  };

  const doRefine = async () => {
    if (!auto || !refine.trim()) return;
    setRefining(true);
    try {
      const res = await fetch('/api/client-acquisition/automation/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: refine.trim(), current: auto, brief: brief ?? undefined }) });
      const j = await res.json() as { automation?: unknown; notice?: string; error?: string; code?: string };
      if (handleGate(res, j) === true) return;
      const a = res.ok && j.automation ? sanitizeAutomation(j.automation) : null;
      if (!a) { setNotice(j.error ?? 'Could not apply that change.'); return; }
      const next = { ...a, brief: brief ?? a.brief };
      setAuto(next); setRefine(''); setNotice(j.notice ?? 'Updated.');
      if (campaignId) await fetch(`/api/outreach-campaigns/${campaignId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ automation: next }) });
    } catch { setNotice('Could not apply that change. Check your connection.'); }
    finally { setRefining(false); }
  };

  const addLeads = async () => {
    if (!campaignId || !leads.length) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/outreach-campaigns/${campaignId}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leads }) });
      const j = await res.json().catch(() => ({})) as { added?: number | { added: number }; error?: string };
      if (handleGate(res, j) === true) return;
      if (!res.ok) { setNotice(j.error ?? 'Could not add the leads.'); return; }
      const n = typeof j.added === 'number' ? j.added : j.added?.added ?? leads.length;
      setAdded((x) => x + n); setLeads([]);
      setNotice(`${n} lead${n === 1 ? '' : 's'} added. Open the campaign, send yourself a test, then press Run.`);
    } catch { setNotice('Could not add the leads. Check your connection.'); }
    finally { setAdding(false); }
  };

  const pct = phase === 'done' ? 100 : Math.max(4, Math.round((Math.max(active, 0) / STEP_TITLES.length) * 100));

  if (phase === 'idle' || phase === 'error') {
    return (
      <section className="acq-auto-hero" aria-label="Autopilot campaign setup">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,.16)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Wand2 size={22} /></span>
          <div><h2>Describe what you sell. The agent builds the whole engine.</h2><p>Emails, follow-ups, conditions, what to say to every reply, sending rules and the campaign itself, from one sentence.</p></div>
        </div>
        <div className="acq-auto-box">
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="What do you want to sell, and to whom?" maxLength={1500}
            placeholder="e.g. I want to sell AI agents to dental clinics: visibility, receptionist, follow up and patient reactivation"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void build(prompt); }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="acq-faint" style={{ fontSize: 12 }}>Say what you sell, who to, and anything you care about (tone, number of emails, a daily limit).</span>
            <button className="acq-btn acq-btn-primary" style={{ height: 44 }} disabled={!prompt.trim()} onClick={() => void build(prompt)}><Sparkles size={16} /> Build my campaign</button>
          </div>
        </div>
        <div className="acq-auto-examples">{EXAMPLES.map((x) => <button key={x} onClick={() => setPrompt(x)}>{x}</button>)}</div>
      </section>
    );
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof Mail }> = [
    { id: 'workflow', label: 'Workflow', icon: GitBranch }, { id: 'emails', label: `Emails (${auto?.emails.length ?? 0})`, icon: Mail },
    { id: 'replies', label: 'Reply playbook', icon: MessageSquare }, { id: 'test', label: 'Test & preview', icon: FlaskConical }, { id: 'leads', label: 'Import leads', icon: Upload },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 14 }} aria-live="polite">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--brand-soft)', color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{phase === 'building' ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} strokeWidth={3} />}</span>
            <div>
              <h2 className="acq-title" style={{ fontSize: 17 }}>{phase === 'building' ? 'Building your client acquisition engine…' : auto?.name ?? 'Your campaign'}</h2>
              <p className="acq-sub" style={{ fontSize: 12.5 }}>{phase === 'building' ? STEP_TITLES[Math.min(Math.max(active, 0), STEP_TITLES.length - 1)] : `Built ${source === 'ai' ? 'by AI' : 'by the built-in planner'} from: "${prompt.trim().slice(0, 90)}${prompt.trim().length > 90 ? '…' : ''}"`}</p>
            </div>
          </div>
          {phase === 'done' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="acq-btn" onClick={() => { setPhase('idle'); setAuto(null); }}><Sparkles size={15} /> New prompt</button>
              {auto && brief && <button className="acq-btn" onClick={() => onManual(auto, brief, campaignId)}><Pencil size={15} /> Edit manually</button>}
              {campaignId
                ? <Link href={`/client-acquisition/campaigns/${campaignId}`} className="acq-btn acq-btn-primary">Open campaign <ArrowRight size={15} /></Link>
                : <button className="acq-btn acq-btn-primary" onClick={() => void saveAgain()}><Rocket size={15} /> Save campaign</button>}
            </div>
          )}
        </div>
        <div className="acq-build-bar" aria-label={`${pct}% done`}><i style={{ width: `${pct}%` }} /></div>
        {phase === 'done' && <button className="acq-link" style={{ justifySelf: 'start' }} onClick={() => setShowSteps((v) => !v)}><Check size={13} /> All {STEP_TITLES.length} build steps complete · {showSteps ? 'Hide' : 'Show'} what was built</button>}
        <ol className="acq-build" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {steps.map((s, i) => {
            const state = i < active ? 'done' : i === active ? 'active' : 'pending';
            if (phase === 'done' && !showSteps) return null;
            return (
              <li key={s.title} className={`acq-build-step ${state}`}>
                <span className="acq-build-dot">{state === 'done' ? <Check size={14} strokeWidth={3} /> : state === 'active' ? <Loader2 size={14} className="animate-spin" /> : i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <b>{s.title}</b>
                  {s.items.length > 0 && <div className="acq-build-items">{s.items.map((t, k) => <span key={k} style={{ ['--i' as string]: 0 }}><Check size={12} style={{ color: 'var(--green)', flex: 'none' }} />{t}</span>)}</div>}
                </div>
              </li>
            );
          })}
        </ol>
        {notice && <p className="acq-notice" role="status" style={{ fontSize: 13 }}>{notice}</p>}
      </section>

      {auto && active >= 3 && (
        <>
          {phase === 'done' && (
            <div className="acq-ptabs" role="tablist">
              {tabs.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}><t.icon size={15} />{t.label}{t.id === 'leads' && added ? ` · ${added} added` : ''}</button>)}
            </div>
          )}

          {(tab === 'workflow' || phase !== 'done') && <WorkflowCanvas key={phase} auto={auto} onSelect={() => setTab('test')} />}

          {phase === 'done' && tab === 'emails' && (
            <div style={{ display: 'grid', gap: 10 }}>
              {auto.emails.map((e, i) => (
                <details key={i} className="acq-card" open={i === 0} style={{ padding: '12px 16px' }}>
                  <summary style={{ cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="acq-pill acq-pill-purple">Day {dayNumbers(auto)[i]}</span><b style={{ fontSize: 14 }}>{e.subject}</b>
                    {i > 0 && <span className="acq-faint" style={{ fontSize: 12 }}>· if {SEND_IF_LABEL[e.sendIf].toLowerCase()}</span>}
                    {e.openedVariant && <span className="acq-pill" style={{ background: '#e0f2fe', color: '#0369a1' }}>+ opened version</span>}
                  </summary>
                  <pre style={{ whiteSpace: 'pre-wrap', font: 'inherit', fontSize: 13.5, lineHeight: 1.6, margin: '12px 0 0' }}>{e.body}</pre>
                  {e.openedVariant && (
                    <div style={{ marginTop: 12, borderTop: '1px dashed var(--line)', paddingTop: 12 }}>
                      <b style={{ fontSize: 12.5, color: '#0369a1' }}>If they opened but did not reply: {e.openedVariant.subject}</b>
                      <pre style={{ whiteSpace: 'pre-wrap', font: 'inherit', fontSize: 13.5, lineHeight: 1.6, margin: '8px 0 0' }}>{e.openedVariant.body}</pre>
                    </div>
                  )}
                </details>
              ))}
            </div>
          )}

          {phase === 'done' && tab === 'replies' && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(auto.playbook ?? []).map((p) => (
                <section key={p.replyClass} className="acq-card acq-card-pad" style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
                  <b style={{ fontSize: 14 }}>{PLAY_LABEL[p.replyClass]}</b>
                  <span className="acq-pill acq-pill-purple" style={{ justifySelf: 'start', whiteSpace: 'normal', height: 'auto', padding: '3px 10px' }}>{ACTION_LABEL[PLAY_ACTION[p.replyClass]]}</span>
                  {p.response ? <pre style={{ whiteSpace: 'pre-wrap', font: 'inherit', fontSize: 13, lineHeight: 1.55, margin: 0, color: 'var(--ink-2)' }}>{p.response}</pre> : <p className="acq-faint" style={{ fontSize: 12.5 }}>No answer is sent.</p>}
                </section>
              ))}
            </div>
          )}

          {phase === 'done' && tab === 'test' && <CampaignTest auto={auto} campaignId={campaignId} />}

          {phase === 'done' && tab === 'leads' && (
            <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 12 }}>
              <h3 className="acq-title">Import leads into this campaign</h3>
              {!campaignId && <p className="acq-notice">Save the campaign first, then add leads.</p>}
              <LeadPicker leads={leads} onChange={setLeads} />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="acq-btn acq-btn-primary" disabled={!campaignId || !leads.length || adding} onClick={() => void addLeads()}>{adding ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Add {leads.length || ''} lead{leads.length === 1 ? '' : 's'} to the campaign</button>
                <Link href="/client-acquisition/find" className="acq-btn"><Search size={15} /> Find prospects first</Link>
                {added > 0 && campaignId && <Link href={`/client-acquisition/campaigns/${campaignId}`} className="acq-btn acq-btn-green">Review and run <ArrowRight size={15} /></Link>}
              </div>
              <p className="acq-faint" style={{ fontSize: 12 }}>Anyone who has unsubscribed from your campaigns before is skipped automatically. Nothing is sent until you press Run on the campaign.</p>
            </section>
          )}

          {phase === 'done' && (
            <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 8 }}>
              <b style={{ fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}><Sparkles size={15} style={{ color: 'var(--brand)' }} /> Change anything in plain English</b>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="acq-input" value={refine} onChange={(e) => setRefine(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !refining) void doRefine(); }} placeholder='e.g. "make it more formal", "wait 4 days between emails", "only follow up if they opened"' aria-label="Change the campaign" />
                <button className="acq-btn acq-btn-primary" disabled={!refine.trim() || refining} onClick={() => void doRefine()} aria-label="Apply change">{refining ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}</button>
              </div>
              <ul className="acq-faint" style={{ fontSize: 12, margin: 0, paddingLeft: 18 }}>{summarize(auto).map((l) => <li key={l}>{l}</li>)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
