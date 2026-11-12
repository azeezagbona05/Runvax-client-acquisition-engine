'use client';

import { useState, type ReactNode } from 'react';
import { Check, Loader2, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import type { CareerProfileData } from '@/lib/career/types';
import { api, box, fromLines, hint, json, lines } from './shared';
import { More } from './ui';

type Role = CareerProfileData['experience'][number];
const small = { border: 0, background: 'transparent', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 4px' } as const;

type Ctx = { b: CareerProfileData | null; aiKeys: string[]; working: string | null; busy: boolean; rewrite: (key: string, kind: 'summary' | 'headline' | 'bullets', text: string, apply: (t: string) => void) => void; forget: (k: string) => void };

/** Buttons that sit next to a field: AI rewrite (optional) and back to the CV version (only when it differs). Module-level so inputs never remount while typing. */
function Tools({ ctx, k, kind, text, apply, original, revert }: { ctx: Ctx; k: string; kind?: 'summary' | 'headline' | 'bullets'; text: string; apply: (t: string) => void; original?: string; revert: () => void }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {ctx.aiKeys.includes(k) && <span style={{ fontSize: 11.5, color: '#6b21a8', background: '#f3e8ff', borderRadius: 999, padding: '1px 8px', fontWeight: 600 }}>Rewritten by AI</span>}
      {kind && <button type="button" style={{ ...small, color: '#6b21a8' }} disabled={ctx.busy || ctx.working !== null} onClick={() => ctx.rewrite(k, kind, text, apply)}>{ctx.working === k ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Rewrite with AI</button>}
      {ctx.b && original !== undefined && original !== text && <button type="button" style={{ ...small, color: '#475569' }} onClick={() => { revert(); ctx.forget(k); }}><RotateCcw size={13} /> Back to my CV</button>}
    </span>
  );
}
function Row({ label, tools, children, k, msg }: { label: string; tools?: ReactNode; children: ReactNode; k?: string; msg: Record<string, string> }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>{label}</span>{tools}</div>
      {children}{k && msg[k] && <div role="status" style={{ fontSize: 12.5, color: '#92400e' }}>{msg[k]}</div>}
    </div>
  );
}

/** The candidate reviews what was read from the CV. What was read is never silently changed: edits and AI rewrites are the candidate's, and every field can go back to the CV version. */
export default function ProfileReview({ profile, baseline, source, confirmed, removed, busy, onSave, onRevertAll }: {
  profile: CareerProfileData; baseline: CareerProfileData | null; source: string | null; confirmed: boolean; removed: string[]; busy: boolean;
  onSave: (p: CareerProfileData, confirm: boolean) => void; onRevertAll: () => void;
}) {
  const [p, setP] = useState<CareerProfileData>(profile); const [dirty, setDirty] = useState(false); const [skillsText, setSkillsText] = useState(profile.skills.join(', '));
  const [working, setWorking] = useState<string | null>(null); const [msg, setMsg] = useState<Record<string, string>>({}); const [aiKeys, setAiKeys] = useState<string[]>([]);
  const set = (patch: Partial<CareerProfileData>) => { setP({ ...p, ...patch }); setDirty(true); };
  const role = (i: number, patch: Partial<Role>) => set({ experience: p.experience.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const edu = (i: number, patch: Partial<CareerProfileData['education'][number]>) => set({ education: p.education.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const empty = !p.experience.length && !p.education.length && !p.skills.length;
  const b = baseline;
  const note = (k: string, v: string) => setMsg((m) => ({ ...m, [k]: v }));
  const forget = (k: string) => { setAiKeys((x) => x.filter((y) => y !== k)); note(k, ''); };

  /** Wording-only rewrite of one field. The server discards it if it adds anything that is not in the CV. */
  async function rewrite(key: string, kind: 'summary' | 'headline' | 'bullets', text: string, apply: (t: string) => void) {
    setWorking(key); note(key, '');
    const r = await api<{ text: string }>('/api/career/rewrite', json('POST', { kind, text })); setWorking(null);
    if (r.error) return note(key, r.error);
    apply(r.text); setAiKeys((k) => (k.includes(key) ? k : [...k, key]));
  }

  const ctx: Ctx = { b, aiKeys, working, busy, rewrite, forget };
  const HINT = { name: 'e.g. Ada Obi', email: 'e.g. ada@example.com', phone: 'e.g. +234 801 234 5678', location: 'e.g. Lagos, Nigeria' } as const;
  const text = (k: 'name' | 'email' | 'phone' | 'location', label: string) => (
    <Row msg={msg} label={label} tools={<Tools ctx={ctx} k={k} text={p[k]} original={b?.[k]} apply={(t) => set({ [k]: t })} revert={() => set({ [k]: b![k] })} />}>
      <input className="acq-input" placeholder={HINT[k]} value={p[k]} onChange={(e) => set({ [k]: e.target.value })} />
    </Row>
  );

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="acq-notice" role="note" style={{ fontSize: 13 }}>
        <b>This is what was read from your CV.</b> It is only changed when you change it, and every field can go back to the CV version. The agent writes CVs, letters and answers only from what you confirm here.
        {source === 'rules' && ' The basic reader was used, so check each section.'}
        {empty && ' Nothing could be read automatically, so please fill in what you want the agent to use.'}
      </div>
      {removed.length > 0 && <div style={{ ...box, background: '#fffbeb', borderColor: '#fde68a', fontSize: 12.5 }}><b>{removed.length} item(s) were left out</b> because they could not be found in your CV:<ul style={{ margin: '6px 0 0 18px' }}>{removed.slice(0, 6).map((r) => <li key={r}>{r}</li>)}</ul></div>}
      {b && <div><button type="button" className="acq-btn acq-btn-sm" disabled={busy} onClick={() => { if (window.confirm('Go back to exactly what was read from your CV? Your edits and rewrites will be removed.')) onRevertAll(); }}><RotateCcw size={13} /> Go back to the whole CV version</button></div>}

      <More summary="Contact details" open>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>{text('name', 'Full name')}{text('email', 'Email')}{text('phone', 'Phone')}{text('location', 'Location')}</div>
      </More>

      <More summary="Headline and summary" open>
        <Row msg={msg} k="headline" label="Headline" tools={<Tools ctx={ctx} k="headline" kind="headline" text={p.headline} original={b?.headline} apply={(t) => set({ headline: t })} revert={() => set({ headline: b!.headline })} />}>
          <input className="acq-input" value={p.headline} placeholder="e.g. Frontend Developer" onChange={(e) => set({ headline: e.target.value })} />
        </Row>
        <Row msg={msg} k="summary" label="Summary" tools={<Tools ctx={ctx} k="summary" kind="summary" text={p.summary} original={b?.summary} apply={(t) => set({ summary: t })} revert={() => set({ summary: b!.summary })} />}>
          <textarea className="acq-input" rows={4} placeholder="Two or three sentences on who you are professionally and what you do best" value={p.summary} onChange={(e) => set({ summary: e.target.value })} />
        </Row>
      </More>

      <More summary={`Experience (${p.experience.length})`} open={p.experience.length > 0}>
        {b && JSON.stringify(b.experience) !== JSON.stringify(p.experience) && <div><button type="button" style={{ ...small, color: '#475569' }} onClick={() => set({ experience: b.experience })}><RotateCcw size={13} /> Put all roles back to my CV</button></div>}
        {p.experience.map((r, i) => {
          const k = `role${i}`; const orig = b?.experience[i];
          return (
            <details key={i} open={i === 0} style={{ border: '1px solid #e2e8f0', borderRadius: 10 }}>
              <summary style={{ cursor: 'pointer', padding: '10px 12px', fontSize: 14, fontWeight: 600 }}>{[r.title, r.company].filter(Boolean).join(' at ') || 'New role'}<span style={{ ...hint, fontWeight: 400 }}> {[r.start, r.end].filter(Boolean).join(' – ')}</span></summary>
              <div style={{ padding: '4px 12px 12px', display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
                  <input className="acq-input" aria-label="Job title" placeholder="Job title" value={r.title} onChange={(e) => role(i, { title: e.target.value })} />
                  <input className="acq-input" aria-label="Company" placeholder="Company" value={r.company} onChange={(e) => role(i, { company: e.target.value })} />
                  <input className="acq-input" aria-label="Start" placeholder="Start" value={r.start} onChange={(e) => role(i, { start: e.target.value })} />
                  <input className="acq-input" aria-label="End" placeholder="End" value={r.end} onChange={(e) => role(i, { end: e.target.value })} />
                </div>
                <Row msg={msg} k={k} label="What you did (one per line)" tools={<Tools ctx={ctx} k={k} kind="bullets" text={lines(r.bullets)} original={orig ? lines(orig.bullets) : undefined} apply={(t) => role(i, { bullets: t.split('\n').filter(Boolean) })} revert={() => role(i, { bullets: orig!.bullets })} />}>
                  <textarea className="acq-input" rows={4} aria-label="What you did" placeholder="One thing you did per line, e.g. Built a dashboard used by 300 customers" value={lines(r.bullets)} onChange={(e) => role(i, { bullets: e.target.value.split('\n') })} />
                </Row>
                <button type="button" className="acq-btn acq-btn-sm" style={{ justifySelf: 'start' }} onClick={() => set({ experience: p.experience.filter((_, j) => j !== i) })}><Trash2 size={13} /> Remove role</button>
              </div>
            </details>
          );
        })}
        <button type="button" className="acq-btn acq-btn-sm" style={{ justifySelf: 'start' }} onClick={() => set({ experience: [...p.experience, { title: '', company: '', start: '', end: '', location: '', bullets: [] }] })}><Plus size={13} /> Add a role</button>
      </More>

      <More summary={`Education (${p.education.length})`}>
        {b && JSON.stringify(b.education) !== JSON.stringify(p.education) && <div><button type="button" style={{ ...small, color: '#475569' }} onClick={() => set({ education: b.education })}><RotateCcw size={13} /> Put back to my CV</button></div>}
        {p.education.map((e, i) => (
          <div key={i} style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
            <input className="acq-input" aria-label="Qualification" placeholder="Qualification" value={e.qualification} onChange={(ev) => edu(i, { qualification: ev.target.value })} />
            <input className="acq-input" aria-label="Institution" placeholder="Institution" value={e.institution} onChange={(ev) => edu(i, { institution: ev.target.value })} />
            <input className="acq-input" aria-label="Year" placeholder="Year" value={e.end} onChange={(ev) => edu(i, { end: ev.target.value })} />
            <button type="button" className="acq-btn acq-btn-sm" onClick={() => set({ education: p.education.filter((_, j) => j !== i) })}><Trash2 size={13} /> Remove</button>
          </div>
        ))}
        <button type="button" className="acq-btn acq-btn-sm" style={{ justifySelf: 'start' }} onClick={() => set({ education: [...p.education, { institution: '', qualification: '', start: '', end: '' }] })}><Plus size={13} /> Add education</button>
      </More>

      <More summary={`Skills (${p.skills.length})`}>
        <Row msg={msg} label="Skills" tools={<Tools ctx={ctx} k="skills" text={p.skills.join(', ')} original={b?.skills.join(', ')} apply={() => undefined} revert={() => { set({ skills: b!.skills }); setSkillsText(b!.skills.join(', ')); }} />}>
          <textarea className="acq-input" rows={2} aria-label="Skills" placeholder="e.g. React, TypeScript, Node.js" value={skillsText} onChange={(e) => { setSkillsText(e.target.value); set({ skills: fromLines(e.target.value) }); }} />
          <span style={hint}>Separate with commas.</span>
        </Row>
      </More>

      <More summary={`Certifications and achievements (${p.certifications.length + p.achievements.length})`}>
        <Row msg={msg} label="Certifications (one per line)" tools={<Tools ctx={ctx} k="certs" text={lines(p.certifications)} original={b ? lines(b.certifications) : undefined} apply={() => undefined} revert={() => set({ certifications: b!.certifications })} />}>
          <textarea className="acq-input" rows={2} aria-label="Certifications" placeholder="One per line, e.g. AWS Cloud Practitioner" value={lines(p.certifications)} onChange={(e) => set({ certifications: e.target.value.split('\n') })} />
        </Row>
        <Row msg={msg} k="ach" label="Achievements (one per line)" tools={<Tools ctx={ctx} k="ach" kind="bullets" text={lines(p.achievements)} original={b ? lines(b.achievements) : undefined} apply={(t) => set({ achievements: t.split('\n').filter(Boolean) })} revert={() => set({ achievements: b!.achievements })} />}>
          <textarea className="acq-input" rows={3} aria-label="Achievements" placeholder="One per line, e.g. Cut page load time by 40%" value={lines(p.achievements)} onChange={(e) => set({ achievements: e.target.value.split('\n') })} />
          <span style={hint}>Only things that are true and that you can back up.</span>
        </Row>
      </More>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', position: 'sticky', bottom: 0, background: '#fff', padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
        <button type="button" className="acq-btn acq-btn-primary" disabled={busy || empty} onClick={() => { onSave(p, true); setDirty(false); }}><Check size={15} /> {confirmed && !dirty ? 'Confirmed' : 'Confirm this is accurate'}</button>
        {dirty && <button type="button" className="acq-btn" disabled={busy} onClick={() => { onSave(p, false); setDirty(false); }}>Save without confirming</button>}
        <span style={hint}>{confirmed && !dirty ? 'The agent may use this profile.' : 'Not confirmed yet. The agent will not use it until you confirm.'}</span>
      </div>
    </div>
  );
}
