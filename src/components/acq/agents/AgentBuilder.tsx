'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, Briefcase, CalendarCheck, ChartColumn, Check, Clock, Filter, Headset, LifeBuoy, Loader2, Mail, Newspaper, Package, Pencil, Receipt, Repeat, Share2, ShoppingBag, Sparkles, Star, UserPlus, WandSparkles } from 'lucide-react';
import { configIssues, sanitizeConfig, type AgentConfig, type AgentKind, type AssistantConfig } from '@/lib/agents/kinds';
import { CATEGORIES, TEMPLATES, type Category, type TemplateId } from '@/lib/agents/templates';
import AgentForm from './AgentForm';
import AgentPreview from './AgentPreview';

const STEPS: Record<AgentKind | 'any', string[]> = {
  any: ['Reading your request', 'Working out the right agent', 'Reading your website', 'Writing its role and instructions', 'Choosing its skills', 'Final checks'],
  visibility: ['Reading your website', 'Understanding your business', 'Choosing what to write about', 'Setting the schedule', 'Final checks'],
  assistant: ['Reading your website', 'Understanding the job', 'Writing its role and instructions', 'Listing the knowledge it needs', 'Choosing its skills and escalation rules', 'Final checks'],
};
const ICON: Record<TemplateId, typeof Newspaper> = {
  receptionist: Headset, sales: Briefcase, qualify: Filter, support: LifeBuoy, appointment: CalendarCheck, shopping: ShoppingBag, orders: Package, internal: BookOpen,
  custom: WandSparkles, visibility: Newspaper, followup: Repeat, reactivation: UserPlus, emailMarketing: Mail, social: Share2, invoice: Receipt, reporting: ChartColumn, reviews: Star,
};
const EXAMPLES = [
  TEMPLATES.receptionist.example,
  'We sell payroll software to SMEs. Greet website visitors, ask company size and current tool, and book a demo with warm leads.',
  TEMPLATES.visibility.example,
];
const ALL = Object.keys(TEMPLATES) as TemplateId[];
const FEATURED = ALL.filter((t) => TEMPLATES[t].featured);
const BADGE: Record<string, [string, string, string]> = { campaign: ['Uses a campaign', '#f3e8ff', '#6b21a8'], soon: ['Coming soon', '#f1f5f9', '#475569'] };

function TemplateCard({ id, onPick }: { id: TemplateId; onPick: (id: TemplateId) => void }) {
  const t = TEMPLATES[id]; const I = ICON[id]; const soon = t.status === 'soon'; const badge = BADGE[t.status];
  return (
    <button type="button" disabled={soon} aria-disabled={soon} onClick={() => onPick(id)} style={{ textAlign: 'left', cursor: soon ? 'not-allowed' : 'pointer', display: 'grid', gap: 4, border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, background: soon ? '#f8fafc' : '#fff', opacity: soon ? 0.7 : 1 }}>
      <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="acq-stat-icon" style={{ background: '#f3e8ff', color: '#7e22ce' }}><I size={18} /></span><b>{t.label}</b>
        {badge && <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 999, background: badge[1], color: badge[2] }}>{badge[0]}</span>}
      </span>
      <span style={{ fontWeight: 600, color: '#334155', fontSize: 13.5 }}>{t.tagline}</span>
    </button>
  );
}

/** Build an agent: pick a template (or describe anything in plain English), RUNVAX writes the job, knowledge list, skills and escalation rules, then the owner reviews, tests and saves. */
export default function AgentBuilder() {
  const router = useRouter();
  const [tpl, setTpl] = useState<TemplateId | null>(null);
  const [kind, setKind] = useState<AgentKind | null>(null);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [prompt, setPrompt] = useState(''); const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<'ask' | 'building' | 'review'>('ask');
  const [cfg, setCfg] = useState<AgentConfig | null>(null); const [name, setName] = useState('');
  const [note, setNote] = useState(''); const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState<{ reason: string; message: string; link?: string } | null>(null);
  const [more, setMore] = useState(false);
  const [pct, setPct] = useState(0); const done = useRef(false); const detected = useRef<AgentKind | null>(null);

  useEffect(() => {
    if (phase !== 'building') return;
    const id = setInterval(() => setPct((p) => (done.current ? Math.min(100, p + 8) : Math.min(92, p + Math.max(0.4, (92 - p) * 0.07)))), 90);
    return () => clearInterval(id);
  }, [phase]);
  useEffect(() => { if (phase === 'building' && pct >= 100 && detected.current) { const t = setTimeout(() => { setKind(detected.current); setPhase('review'); }, 450); return () => clearTimeout(t); } }, [phase, pct]);

  const pick = (id: TemplateId) => {
    const t = TEMPLATES[id]; setErr(''); setBlocked(null);
    if (t.status === 'campaign') { setBlocked({ reason: 'campaign', message: `${t.label}: ${t.tagline.toLowerCase()}. RUNVAX campaigns already do this: they write the emails, follow up on a schedule and handle replies.`, link: '/client-acquisition/automation' }); return; }
    if (t.status === 'soon' || !t.engine) return;
    setTpl(id); setKind(t.engine); setPrompt(''); setMode('auto');
  };
  const reset = () => { setTpl(null); setKind(null); setBlocked(null); };
  const manual = () => { if (!kind) return; setCfg(sanitizeConfig(kind, kind === 'assistant' ? { ...presetFor(tpl) } : {})); setName(''); setPhase('review'); };
  async function build() {
    setErr(''); setNote(''); setBlocked(null); done.current = false; detected.current = null; setPct(0); setPhase('building');
    try {
      const r = await fetch('/api/client-acquisition/agents/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, template: tpl ?? undefined, prompt, url }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || 'Could not build the agent. Try again.'); setPhase('ask'); return; }
      if (j.supported === false) { setBlocked({ reason: j.reason, message: j.message, link: j.link }); setPhase('ask'); return; }
      setCfg(j.config); setName(j.name); setTpl(j.template ?? null); setNote(j.notice ?? (j.source === 'rules' ? 'Built with the built-in planner. Read it through and adjust anything.' : '')); detected.current = j.kind; done.current = true;
    } catch { setErr('Could not reach RUNVAX. Check your connection and try again.'); setPhase('ask'); }
  }
  async function save() {
    if (!kind || !cfg) return; setSaving(true); setErr('');
    try {
      const r = await fetch('/api/client-acquisition/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, name, config: cfg }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || 'Could not save the agent.'); setSaving(false); return; }
      router.push(`/client-acquisition/agents/${j.agent.id}`);
    } catch { setErr('Could not save. Check your connection.'); setSaving(false); }
  }

  if (phase === 'building') {
    const steps = STEPS[kind ?? 'any']; const p = Math.min(100, Math.round(pct)); const active = Math.min(steps.length - 1, Math.floor((p / 100) * steps.length));
    return (
      <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 14, maxWidth: 860 }} aria-label="Building your agent">
        <h2 className="acq-title">Building your agent…</h2>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}><span className="acq-sub" style={{ fontSize: 13.5 }}>Step {active + 1} of {steps.length}</span><b className="acq-build-pct" aria-hidden="true">{p}%</b></div>
        <div className="acq-build-bar" role="progressbar" aria-label="Building your agent" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p}><i style={{ width: `${p}%` }} /></div>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>{steps.map((s, i) => <li key={s} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, color: i <= active ? '#0f172a' : '#94a3b8' }}>{i < active ? <Check size={15} style={{ color: '#16a34a' }} /> : i === active ? <Loader2 size={15} className="animate-spin" /> : <span style={{ width: 15 }} />}{s}</li>)}</ol>
      </section>
    );
  }

  if (phase === 'review' && kind && cfg) {
    const label = kind === 'assistant' ? TEMPLATES[(cfg as AssistantConfig).template].label : TEMPLATES.visibility.label; const issues = configIssues(kind, cfg);
    return (
      <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 16, maxWidth: 860 }} aria-label="Review your agent">
        <div><button className="acq-link" onClick={() => { setPhase('ask'); }}>← Back</button><h2 className="acq-title" style={{ marginTop: 4 }}>Review your {label}</h2></div>
        {note && <p className="acq-notice" style={{ fontSize: 13.5 }}>{note}</p>}
        <div><label className="acq-label" htmlFor="ab-name">Agent name</label><input id="ab-name" className="acq-input" maxLength={120} value={name} placeholder={label} onChange={(e) => setName(e.target.value)} /></div>
        <AgentForm kind={kind} cfg={cfg} onChange={setCfg} />
        <AgentPreview kind={kind} cfg={cfg} step={kind === 'assistant' ? 6 : undefined} />
        {issues.length > 0 && <p className="acq-faint" style={{ fontSize: 13 }}>To switch it on later: {issues[0]}</p>}
        {err && <p role="alert" style={{ color: '#b91c1c', fontSize: 13.5 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="acq-btn acq-btn-primary" style={{ height: 44 }} disabled={saving} onClick={() => void save()}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save agent</button>
          <span className="acq-faint" style={{ alignSelf: 'center', fontSize: 12.5 }}>It is saved switched off. You switch it on from its page, after choosing where it works.</span>
        </div>
      </section>
    );
  }

  const t = tpl ? TEMPLATES[tpl] : null;
  const others = (Object.keys(CATEGORIES) as Category[]).map((c) => [c, ALL.filter((id) => !TEMPLATES[id].featured && TEMPLATES[id].category === c)] as const).filter(([, l]) => l.length);
  return (
    <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 14, maxWidth: 900 }} aria-label="Agent setup">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          {tpl && <button className="acq-link" onClick={reset}>← All agents</button>}
          <h2 className="acq-title" style={{ marginTop: tpl ? 4 : 0 }}>{t ? t.label : 'What should your agent do?'}</h2>
          {t && <p className="acq-sub" style={{ fontSize: 13.5, marginTop: 2 }}>{t.tagline}</p>}
        </div>
        {tpl && (
          <div className="acq-seg" role="tablist" aria-label="How to build the agent">
            <button role="tab" aria-selected={mode === 'auto'} className={mode === 'auto' ? 'on' : ''} onClick={() => setMode('auto')}><Sparkles size={15} /> Let AI build it</button>
            <button role="tab" aria-selected={mode === 'manual'} className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}><Pencil size={15} /> I will fill it in</button>
          </div>
        )}
      </div>

      {blocked && (
        <div role="alert" className="acq-notice" style={{ display: 'grid', gap: 8, borderColor: blocked.reason === 'campaign' ? '#c4b5fd' : '#fcd34d', background: blocked.reason === 'campaign' ? '#faf5ff' : '#fffbeb' }}>
          <b style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 15 }}><Clock size={16} /> {blocked.reason === 'campaign' ? 'You can do this with a campaign' : 'Not available yet'}</b>
          <span style={{ fontSize: 14 }}>{blocked.message}</span>
          {blocked.link && <Link href={blocked.link} className="acq-btn acq-btn-primary" style={{ justifySelf: 'start' }}>Open the Automation Builder <ArrowRight size={15} /></Link>}
          {blocked.reason !== 'campaign' && <span className="acq-faint" style={{ fontSize: 12.5 }}>We have noted your request. Meanwhile, pick one of the agents below.</span>}
        </div>
      )}

      {!tpl && (
        <div style={{ display: 'grid', gap: 12 }}>
          <b style={{ fontSize: 14 }}>1. Choose what the agent should do</b>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2" role="group" aria-label="Agent templates">{FEATURED.map((id) => <TemplateCard key={id} id={id} onPick={pick} />)}</div>
          <button type="button" className="acq-link" style={{ justifySelf: 'start' }} aria-expanded={more} onClick={() => setMore(!more)}>{more ? 'Hide more agents' : `More agents (${ALL.length - FEATURED.length})`}</button>
          {more && others.map(([c, list]) => (
            <div key={c} style={{ display: 'grid', gap: 8 }}>
              <span className="acq-faint" style={{ fontSize: 12.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{CATEGORIES[c]}</span>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2" role="group" aria-label={CATEGORIES[c]}>{list.map((id) => <TemplateCard key={id} id={id} onPick={pick} />)}</div>
            </div>
          ))}
        </div>
      )}
      {(!tpl || mode === 'auto') ? <>
        {!tpl && <div style={{ borderTop: '1px solid #e2e8f0' }} />}
        <div><label className="acq-label" htmlFor="ab-prompt">{tpl ? '2. Describe your business and the job' : 'Or describe the job in plain English, and RUNVAX picks the right agent'}</label>
          <textarea id="ab-prompt" className="acq-textarea" rows={5} maxLength={1500} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t ? t.example : EXAMPLES[0]} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {(t ? [t.example] : EXAMPLES).map((ex, i) => <button key={i} type="button" className="acq-chip" style={{ fontSize: 12, textAlign: 'left' }} onClick={() => { setPrompt(ex); setBlocked(null); }}>Example {i + 1}</button>)}
          </div>
          <p className="acq-faint" style={{ fontSize: 12.5, marginTop: 6 }}>RUNVAX writes its name, role and instructions, objectives, behaviour, the knowledge it needs, its skills and its escalation rules. You review all of it.</p></div>
        <div><label className="acq-label" htmlFor="ab-url">Your website (optional, RUNVAX reads its front page to understand you better)</label><input id="ab-url" className="acq-input" placeholder="yourcompany.com" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
        {err && <p role="alert" style={{ color: '#b91c1c', fontSize: 13.5 }}>{err}</p>}
        <div><button className="acq-btn acq-btn-primary" style={{ height: 44 }} disabled={prompt.trim().length < 10} onClick={() => void build()}><Sparkles size={16} /> Build my agent</button></div>
      </> : <div><p className="acq-sub" style={{ marginBottom: 12 }}>Start from the {t?.label} preset and set everything yourself.</p><button className="acq-btn acq-btn-primary" onClick={manual}>Continue <ArrowRight size={15} /></button></div>}

    </section>
  );
}

/** The template's starting settings, for "I will fill it in". */
function presetFor(id: TemplateId | null): Record<string, unknown> {
  if (!id) return {};
  const t = TEMPLATES[id];
  return { template: id, skills: t.skills, instructions: t.instructions, objectives: t.objectives, behaviour: t.behaviour, escalation: t.escalation, questions: t.questions, knowledgeNeeded: t.knowledgeNeeded };
}
