'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle, ArrowDown, Bell, Check, Clock, Loader2, Mail, MessageSquare, Plus, Rocket, Send, ShieldCheck, Sparkles, Trash2, Wand2, Zap,
} from 'lucide-react';
import { useHandleAIResponse } from '@/context/UpgradeContext';
import {
  MAX_EMAILS, SCENARIOS, dayNumbers, SEND_IF_LABEL, emptyEmail, engineSupport, ruleBasedRevise, sanitizeAutomation, simulate, summarize, validateAutomation,
  type Automation, type Scenario, type SendIf,
} from '@/lib/automation';
import { OBJECTIVES, briefIsBlank, emptyBrief, sanitizeBrief, type CampaignBrief, type Objective } from '@/lib/campaignBrief';
import { planFromGoal } from '@/lib/campaignBuilder';
import { OFFICIAL_TEMPLATES, type TemplateConfig } from '@/lib/templateLibrary';
import { briefFromTemplate, mergeBrief, planFromTemplate, type Strategy } from '@/lib/templateEngine';
import { GuidedSetup, StrategyPanel } from './GuidedSetup';
import CampaignReview from './CampaignReview';
import { Card } from '../ui';
import LeadPicker from '../LeadPicker';
import type { LeadInput } from '@/lib/outreachCampaign';
import Robot from '../agents/Robot';

interface Msg { id: number; role: 'user' | 'assistant'; text: string; bullets?: string[]; notice?: string; source?: 'ai' | 'rules' }
interface CampaignOpt { id: string; name: string; status: string }

const CHIPS = [
  'Set up 3 emails, follow up after 3 days, stop when they reply',
  'A gentle 2-email nudge, 20 a day',
  'A 5-touch sequence, wait 4 days between emails',
  'Make it more formal',
  'Add a follow-up',
  'Only follow up if they opened',
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const hour12 = (h: number) => `${h % 12 || 12}:00 ${h % 24 < 12 ? 'AM' : 'PM'}`;

const label = { fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, display: 'block' } as const;

export default function AutomationBuilder() {
  const handleGate = useHandleAIResponse();
  const sp = useSearchParams();
  const wantCampaign = sp.get('campaign');
  const wantTemplate = sp.get('template');
  const wantMine = sp.get('mine');
  const [auto, setAuto] = useState<Automation | null>(null);
  const [brief, setBrief] = useState<CampaignBrief>(emptyBrief());
  const [featuresText, setFeaturesText] = useState('');
  const [tpl, setTpl] = useState<TemplateConfig | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [approved, setApproved] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, role: 'assistant', text: 'Tell me about the customers you want to win and what you offer, and I will set up the whole sequence: emails, delays, follow-up rules and reply handling. Or just press the button and I will start with a sensible default.' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(0);
  const [scenario, setScenario] = useState<Scenario>('no_reply');
  const [campaigns, setCampaigns] = useState<CampaignOpt[] | null>(null);
  const [target, setTarget] = useState(wantCampaign ?? '');
  const [saved, setSaved] = useState<Automation | null>(null);
  const [notice, setNotice] = useState('');
  const [applying, setApplying] = useState(false);
  const [contacts, setContacts] = useState<LeadInput[]>([]);
  const [createdId, setCreatedId] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [msgs, busy]);

  // A template chosen in the library: official ones are built in, saved ones are fetched. Saved ones load exactly as saved.
  useEffect(() => {
    let live = true;
    const start = (t: TemplateConfig) => {
      if (!live) return;
      setTpl(t); setApproved(false); setStrategy(null);
      const b = mergeBrief(briefFromTemplate(t), t.savedAutomation?.brief ?? {});
      setBrief(b); setFeaturesText(b.features.join('\n'));
      if (t.savedAutomation) { setAuto(t.savedAutomation); push({ role: 'assistant', text: `I loaded your saved template "${t.name}". Check the details below, then edit or regenerate.` }); }
      else push({ role: 'assistant', text: `Using the ${t.name} template. Answer the questions below (leave any blank to use the template's default) and I will build the campaign.` });
    };
    if (wantTemplate) { const t = OFFICIAL_TEMPLATES.find((x) => x.id === wantTemplate); if (t) start(t); }
    else if (wantMine) {
      fetch('/api/client-acquisition/templates').then((r) => (r.ok ? r.json() : null)).then((j: { mine?: TemplateConfig[] } | null) => { const t = j?.mine?.find((x) => x.id === wantMine); if (t) start(t); }).catch(() => {});
    }
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantTemplate, wantMine]);

  // The user's campaigns, so a plan can be applied to one.
  useEffect(() => {
    let live = true;
    fetch('/api/outreach-campaigns').then((r) => (r.ok ? r.json() : Promise.reject())).then((j: { campaigns?: CampaignOpt[] }) => { if (live) setCampaigns(j.campaigns ?? []); }).catch(() => { if (live) setCampaigns([]); });
    return () => { live = false; };
  }, []);

  // A campaign that already has a saved automation can be loaded back into the editor.
  useEffect(() => {
    setSaved(null);
    if (!target) return;
    let live = true;
    fetch(`/api/outreach-campaigns/${target}`).then((r) => (r.ok ? r.json() : null)).then((j: { campaign?: { automation?: unknown } } | null) => {
      const a = j?.campaign?.automation ? sanitizeAutomation(j.campaign.automation) : null;
      if (live && a) { setSaved(a); if (wantCampaign === target && !auto) { setAuto(a); if (a.brief) { setBrief(a.brief); setFeaturesText(a.brief.features.join('\n')); } push({ role: 'assistant', text: 'I loaded the automation saved on this campaign. Tell me what to change, or edit it below.' }); } }
    }).catch(() => {});
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const push = (m: Omit<Msg, 'id'>) => setMsgs((l) => [...l, { ...m, id: idRef.current++ }]);

  const ask = useCallback(async (prompt: string, rebuild = false) => {
    const text = prompt.trim();
    const current = rebuild ? null : auto;
    if (!text && auto && !rebuild) return;
    if (text) push({ role: 'user', text });
    setBusy(true);
    try {
      let plan: { automation: Automation; source: 'ai' | 'rules'; notice?: string } | null = null;
      try {
        const res = await fetch('/api/client-acquisition/automation/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: text, current, brief: briefIsBlank(brief) ? undefined : brief, templateId: tpl?.source === 'official' ? tpl.id : undefined }) });
        const json = await res.json() as { strategy?: Strategy | null; brief?: unknown; automation?: unknown; source?: 'ai' | 'rules'; notice?: string; error?: string; code?: string };
        if (handleGate(res, json) === true) return;
        const a = json.automation ? sanitizeAutomation(json.automation) : null;
        if (res.ok && a) { setStrategy(json.strategy ?? null); setApproved(false); plan = { automation: a, source: json.source ?? 'rules', notice: json.notice }; if (json.brief) { const b = sanitizeBrief(json.brief); setBrief(b); setFeaturesText(b.features.join('\n')); } }
      } catch { /* offline or signed out: the built-in planner below answers */ }
      if (!plan) {
        if (current) { const r = ruleBasedRevise(current, text); plan = { automation: r.automation, source: 'rules', notice: r.changes.length ? `Edited with the built-in planner. ${r.changes.join(' ')}` : 'I could not tell what to change: try "add a follow-up", "wait 5 days" or "make it more formal".' }; }
        else if (tpl && tpl.source === 'official') { const a = planFromTemplate(tpl, brief, text); setBrief(a.brief ?? brief); plan = { automation: a, source: 'rules', notice: 'Sign in with a verified account for AI planning. The template engine set this up.' }; }
        else { const built = planFromGoal(text, briefIsBlank(brief) ? null : brief); setBrief(built.brief); setFeaturesText(built.brief.features.join('\n')); plan = { automation: built.automation, source: 'rules', notice: 'Sign in with a verified account for AI planning. The built-in planner set this up.' }; }
      }
      setAuto(plan.automation);
      setOpen(0);
      push({ role: 'assistant', text: current ? 'Updated.' : 'Here is your campaign, built from your goal.', bullets: summarize(plan.automation), notice: plan.notice, source: plan.source });
    } finally { setBusy(false); }
  }, [auto, brief, tpl, handleGate]);

  const send = () => { const t = input; setInput(''); void ask(t); };

  const issues = useMemo(() => (auto ? validateAutomation(auto) : []), [auto]);
  const support = useMemo(() => (auto ? engineSupport(auto) : []), [auto]);
  const events = useMemo(() => (auto ? simulate(auto, scenario) : []), [auto, scenario]);

  const edit = (patch: Partial<Automation>) => setAuto((a) => (a ? { ...a, ...patch } : a));
  const editEmail = (i: number, patch: Partial<Automation['emails'][number]>) => setAuto((a) => (a ? { ...a, emails: a.emails.map((e, k) => (k === i ? { ...e, ...patch } : e)) } : a));
  const addEmail = () => setAuto((a) => (a && a.emails.length < MAX_EMAILS ? { ...a, emails: [...a.emails, emptyEmail(a.emails.length)] } : a));
  const removeEmail = (i: number) => setAuto((a) => (a && a.emails.length > 1 ? { ...a, emails: a.emails.filter((_, k) => k !== i) } : a));

  const apply = async (mode: 'apply' | 'create') => {
    if (!auto || issues.length) return;
    setApplying(true); setNotice('');
    try {
      const res = await fetch(mode === 'apply' ? `/api/outreach-campaigns/${target}` : '/api/outreach-campaigns', {
        method: mode === 'apply' ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ automation: briefIsBlank(brief) ? auto : { ...auto, brief }, ...(mode === 'create' ? { name: auto.name, leads: contacts } : {}) }),
      });
      const json = await res.json() as { id?: string; added?: { added: number } | null; error?: string; code?: string };
      if (handleGate(res, json) === true) return;
      if (!res.ok) { setNotice(res.status === 401 ? 'Sign in to save an automation to a campaign.' : json.error ?? 'Could not save.'); return; }
      if (mode === 'create' && json.id) { setCreatedId(json.id); setNotice(`Campaign created as a draft${json.added ? ` with ${json.added.added} contact${json.added.added === 1 ? '' : 's'}` : ''}. Open it to personalise the emails, send yourself a test, then press Run.`); setTarget(json.id); setCampaigns((c) => [{ id: json.id!, name: auto.name, status: 'draft' }, ...(c ?? [])]); }
      else {
        if (contacts.length) { await fetch(`/api/outreach-campaigns/${target}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leads: contacts }) }); setContacts([]); }
        setNotice('Saved. The campaign now uses this sequence. What the engine runs today is listed below.');
      }
      setSaved(auto);
    } catch { setNotice('Could not save. Check your connection and try again.'); }
    finally { setApplying(false); }
  };

  const bubble = (m: Msg) => (
    <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
      {m.role === 'assistant' && <span style={{ width: 28, height: 28, borderRadius: 999, background: '#f3e8ff', color: '#9333ea', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Sparkles size={14} /></span>}
      <div style={{ maxWidth: '88%', padding: '10px 14px', borderRadius: 14, fontSize: 13.5, lineHeight: 1.55, background: m.role === 'user' ? '#9333ea' : '#faf5ff', color: m.role === 'user' ? '#fff' : '#1e293b', border: m.role === 'user' ? 0 : '1px solid #f3e8ff' }}>
        <p>{m.text}</p>
        {m.bullets && <ul style={{ margin: '6px 0 0', paddingLeft: 18, display: 'grid', gap: 3 }}>{m.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
        {m.notice && <p style={{ marginTop: 8, fontSize: 12, color: '#7e22ce' }}>{m.notice}</p>}
        {m.source && <p style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>{m.source === 'ai' ? 'Planned by AI' : 'Planned by the built-in planner'}</p>}
      </div>
    </div>
  );

  return (
    <div className="acq-stack">
      <div style={{ position: 'relative', paddingTop: 4, minHeight: 72 }}>
        <div className="acq-only-desktop" style={{ position: 'absolute', right: 0, top: -4, pointerEvents: 'none' }} aria-hidden><div style={{ width: 120, height: 88, overflow: 'hidden' }}><Robot size={120} /></div></div>
        <h1 className="acq-page-title">Campaign Automation Builder</h1>
        <p className="acq-sub" style={{ marginTop: 2, maxWidth: 720 }}>Your AI workforce sets up how you approach and engage your next customers: the emails, the waits, the follow-up rules and what happens when someone replies. Type it or press a button, then review.</p>
      </div>
      {notice && <div className="acq-notice" role="status" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{notice}</span><button className="acq-link" style={{ color: '#64748b' }} onClick={() => setNotice('')}>Dismiss</button></div>}


      {tpl && tpl.source === 'official' && <GuidedSetup tpl={tpl} brief={brief} setBrief={setBrief} featuresText={featuresText} setFeaturesText={setFeaturesText} busy={busy} built={!!auto} contactsCount={contacts.length} onGenerate={() => void ask(input, true)} />}
      {strategy && <StrategyPanel s={strategy} />}
      {!(tpl && tpl.source === 'official') && <section className="acq-card" aria-label="Campaign setup">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <div><h2 className="acq-title" style={{ fontSize: 16.5, fontWeight: 800 }}>Campaign setup</h2><p className="acq-sub" style={{ fontSize: 12.5 }}>Fill in what you can, or just type your goal in the agent box. The agent builds the whole five-email sequence from this.</p></div>
          <button className="acq-btn acq-btn-primary" disabled={busy || (briefIsBlank(brief) && !input.trim())} onClick={() => void ask(input, true)}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} {auto ? 'Rebuild from setup' : 'Build my campaign'}</button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><label style={label} htmlFor="cs-name">Campaign name</label><input id="cs-name" className="acq-input" maxLength={120} value={brief.name} onChange={(e) => setBrief({ ...brief, name: e.target.value })} placeholder="e.g. Dental AI Hub – Clinic Outreach" /></div>
          <div><label style={label} htmlFor="cs-obj">Campaign objective</label><select id="cs-obj" className="acq-select" value={brief.objective} onChange={(e) => setBrief({ ...brief, objective: e.target.value as Objective })}>{OBJECTIVES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
          <div><label style={label} htmlFor="cs-offer">Product or service</label><input id="cs-offer" className="acq-input" maxLength={200} value={brief.offer} onChange={(e) => setBrief({ ...brief, offer: e.target.value })} placeholder="e.g. Dental AI Hub – AI enquiry and appointment assistant" /></div>
          <div><label style={label} htmlFor="cs-aud">Target market</label><input id="cs-aud" className="acq-input" maxLength={200} value={brief.audience} onChange={(e) => setBrief({ ...brief, audience: e.target.value })} placeholder="e.g. Dental clinics in the UK" /></div>
          <div className="md:col-span-2"><label style={label} htmlFor="cs-sum">What it does</label><textarea id="cs-sum" className="acq-textarea" rows={2} maxLength={500} value={brief.offerSummary} onChange={(e) => setBrief({ ...brief, offerSummary: e.target.value })} placeholder="One or two sentences on what it does for the customer." /></div>
          <div><label style={label} htmlFor="cs-feat">What it includes (one per line)</label><textarea id="cs-feat" className="acq-textarea" rows={4} value={featuresText} onChange={(e) => { setFeaturesText(e.target.value); setBrief({ ...brief, features: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 8) }); }} placeholder={'Instant replies to patient enquiries\nAutomated follow-ups\nAppointment booking'} /></div>
          <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
            <div><label style={label} htmlFor="cs-goal">Campaign goal</label><input id="cs-goal" className="acq-input" maxLength={200} value={brief.goal} onChange={(e) => setBrief({ ...brief, goal: e.target.value })} placeholder="e.g. Book 20 demos" /></div>
            <div><label style={label} htmlFor="cs-sign">Sign-off</label><input id="cs-sign" className="acq-input" maxLength={200} value={brief.signOff} onChange={(e) => setBrief({ ...brief, signOff: e.target.value })} placeholder="e.g. Azeez, Harzotech Innovative Solutions" /></div>
          </div>
        </div>
      </section>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,.8fr)_minmax(0,1.6fr)]" style={{ alignItems: 'start' }}>
        {/* the agent */}
        <section className="acq-card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 76 }}>
          <div style={{ padding: '16px 18px', background: 'linear-gradient(135deg, #f3e8ff, #faf5ff)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, background: '#9333ea', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Wand2 size={20} /></span>
            <div><h2 className="acq-title" style={{ fontSize: 16.5, fontWeight: 800 }}>Campaign Setup Agent</h2><p className="acq-sub" style={{ fontSize: 12.5 }}>Describe it in your own words</p></div>
          </div>
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <button className="acq-btn acq-btn-primary" style={{ height: 48 }} disabled={busy} onClick={() => void ask(auto ? 'Start again with a sensible default' : '')}>
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Zap size={17} />} {auto ? 'Start over with a default setup' : 'Set up my campaign automatically'}
            </button>
            <div role="log" aria-live="polite" style={{ display: 'grid', gap: 10, maxHeight: 340, overflowY: 'auto', padding: '2px 2px 2px 0' }}>
              {msgs.map(bubble)}
              {busy && <p className="acq-sub" style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}><Loader2 size={14} className="animate-spin" /> Setting this up…</p>}
              <div ref={endRef} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CHIPS.filter((c) => auto || !/^(Make|Add|Only)/.test(c)).slice(0, 5).map((c) => <button key={c} className="acq-chip" style={{ fontSize: 12, padding: '5px 10px', textAlign: 'left' }} disabled={busy} onClick={() => void ask(c)}>{c}</button>)}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea className="acq-textarea" rows={2} value={input} onChange={(e) => setInput(e.target.value)} aria-label="Tell the setup agent what you want"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && input.trim() && !busy) { e.preventDefault(); send(); } }}
                placeholder={auto ? 'e.g. "make it more formal", "add a follow-up", "wait 5 days"' : 'e.g. "Pitch our AI receptionist to dental clinics with 3 emails, follow up after 4 days"'} />
              <button className="acq-btn acq-btn-primary" style={{ height: 'auto', width: 48, padding: 0 }} disabled={!input.trim() || busy} onClick={send} aria-label="Send"><Send size={17} /></button>
            </div>
            <p className="acq-faint" style={{ fontSize: 11.5, lineHeight: 1.5 }}><ShieldCheck size={12} style={{ display: 'inline', marginRight: 4 }} />The agent can write and arrange emails. It can never switch on automatic sending, add links, or contact anyone: you review everything first.</p>
          </div>
        </section>

        {/* the builder */}
        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          {!auto ? (
            <Card>
              <div style={{ textAlign: 'center', padding: '44px 16px' }}>
                <span style={{ width: 56, height: 56, borderRadius: 16, background: '#f3e8ff', color: '#9333ea', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Mail size={26} /></span>
                <h2 className="acq-title" style={{ fontSize: 18 }}>Your automation will appear here</h2>
                <p className="acq-sub" style={{ maxWidth: 440, margin: '6px auto 0' }}>Press the button, or tell the agent what you want. You can then edit every email, delay and rule by hand.</p>
              </div>
            </Card>
          ) : (
            <>
              <Card>
                <label style={label} htmlFor="auto-name">Automation name</label>
                <input id="auto-name" className="acq-input" style={{ height: 44, fontWeight: 600 }} value={auto.name} maxLength={120} onChange={(e) => edit({ name: e.target.value })} />

                <div style={{ marginTop: 18, display: 'grid', gap: 0 }}>
                  <div className="acq-pill acq-pill-purple" style={{ justifySelf: 'start', gap: 6 }}><Zap size={12} />Starts when you press Run</div>
                  {auto.emails.map((e, i) => (
                    <div key={i}>
                      <div style={{ margin: '8px 0 8px 18px', display: 'grid', gap: 6, justifyItems: 'start' }}>
                        <ArrowDown size={16} style={{ color: '#c084fc' }} />
                        {i > 0 && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: '#faf5ff', border: '1px solid #f3e8ff', borderRadius: 12, padding: '8px 12px' }}>
                            <Clock size={15} style={{ color: '#9333ea' }} />
                            <span style={{ fontSize: 13 }}>Wait</span>
                            <select className="acq-select" aria-label={`Wait before email ${i + 1}`} style={{ width: 92, height: 34, padding: '2px 26px 2px 10px' }} value={e.waitDays} onChange={(ev) => editEmail(i, { waitDays: Number(ev.target.value) })}>{[1, 2, 3, 4, 5, 7, 10, 14, 21, 30].map((d) => <option key={d} value={d}>{d} day{d === 1 ? '' : 's'}</option>)}</select>
                            <span style={{ fontSize: 13 }}>then send if</span>
                            <select className="acq-select" aria-label={`Condition for email ${i + 1}`} style={{ width: 'auto', minWidth: 230, height: 34, padding: '2px 26px 2px 10px' }} value={e.sendIf} onChange={(ev) => editEmail(i, { sendIf: ev.target.value as SendIf })}>{(Object.keys(SEND_IF_LABEL) as SendIf[]).map((k) => <option key={k} value={k}>{SEND_IF_LABEL[k]}</option>)}</select>
                          </div>
                        )}
                      </div>
                      <div style={{ border: `1px solid ${open === i ? '#d8b4fe' : 'var(--line)'}`, borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
                        <button style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', background: open === i ? '#faf5ff' : '#fff', border: 0, textAlign: 'left' }} aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                          <span style={{ width: 32, height: 32, borderRadius: 999, background: '#9333ea', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flex: 'none' }}>{i + 1}</span>
                          <span style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 14 }}><span className="acq-pill acq-pill-purple" style={{ marginRight: 8 }}>Day {dayNumbers(auto)[i]}</span>{i === 0 ? 'Introduction' : i === auto.emails.length - 1 ? 'Final follow-up' : 'Follow-up'}</b><span className="acq-sub" style={{ display: 'block', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.subject}</span></span>
                          {auto.emails.length > 1 && <span role="button" tabIndex={0} aria-label={`Remove email ${i + 1}`} className="acq-icon-btn" onClick={(ev) => { ev.stopPropagation(); removeEmail(i); }} onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.stopPropagation(); removeEmail(i); } }}><Trash2 size={15} /></span>}
                        </button>
                        {open === i && (
                          <div style={{ padding: '4px 14px 14px', display: 'grid', gap: 10 }}>
                            <div><label style={label}>Subject</label><input className="acq-input" value={e.subject} maxLength={190} onChange={(ev) => editEmail(i, { subject: ev.target.value })} aria-label={`Subject of email ${i + 1}`} /></div>
                            <div><label style={label}>Email</label><textarea className="acq-textarea" rows={7} value={e.body} onChange={(ev) => editEmail(i, { body: ev.target.value })} aria-label={`Body of email ${i + 1}`} /></div>
                            <p className="acq-faint" style={{ fontSize: 11.5 }}>Placeholders: {'{{name}}'} (first name), {'{{business}}'}, {'{{website}}'}{i > 0 ? ', {{subject}} (the first email\'s subject)' : ''}. A signature and an unsubscribe link are added automatically.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div style={{ margin: '8px 0 8px 18px' }}><ArrowDown size={16} style={{ color: '#c084fc' }} /></div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="acq-pill acq-pill-green" style={{ gap: 6 }}><Check size={12} strokeWidth={3} />Sequence ends</span>
                    <button className="acq-btn acq-btn-sm" disabled={auto.emails.length >= MAX_EMAILS} onClick={() => { addEmail(); setOpen(auto.emails.length); }}><Plus size={13} /> Add follow-up</button>
                    <span className="acq-faint" style={{ fontSize: 12 }}>{auto.emails.length} of {MAX_EMAILS} emails</span>
                  </div>
                </div>
                {issues.length > 0 && <p role="alert" style={{ marginTop: 14, color: '#b45309', fontSize: 13, background: '#fff8eb', border: '1px solid #fcd9a6', borderRadius: 10, padding: '8px 12px' }}>{issues[0]}</p>}
              </Card>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card title="Replies and stopping">
                  <div style={{ display: 'grid', gap: 14 }}>
                    <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}><input type="checkbox" checked={auto.stopOnReply} onChange={(e) => edit({ stopOnReply: e.target.checked })} style={{ accentColor: '#9333ea', width: 18, height: 18, marginTop: 2 }} /><span><b style={{ fontSize: 14 }}>Stop when someone replies</b><span className="acq-sub" style={{ display: 'block', fontSize: 12.5 }}>Nobody who has answered gets another automatic follow-up.</span></span></label>
                    <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}><input type="checkbox" checked={auto.replyRules.notifyInterested} onChange={(e) => edit({ replyRules: { ...auto.replyRules, notifyInterested: e.target.checked } })} style={{ accentColor: '#9333ea', width: 18, height: 18, marginTop: 2 }} /><span><b style={{ fontSize: 14 }}><Bell size={13} style={{ display: 'inline', marginRight: 5 }} />Tell me straight away when someone is interested</b><span className="acq-sub" style={{ display: 'block', fontSize: 12.5 }}>They move to your Inbox as a hot lead.</span></span></label>
                    <div><b style={{ fontSize: 14 }}><MessageSquare size={13} style={{ display: 'inline', marginRight: 5 }} />Out-of-office replies</b>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, fontSize: 13 }}>Pause for <select className="acq-select" aria-label="Out-of-office pause" style={{ width: 92, height: 34, padding: '2px 26px 2px 10px' }} value={auto.replyRules.outOfOfficePauseDays} onChange={(e) => edit({ replyRules: { ...auto.replyRules, outOfOfficePauseDays: Number(e.target.value) } })}>{[2, 3, 5, 7, 10, 14].map((d) => <option key={d} value={d}>{d} days</option>)}</select>then carry on</div></div>
                    <p className="acq-faint" style={{ fontSize: 12 }}><ShieldCheck size={12} style={{ display: 'inline', marginRight: 4 }} />Unsubscribes and bounced addresses always stop the sequence. This is not optional.</p>
                  </div>
                </Card>
                <Card title="Sending">
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div><span style={label}>Before follow-ups go out</span>
                      <div style={{ display: 'grid', gap: 8 }}>
                        <label className="acq-opt selected" style={{ padding: '10px 12px', cursor: 'default' }}><span style={{ fontSize: 13.5 }}><b>Review first</b> (on)<span className="acq-sub" style={{ display: 'block', fontSize: 12 }}>Follow-ups wait for your click.</span></span></label>
                        <label className="acq-opt" style={{ padding: '10px 12px', opacity: .55, cursor: 'not-allowed' }}><span style={{ fontSize: 13.5 }}><b>Send automatically</b> (not available yet)<span className="acq-sub" style={{ display: 'block', fontSize: 12 }}>Switched off while reply detection and a legal review are pending.</span></span></label>
                      </div>
                    </div>
                    <div><label style={label} htmlFor="auto-cap">Send at most per day</label><input id="auto-cap" type="number" min={1} max={200} className="acq-input" style={{ width: 110 }} value={auto.dailyCap} onChange={(e) => edit({ dailyCap: Math.max(1, Math.min(200, Number(e.target.value) || 1)) })} /></div>
                    <div><span style={label}>Sending window</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select className="acq-select" aria-label="Window start" style={{ width: 118, height: 36, padding: '2px 26px 2px 10px' }} value={auto.windowStart} onChange={(e) => edit({ windowStart: Math.min(Number(e.target.value), auto.windowEnd - 1) })}>{HOURS.slice(0, 23).map((h) => <option key={h} value={h}>{hour12(h)}</option>)}</select>to
                        <select className="acq-select" aria-label="Window end" style={{ width: 118, height: 36, padding: '2px 26px 2px 10px' }} value={auto.windowEnd} onChange={(e) => edit({ windowEnd: Math.max(Number(e.target.value), auto.windowStart + 1) })}>{HOURS.slice(1).concat(24).map((h) => <option key={h} value={h}>{hour12(h)}</option>)}</select></div>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={auto.weekdaysOnly} onChange={(e) => edit({ weekdaysOnly: e.target.checked })} style={{ accentColor: '#9333ea' }} />Weekdays only</label></div>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card title="Test it before you run it">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {SCENARIOS.map((s) => <button key={s.id} className={`acq-chip${scenario === s.id ? ' on' : ''}`} style={{ fontSize: 12, padding: '5px 10px' }} aria-pressed={scenario === s.id} title={s.desc} onClick={() => setScenario(s.id)}>{s.label}</button>)}
                  </div>
                  <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
                    {events.map((ev, i) => (
                      <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5 }}>
                        <span className="acq-pill" style={{ flex: 'none', minWidth: 58, background: ev.kind === 'send' ? '#f3e8ff' : ev.kind === 'stop' ? '#fee2e2' : ev.kind === 'done' ? '#dcfce7' : '#f1f5f9', color: ev.kind === 'send' ? '#7e22ce' : ev.kind === 'stop' ? '#b91c1c' : ev.kind === 'done' ? '#15803d' : '#475569' }}>Day {ev.day}</span>
                        <span style={{ paddingTop: 3 }}>{ev.text}</span>
                      </li>
                    ))}
                  </ol>
                </Card>
                <Card title="What runs today">
                  <div style={{ display: 'grid', gap: 10 }}>
                    {support.map((n) => (
                      <p key={n.text} style={{ display: 'flex', gap: 10, fontSize: 13, lineHeight: 1.5, color: '#334155' }}>
                        <span style={{ flex: 'none', width: 20, height: 20, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: n.level === 'ok' ? '#dcfce7' : '#fef3c7', color: n.level === 'ok' ? '#15803d' : '#b45309', marginTop: 1 }}>{n.level === 'ok' ? <Check size={12} strokeWidth={3} /> : <AlertTriangle size={11} />}</span>{n.text}
                      </p>
                    ))}
                  </div>
                </Card>
              </div>

              <Card title="Who should get it?">
                <LeadPicker leads={contacts} onChange={setContacts} />
                <p className="acq-faint" style={{ fontSize: 12, marginTop: 10 }}>Upload a CSV or paste addresses. Anyone who has unsubscribed from your campaigns before is skipped automatically.</p>
              </Card>

              {tpl && <CampaignReview tpl={tpl} auto={briefIsBlank(brief) ? auto : { ...auto, brief }} contactsCount={contacts.length} approved={approved} setApproved={setApproved} />}

              <Card title="Use this automation">
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select className="acq-select" aria-label="Campaign to apply to" style={{ width: 'auto', minWidth: 260, height: 44 }} value={target} onChange={(e) => setTarget(e.target.value)}>
                      <option value="">Choose a campaign…</option>
                      {(campaigns ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.status})</option>)}
                    </select>
                    <button className="acq-btn" style={{ height: 44 }} disabled={!target || issues.length > 0 || applying || (!!tpl && !approved)} onClick={() => void apply('apply')}>{applying ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Apply to this campaign</button>
                    <span className="acq-sub" style={{ fontSize: 13 }}>or</span>
                    <button className="acq-btn acq-btn-primary" style={{ height: 44 }} disabled={issues.length > 0 || applying || (!!tpl && !approved)} onClick={() => void apply('create')}><Rocket size={16} /> Create campaign{contacts.length ? ` with ${contacts.length} contact${contacts.length === 1 ? '' : 's'}` : ''}</button>
                  </div>
                  {tpl && !approved && <p className="acq-faint" style={{ fontSize: 12.5 }}>Tick the approval box above to create or apply this campaign.</p>}
                  {saved && JSON.stringify(saved) !== JSON.stringify(auto) && <p style={{ fontSize: 12.5, color: '#7e22ce' }}>This campaign has a saved automation. <button className="acq-link" onClick={() => setAuto(saved)}>Load the saved version</button></p>}
                  {createdId && <p style={{ fontSize: 13.5 }}><Link href={`/client-acquisition/campaigns/${createdId}`} className="acq-btn acq-btn-green" style={{ marginTop: 4 }}>Open the new campaign →</Link></p>}
                  {target && <p className="acq-sub" style={{ fontSize: 12.5 }}>Applying replaces the campaign&apos;s email wording and follow-up settings. Emails already sent are not affected. <Link href={`/client-acquisition/campaigns/${target}`} style={{ color: '#9333ea', fontWeight: 600 }}>Open the campaign</Link></p>}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
