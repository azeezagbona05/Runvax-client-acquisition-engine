'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Loader2, MessageCircle, Newspaper, Pencil, Sparkles } from 'lucide-react';
import { AGENT_KINDS, configIssues, sanitizeConfig, type AgentConfig, type AgentKind } from '@/lib/agents/kinds';
import AgentForm from './AgentForm';

const STEPS: Record<AgentKind, string[]> = {
  visibility: ['Reading your website', 'Understanding your business', 'Choosing what to write about', 'Setting the schedule', 'Final checks'],
  assistant: ['Reading your website', 'Understanding your business', 'Writing what it knows', 'Choosing the qualifying questions', 'Final checks'],
};
const ICON: Record<AgentKind, typeof Newspaper> = { visibility: Newspaper, assistant: MessageCircle };

/** Build an agent: pick the kind, then describe it in plain English (AI) or fill it in yourself. Same shape as the campaign builder. */
export default function AgentBuilder() {
  const router = useRouter();
  const [kind, setKind] = useState<AgentKind | null>(null);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [prompt, setPrompt] = useState(''); const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<'ask' | 'building' | 'review'>('ask');
  const [cfg, setCfg] = useState<AgentConfig | null>(null); const [name, setName] = useState('');
  const [note, setNote] = useState(''); const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);
  const [pct, setPct] = useState(0); const done = useRef(false);

  useEffect(() => {
    if (phase !== 'building') return;
    const id = setInterval(() => setPct((p) => (done.current ? Math.min(100, p + 8) : Math.min(92, p + Math.max(0.4, (92 - p) * 0.07)))), 90);
    return () => clearInterval(id);
  }, [phase]);
  useEffect(() => { if (phase === 'building' && pct >= 100) { const t = setTimeout(() => setPhase('review'), 450); return () => clearTimeout(t); } }, [phase, pct]);

  const manual = (k: AgentKind) => { setCfg(sanitizeConfig(k, {})); setName(''); setPhase('review'); };
  async function build() {
    if (!kind) return; setErr(''); setNote(''); done.current = false; setPct(0); setPhase('building');
    try {
      const r = await fetch('/api/client-acquisition/agents/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, prompt, url }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || 'Could not build the agent. Try again.'); setPhase('ask'); return; }
      setCfg(j.config); setName(j.name); setNote(j.notice ?? (j.source === 'rules' ? 'Built with the built-in planner. Read it through and adjust anything.' : '')); done.current = true;
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

  if (!kind) return (
    <div style={{ display: 'grid', gap: 14 }}>
      <h2 className="acq-title">What should your agent do?</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2" role="group" aria-label="Agent kinds">
        {(Object.keys(AGENT_KINDS) as AgentKind[]).map((k) => { const I = ICON[k]; const m = AGENT_KINDS[k]; return (
          <button key={k} type="button" className="acq-card acq-card-pad" style={{ textAlign: 'left', cursor: 'pointer', display: 'grid', gap: 8 }} onClick={() => { setKind(k); setPrompt(''); }}>
            <span className="acq-stat-icon" style={{ background: '#f3e8ff', color: '#7e22ce' }}><I size={22} /></span>
            <b style={{ fontSize: 17 }}>{m.label}</b><span style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>{m.tagline}</span>
            <span className="acq-sub" style={{ fontSize: 13.5 }}>{m.does}</span>
            <span className="acq-faint" style={{ fontSize: 12.5 }}>Works on: {m.where.join(' · ')}</span>
          </button>); })}
      </div>
      <p className="acq-faint" style={{ fontSize: 12.5 }}>More agents (follow-up, lead research, reply handling) will appear here as templates.</p>
    </div>
  );

  const m = AGENT_KINDS[kind];
  if (phase === 'ask') return (
    <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 14, maxWidth: 860 }} aria-label="Agent setup">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div><button className="acq-link" onClick={() => setKind(null)}>← All agents</button><h2 className="acq-title" style={{ marginTop: 4 }}>{m.label}</h2></div>
        <div className="acq-seg" role="tablist" aria-label="How to build the agent">
          <button role="tab" aria-selected={mode === 'auto'} className={mode === 'auto' ? 'on' : ''} onClick={() => setMode('auto')}><Sparkles size={15} /> Let AI build it</button>
          <button role="tab" aria-selected={mode === 'manual'} className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}><Pencil size={15} /> I will fill it in</button>
        </div>
      </div>
      {mode === 'auto' ? <>
        <div><label className="acq-label" htmlFor="ab-prompt">Describe your business and what you want this agent to do</label>
          <textarea id="ab-prompt" className="acq-textarea" rows={5} maxLength={1500} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={m.example} />
          <button className="acq-link" type="button" onClick={() => setPrompt(m.example)}>Use an example</button></div>
        <div><label className="acq-label" htmlFor="ab-url">Your website (optional, RUNVAX reads its front page to understand you better)</label><input id="ab-url" className="acq-input" placeholder="yourcompany.com" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
        {err && <p role="alert" style={{ color: '#b91c1c', fontSize: 13.5 }}>{err}</p>}
        <div><button className="acq-btn acq-btn-primary" style={{ height: 44 }} disabled={prompt.trim().length < 10} onClick={() => void build()}><Sparkles size={16} /> Build my agent</button></div>
      </> : <div><p className="acq-sub" style={{ marginBottom: 12 }}>Start from a blank form and set everything yourself.</p><button className="acq-btn acq-btn-primary" onClick={() => manual(kind)}>Continue <ArrowRight size={15} /></button></div>}
    </section>
  );

  if (phase === 'building') {
    const p = Math.min(100, Math.round(pct)); const active = Math.min(STEPS[kind].length - 1, Math.floor((p / 100) * STEPS[kind].length));
    return (
      <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 14, maxWidth: 860 }} aria-label="Building your agent">
        <h2 className="acq-title">Building your {m.label}…</h2>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}><span className="acq-sub" style={{ fontSize: 13.5 }}>Step {active + 1} of {STEPS[kind].length}</span><b className="acq-build-pct" aria-hidden="true">{p}%</b></div>
        <div className="acq-build-bar" role="progressbar" aria-label="Building your agent" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p}><i style={{ width: `${p}%` }} /></div>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>{STEPS[kind].map((s, i) => <li key={s} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, color: i <= active ? '#0f172a' : '#94a3b8' }}>{i < active ? <Check size={15} style={{ color: '#16a34a' }} /> : i === active ? <Loader2 size={15} className="animate-spin" /> : <span style={{ width: 15 }} />}{s}</li>)}</ol>
      </section>
    );
  }

  const issues = cfg ? configIssues(kind, cfg) : [];
  return (
    <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 16, maxWidth: 860 }} aria-label="Review your agent">
      <div><button className="acq-link" onClick={() => setPhase('ask')}>← Back</button><h2 className="acq-title" style={{ marginTop: 4 }}>Review your {m.label}</h2></div>
      {note && <p className="acq-notice" style={{ fontSize: 13.5 }}>{note}</p>}
      <div><label className="acq-label" htmlFor="ab-name">Agent name</label><input id="ab-name" className="acq-input" maxLength={120} value={name} placeholder={m.label} onChange={(e) => setName(e.target.value)} /></div>
      {cfg && <AgentForm kind={kind} cfg={cfg} onChange={setCfg} />}
      {issues.length > 0 && <p className="acq-faint" style={{ fontSize: 13 }}>To switch it on later: {issues[0]}</p>}
      {err && <p role="alert" style={{ color: '#b91c1c', fontSize: 13.5 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="acq-btn acq-btn-primary" style={{ height: 44 }} disabled={saving} onClick={() => void save()}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save agent</button>
        <span className="acq-faint" style={{ alignSelf: 'center', fontSize: 12.5 }}>It is saved switched off. You switch it on from its page, after choosing where it works.</span>
      </div>
    </section>
  );
}
