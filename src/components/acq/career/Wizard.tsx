'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FileUp, Loader2, Rocket, ShieldCheck } from 'lucide-react';
import { LEVELS, PERMISSION_MODES, SOURCES, WORK_MODES, type Discovery, type Permissions, type Preferences } from '@/lib/career/types';
import type { Tailored } from '@/lib/career/tailor';
import ProfileReview from './ProfileReview';
import { api, box, Field, fromLines, hint, json, lines, type CareerState } from './shared';

const STEPS = ['Upload your CV', 'Job preferences', 'Job discovery', 'Permissions', 'Test and deploy'];
const num = (v: string) => (v === '' ? null : Number(v));

export default function Wizard({ state, onState, onDone }: { state: CareerState; onState: (s: CareerState) => void; onDone?: () => void }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [note, setNote] = useState(''); const [removed, setRemoved] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<Preferences>(state.preferences); const [disc, setDisc] = useState<Discovery>(state.discovery); const [perm, setPerm] = useState<Permissions>(state.permissions);
  const [titles, setTitles] = useState(lines(state.preferences.titles)); const [inds, setInds] = useState(lines(state.preferences.industries)); const [locs, setLocs] = useState(lines(state.preferences.locations));
  const [emps, setEmps] = useState(lines(state.discovery.employers)); const [blocked, setBlocked] = useState(lines(state.permissions.autoBlockedEmployers));
  const [ack, setAck] = useState(state.permissions.mode === 'auto'); const [job, setJob] = useState(''); const [role, setRole] = useState(''); const [res, setRes] = useState<Tailored | null>(null);
  const file = useRef<HTMLInputElement>(null); const [uploadKey, setUploadKey] = useState(0);

  const fail = (m?: string) => { setErr(m ?? ''); return !!m; };
  async function upload(f: File) {
    setBusy(true); setErr(''); setNote('');
    const fd = new FormData(); fd.append('file', f);
    const r = await api<CareerState & { note?: string; removed?: string[] }>('/api/career/cv', { method: 'POST', body: fd });
    setBusy(false); if (fail(r.error)) return;
    onState(r); setNote(r.note ?? ''); setRemoved(r.removed ?? []); setUploadKey((k) => k + 1);
  }
  async function saveProfile(p: NonNullable<CareerState['profile']>, confirm: boolean) {
    setBusy(true); const r = await api('/api/career/profile', json('PUT', { profile: p, confirm })); setBusy(false);
    if (!fail(r.error)) { onState(r); setRemoved([]); }
  }
  async function saveSettings(patch: { preferences?: Preferences; discovery?: Discovery; permissions?: Permissions }) {
    setBusy(true); const r = await api('/api/career', json('PUT', patch)); setBusy(false);
    if (fail(r.error)) return false; onState(r); return true;
  }
  async function next() {
    setErr('');
    if (step === 1) { if (!state.profile) return fail('Upload your CV to continue.'), undefined; if (!state.profileConfirmed) return fail('Review your profile and press “Confirm this is accurate” to continue.'), undefined; }
    if (step === 2) { const p = { ...prefs, titles: fromLines(titles), industries: fromLines(inds), locations: fromLines(locs) }; if (!p.titles.length) return fail('Add at least one job title.'), undefined; if (!p.workModes.length) return fail('Choose remote, hybrid or onsite.'), undefined; setPrefs(p); if (!(await saveSettings({ preferences: p }))) return; }
    if (step === 3) { const d = { ...disc, employers: fromLines(emps) }; if (!d.sources.length) return fail('Choose at least one job source.'), undefined; setDisc(d); if (!(await saveSettings({ discovery: d }))) return; }
    if (step === 4) { if (perm.mode === 'auto' && !ack) return fail('Tick the box to confirm you understand automatic submission before continuing.'), undefined; if (!(await saveSettings({ permissions: { ...perm, autoBlockedEmployers: fromLines(blocked) } }))) return; }
    setStep(step + 1);
  }
  async function runTest() {
    setBusy(true); setErr(''); setRes(null);
    const r = await api<{ result: Tailored }>('/api/career/test', json('POST', { job, role })); setBusy(false);
    if (!fail(r.error)) setRes(r.result);
  }
  async function deploy() {
    setBusy(true); setErr(''); const r = await api('/api/career/deploy', json('POST', { action: 'deploy' })); setBusy(false);
    if (!fail(r.error)) { onState(r); onDone?.(); }
  }
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <section className="acq-card acq-card-pad" aria-label="Deploy your AI Career Agent" style={{ display: 'grid', gap: 16 }}>
      <div><h2 className="acq-title">Deploy your AI Career Agent</h2>
        <ol style={{ display: 'flex', gap: 6, flexWrap: 'wrap', listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
          {STEPS.map((s, i) => (
            <li key={s}><button type="button" onClick={() => i + 1 < step && setStep(i + 1)} aria-current={step === i + 1 ? 'step' : undefined} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 10px', borderRadius: 999, border: '1px solid ' + (step === i + 1 ? '#7e22ce' : '#e2e8f0'), background: step === i + 1 ? '#f3e8ff' : '#fff', fontSize: 12.5, fontWeight: 600, color: step === i + 1 ? '#6b21a8' : '#475569', cursor: i + 1 < step ? 'pointer' : 'default' }}>
              <span style={{ width: 18, height: 18, borderRadius: 9, background: step > i + 1 ? '#16a34a' : '#e2e8f0', color: step > i + 1 ? '#fff' : '#475569', display: 'grid', placeItems: 'center', fontSize: 11 }}>{step > i + 1 ? <Check size={11} /> : i + 1}</span>{s}</button></li>
          ))}
        </ol>
      </div>

      {step === 1 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <p style={{ fontSize: 13.5, color: '#475569' }}>Accepts PDF and Word (.docx). RUNVAX reads your experience, education, skills, certifications and achievements. Only the extracted text is kept, not the file.</p>
          <input ref={file} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden aria-label="Upload CV" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
          <button type="button" disabled={busy} onClick={() => file.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void upload(f); }}
            style={{ border: '2px dashed #c4b5fd', borderRadius: 14, padding: 22, background: '#faf5ff', display: 'grid', placeItems: 'center', gap: 6, cursor: 'pointer', color: '#6b21a8', fontWeight: 600 }}>
            {busy ? <><Loader2 size={22} className="animate-spin" /> Reading your CV…</> : <><FileUp size={22} /> {state.profile ? 'Upload a different CV' : 'Choose a CV or drop it here'}<span style={{ fontWeight: 400, fontSize: 12, color: '#64748b' }}>PDF or DOCX, up to 4 MB</span></>}
          </button>
          {note && <div className="acq-notice" role="status" style={{ fontSize: 13 }}>{note}</div>}
          {state.profile && <ProfileReview key={uploadKey} profile={state.profile} source={state.profileSource} confirmed={state.profileConfirmed} removed={removed} busy={busy} onSave={saveProfile} />}
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Desired job titles" hint="One per line, for example Frontend Developer."><textarea className="acq-input" rows={3} value={titles} onChange={(e) => setTitles(e.target.value)} /></Field>
          <Field label="Industries" hint="Optional, one per line."><textarea className="acq-input" rows={2} value={inds} onChange={(e) => setInds(e.target.value)} /></Field>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            <Field label="Country"><input className="acq-input" value={prefs.country} onChange={(e) => setPrefs({ ...prefs, country: e.target.value })} /></Field>
            <Field label="Preferred locations" hint="Cities or regions, one per line."><textarea className="acq-input" rows={2} value={locs} onChange={(e) => setLocs(e.target.value)} /></Field>
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Work style</legend>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{WORK_MODES.map((m) => <label key={m} style={{ ...box, padding: '6px 12px', display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', textTransform: 'capitalize' }}><input type="checkbox" checked={prefs.workModes.includes(m)} onChange={() => setPrefs({ ...prefs, workModes: toggle(prefs.workModes, m) })} /> {m}</label>)}</div></fieldset>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
            <Field label="Currency"><input className="acq-input" maxLength={4} value={prefs.currency} onChange={(e) => setPrefs({ ...prefs, currency: e.target.value.toUpperCase() })} /></Field>
            <Field label="Minimum salary (per year)"><input className="acq-input" inputMode="numeric" value={prefs.salaryMin ?? ''} onChange={(e) => setPrefs({ ...prefs, salaryMin: num(e.target.value.replace(/\D/g, '')) })} /></Field>
            <Field label="Maximum salary"><input className="acq-input" inputMode="numeric" value={prefs.salaryMax ?? ''} onChange={(e) => setPrefs({ ...prefs, salaryMax: num(e.target.value.replace(/\D/g, '')) })} /></Field>
            <Field label="Experience level"><select className="acq-input" value={prefs.level} onChange={(e) => setPrefs({ ...prefs, level: e.target.value })} style={{ textTransform: 'capitalize' }}>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select></Field>
          </div>
          <fieldset style={{ ...box, display: 'grid', gap: 10 }}>
            <legend style={{ fontSize: 13, fontWeight: 700, padding: '0 6px' }}>Details for application forms (optional)</legend>
            <p style={hint}>Only you can state these. They are used only when an employer's form asks, exactly as you enter them. Leave a box empty and the agent will hand that application back to you instead of guessing.</p>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
              <Field label="LinkedIn URL"><input className="acq-input" placeholder="https://www.linkedin.com/in/…" value={prefs.standing.linkedin} onChange={(e) => setPrefs({ ...prefs, standing: { ...prefs.standing, linkedin: e.target.value } })} /></Field>
              <Field label="GitHub URL"><input className="acq-input" value={prefs.standing.github} onChange={(e) => setPrefs({ ...prefs, standing: { ...prefs.standing, github: e.target.value } })} /></Field>
              <Field label="Website or portfolio"><input className="acq-input" value={prefs.standing.website} onChange={(e) => setPrefs({ ...prefs, standing: { ...prefs.standing, website: e.target.value } })} /></Field>
              <Field label="Country you live in"><input className="acq-input" value={prefs.standing.residenceCountry} onChange={(e) => setPrefs({ ...prefs, standing: { ...prefs.standing, residenceCountry: e.target.value } })} /></Field>
              <Field label="Legally authorized to work where you apply?"><select className="acq-input" value={prefs.standing.authorizedToWork} onChange={(e) => setPrefs({ ...prefs, standing: { ...prefs.standing, authorizedToWork: e.target.value as '' | 'yes' | 'no' } })}><option value="">Ask me each time</option><option value="yes">Yes</option><option value="no">No</option></select></Field>
              <Field label="Need visa sponsorship?"><select className="acq-input" value={prefs.standing.needsSponsorship} onChange={(e) => setPrefs({ ...prefs, standing: { ...prefs.standing, needsSponsorship: e.target.value as '' | 'yes' | 'no' } })}><option value="">Ask me each time</option><option value="yes">Yes</option><option value="no">No</option></select></Field>
              <Field label="How did you hear about the job?" hint="e.g. Job board"><input className="acq-input" value={prefs.standing.howHeard} onChange={(e) => setPrefs({ ...prefs, standing: { ...prefs.standing, howHeard: e.target.value } })} /></Field>
            </div>
          </fieldset>

        </div>
      )}

      {step === 3 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 8 }}><legend style={{ fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Job sources</legend>
            {SOURCES.map((s) => <label key={s.id} style={{ ...box, display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}><input type="checkbox" checked={disc.sources.includes(s.id)} onChange={() => setDisc({ ...disc, sources: toggle(disc.sources, s.id) })} /><span><b style={{ fontSize: 13.5 }}>{s.label}</b><span style={{ display: 'block', ...hint, marginTop: 0 }}>{s.note}</span></span></label>)}
            <span style={hint}>Only sources that allow automated access are offered. More are added as they are checked.</span></fieldset>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            <Field label="Search frequency"><select className="acq-input" value={disc.frequency} onChange={(e) => setDisc({ ...disc, frequency: e.target.value })}><option value="daily">Daily</option><option value="weekly">Weekly</option></select></Field>
            <Field label={`Minimum job-match score: ${disc.minScore}%`} hint="Jobs scoring below this are not shown or applied to."><input type="range" min={50} max={95} step={5} value={disc.minScore} onChange={(e) => setDisc({ ...disc, minScore: Number(e.target.value) })} style={{ width: '100%' }} /></Field>
          </div>
          <Field label="Preferred employers" hint="Optional, one per line. The agent checks these first."><textarea className="acq-input" rows={3} value={emps} onChange={(e) => setEmps(e.target.value)} /></Field>
        </div>
      )}

      {step === 4 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {PERMISSION_MODES.map((m) => <label key={m.id} style={{ ...box, display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', borderColor: perm.mode === m.id ? '#7e22ce' : '#e2e8f0', background: perm.mode === m.id ? '#faf5ff' : '#fff' }}><input type="radio" name="perm" checked={perm.mode === m.id} onChange={() => setPerm({ ...perm, mode: m.id })} /><span><b style={{ fontSize: 13.5 }}>{m.label}</b><span style={{ display: 'block', ...hint, marginTop: 0 }}>{m.note}</span></span></label>)}
          {perm.mode === 'auto' && (
            <div style={{ ...box, display: 'grid', gap: 10 }}>
              <b style={{ fontSize: 13.5 }}>Rules for automatic submission</b>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
                <Field label={`Only jobs scoring ${perm.autoMinScore}% or more`}><input type="range" min={70} max={99} value={perm.autoMinScore} onChange={(e) => setPerm({ ...perm, autoMinScore: Number(e.target.value) })} style={{ width: '100%' }} /></Field>
                <Field label="Most applications per day"><input className="acq-input" inputMode="numeric" value={perm.autoMaxPerDay} onChange={(e) => setPerm({ ...perm, autoMaxPerDay: Number(e.target.value.replace(/\D/g, '')) || 1 })} /></Field>
              </div>
              <Field label="Never auto-apply to these employers" hint="One per line."><textarea className="acq-input" rows={2} value={blocked} onChange={(e) => setBlocked(e.target.value)} /></Field>
            </div>
          )}
          <label style={{ ...box, display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={perm.remindByEmail} onChange={(e) => setPerm({ ...perm, remindByEmail: e.target.checked })} /><span><b style={{ fontSize: 13.5 }}>Email me reminders</b><span style={{ display: 'block', ...hint, marginTop: 0 }}>Upcoming interviews and follow-ups that are due. One email a day at most, only to you.</span></span></label>
          {perm.mode !== 'prepare' && (
            <div style={{ ...box, background: '#faf5ff', borderColor: '#e9d5ff', display: 'grid', gap: 6, fontSize: 13 }}>
              <b>What submitting means</b>
              <ul style={{ margin: '0 0 0 18px' }}>
                <li>It works only on Greenhouse and Lever hosted application forms. Everything else is yours to send.</li>
                <li>It fills a form only from your confirmed profile and the answers you saw. If any required question cannot be answered that way, it sends nothing and hands the application back.</li>
                <li>It never answers legal or eligibility questions (work authorization, sponsorship, diversity), never ticks consent or privacy boxes, and never solves or bypasses a CAPTCHA or security check.</li>
                <li>It counts an application as submitted only when the site's own confirmation page appears. If it cannot confirm, it says so and does not try again, so you never get a duplicate.</li>
                <li>You can pause the agent at any time; waiting submissions are cancelled.</li>
              </ul>
            </div>)}
          {perm.mode === 'auto' && <label style={{ ...box, display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', borderColor: '#7e22ce' }}><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: 3 }} /><span style={{ fontSize: 13.5 }}>I understand the agent will apply for jobs on my behalf, without asking me each time, only inside the rules above, and that each application goes out under my name.</span></label>}
          <div className="acq-notice" style={{ fontSize: 13 }}><ShieldCheck size={14} style={{ verticalAlign: -2 }} /> Whatever you choose, the agent stops and asks you when it meets a CAPTCHA, an identity check, a question it cannot answer from your profile, or a site that restricts automation. It never tries to get around those.</div>
        </div>
      )}

      {step === 5 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="acq-notice" style={{ fontSize: 13 }}><b>Where this stands:</b> your profile, job discovery, matching, application writing, reply tracking and interview preparation are live. Once deployed, the agent searches your chosen sources and scores what it finds. Submitting is optional: choose it in the step before, or apply yourself with what it prepares.</div>
          <p style={{ fontSize: 13.5, color: '#475569' }}>Test the writing on a real job: paste a job description and see the tailored CV highlights, cover letter and answers. Nothing is sent anywhere.</p>
          <Field label="Job title (optional)"><input className="acq-input" value={role} onChange={(e) => setRole(e.target.value)} /></Field>
          <Field label="Job description"><textarea className="acq-input" rows={6} value={job} onChange={(e) => setJob(e.target.value)} placeholder="Paste the full job advert here" /></Field>
          <div><button type="button" className="acq-btn" disabled={busy || job.trim().length < 80} onClick={runTest}>{busy ? <Loader2 size={15} className="animate-spin" /> : null} Run a sample</button></div>
          {res && (
            <div style={{ ...box, display: 'grid', gap: 10 }} aria-label="Sample result">
              <span style={hint}>Written by the {res.source === 'ai' ? 'AI writer' : 'basic writer (no AI connected)'} from your confirmed profile only.</span>
              {res.summary && <div><b style={{ fontSize: 13 }}>CV summary</b><p style={{ fontSize: 13.5 }}>{res.summary}</p></div>}
              {res.highlights.length > 0 && <div><b style={{ fontSize: 13 }}>CV highlights used</b><ul style={{ margin: '4px 0 0 18px', fontSize: 13.5 }}>{res.highlights.map((h) => <li key={h}>{h}</li>)}</ul></div>}
              {res.matchedSkills.length > 0 && <div><b style={{ fontSize: 13 }}>Skills that match</b><p style={{ fontSize: 13.5 }}>{res.matchedSkills.join(', ')}</p></div>}
              {res.gaps.length > 0 && <div style={{ background: '#fffbeb', borderRadius: 8, padding: 10 }}><b style={{ fontSize: 13 }}>Asked for, but not in your profile</b><ul style={{ margin: '4px 0 0 18px', fontSize: 13.5 }}>{res.gaps.map((g) => <li key={g}>{g}</li>)}</ul><span style={hint}>The agent will not claim these.</span></div>}
              {res.coverLetter && <div><b style={{ fontSize: 13 }}>Cover letter</b><p style={{ fontSize: 13.5, whiteSpace: 'pre-wrap' }}>{res.coverLetter}</p></div>}
              {res.answers.map((a) => <div key={a.question}><b style={{ fontSize: 13 }}>{a.question}</b><p style={{ fontSize: 13.5 }}>{a.answer}</p></div>)}
              {res.flags.length > 0 && <div style={{ fontSize: 12.5, color: '#92400e' }}><b>Checked against your profile:</b><ul style={{ margin: '4px 0 0 18px' }}>{res.flags.map((f) => <li key={f}>{f}</li>)}</ul></div>}
            </div>
          )}
          {state.issues.length > 0 && <div style={{ ...box, background: '#fef2f2', borderColor: '#fecaca', fontSize: 13 }}><b>Before you can deploy:</b><ul style={{ margin: '4px 0 0 18px' }}>{state.issues.map((i) => <li key={i}>{i}</li>)}</ul></div>}
          <div><button type="button" className="acq-btn acq-btn-primary" disabled={busy || state.issues.length > 0} onClick={deploy}><Rocket size={15} /> Deploy my Career Agent</button></div>
        </div>
      )}

      {err && <div role="alert" style={{ color: '#b91c1c', fontSize: 13.5 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <button type="button" className="acq-btn" disabled={step === 1 || busy} onClick={() => { setErr(''); setStep(step - 1); }}><ArrowLeft size={15} /> Back</button>
        {step < 5 && <button type="button" className="acq-btn acq-btn-primary" disabled={busy} onClick={next}>Next <ArrowRight size={15} /></button>}
      </div>
    </section>
  );
}
