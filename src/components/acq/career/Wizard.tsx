'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, FileUp, Loader2, Rocket, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import type { Suggestion } from '@/lib/career/suggest';
import { LEVELS, PERMISSION_MODES, SOURCES, WORK_MODES, type Discovery, type Permissions, type Preferences } from '@/lib/career/types';
import type { Tailored } from '@/lib/career/tailor';
import ProfileReview from './ProfileReview';
import { api, box, hint, json, lbl, type CareerState } from './shared';
import { Block, ChoiceCard, Mini, More, MultiPills, Pills, Progress, TagInput } from './ui';

const STEPS = ['Your CV', 'The job you want', 'Where to look', 'What the agent may do', 'Review and deploy'];
const num = (v: string) => (v === '' ? null : Number(v));
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export default function Wizard({ state, onState, onDone }: { state: CareerState; onState: (s: CareerState) => void; onDone?: () => void }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [note, setNote] = useState(''); const [removed, setRemoved] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<Preferences>(state.preferences); const [disc, setDisc] = useState<Discovery>(state.discovery); const [perm, setPerm] = useState<Permissions>(state.permissions);
  const [sug, setSug] = useState<Suggestion | null>(null); const [suggesting, setSuggesting] = useState<string | null>(null);
  const [ack, setAck] = useState(state.permissions.mode === 'auto'); const [job, setJob] = useState(''); const [role, setRole] = useState(''); const [res, setRes] = useState<Tailored | null>(null);
  const file = useRef<HTMLInputElement>(null); const [uploadKey, setUploadKey] = useState(0);

  const fail = (m?: string) => { setErr(m ?? ''); return !!m; };
  const setP = (patch: Partial<Preferences>) => setPrefs((p) => ({ ...p, ...patch }));
  const setStanding = (patch: Partial<Preferences['standing']>) => setPrefs((p) => ({ ...p, standing: { ...p.standing, ...patch } }));

  async function upload(f: File) {
    setBusy(true); setErr(''); setNote('');
    const fd = new FormData(); fd.append('file', f);
    const r = await api<CareerState & { note?: string; removed?: string[] }>('/api/career/cv', { method: 'POST', body: fd });
    setBusy(false); if (fail(r.error)) return;
    onState(r); setNote(r.note ?? ''); setRemoved(r.removed ?? []); setUploadKey((k) => k + 1); setSug(null);
  }
  async function saveProfile(p: NonNullable<CareerState['profile']>, confirm: boolean) {
    setBusy(true); const r = await api('/api/career/profile', json('PUT', { profile: p, confirm })); setBusy(false);
    if (!fail(r.error)) { onState(r); setRemoved([]); }
  }
  async function revertProfile() {
    setBusy(true); const r = await api('/api/career/profile', json('PUT', { revert: true })); setBusy(false);
    if (!fail(r.error)) { onState(r); setRemoved([]); setUploadKey((k) => k + 1); }
  }
  async function saveSettings(patch: { preferences?: Preferences; discovery?: Discovery; permissions?: Permissions }) {
    setBusy(true); const r = await api('/api/career', json('PUT', patch)); setBusy(false);
    if (fail(r.error)) return false; onState(r); return true;
  }

  /** Asks the server to propose the setup from the CV. `fresh` = the first time (fills the page); later calls only touch the block they were asked from. */
  async function suggest(scope: 'all' | 'titles' | 'industries') {
    setSuggesting(scope); const r = await api<{ suggestion: Suggestion }>('/api/career/suggest', json('POST', {})); setSuggesting(null);
    if (r.error) { if (scope !== 'all') setErr(r.error); return; }
    const x = r.suggestion; setSug((cur) => cur ?? x);                        // the first suggestion stays as the "my CV" version to go back to
    if (scope === 'titles') return setP({ titles: x.preferences.titles });
    if (scope === 'industries') return setP({ industries: x.preferences.industries });
    setPrefs((p) => ({ ...p, titles: x.preferences.titles, industries: x.preferences.industries, country: x.preferences.country, locations: x.preferences.locations, workModes: x.preferences.workModes, level: x.preferences.level,
      standing: { ...p.standing, linkedin: p.standing.linkedin || x.standing.linkedin, github: p.standing.github || x.standing.github, website: p.standing.website || x.standing.website, residenceCountry: p.standing.residenceCountry || x.standing.residenceCountry } }));
  }

  async function next() {
    setErr('');
    if (step === 1) { if (!state.profile) return fail('Upload your CV to continue.'), undefined; if (!state.profileConfirmed) return fail('Review your profile and press “Confirm this is accurate” to continue.'), undefined; }
    if (step === 2) { if (!prefs.titles.length) return fail('Add at least one job title.'), undefined; if (!prefs.workModes.length) return fail('Choose remote, hybrid or onsite.'), undefined; if (!(await saveSettings({ preferences: prefs }))) return; }
    if (step === 3) { if (!disc.sources.length) return fail('Choose at least one place to look.'), undefined; if (!(await saveSettings({ discovery: disc }))) return; }
    if (step === 4) { if (perm.mode === 'auto' && !ack) return fail('Tick the box to confirm you understand automatic submission before continuing.'), undefined; if (!(await saveSettings({ preferences: prefs, permissions: perm }))) return; }
    if (step === 1 && !sug && state.preferences.titles.length === 0) await suggest('all');      // a first-time setup starts filled in from the CV
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

  const mode = PERMISSION_MODES.find((m) => m.id === perm.mode);
  const standingFromCv = sug && (sug.standing.linkedin || sug.standing.github || sug.standing.website || sug.standing.residenceCountry);

  return (
    <section className="acq-card acq-card-pad" aria-label="Deploy your AI Career Agent" style={{ display: 'grid', gap: 20, maxWidth: 760 }}>
      <div style={{ display: 'grid', gap: 12 }}><h2 className="acq-title">Set up your Career Agent</h2><Progress step={step} steps={STEPS} onGo={setStep} /></div>

      {step === 1 && (
        <div style={{ display: 'grid', gap: 16 }}>
          <Block title="Upload your CV" help="PDF or Word. RUNVAX reads it and fills in the rest for you. Only the text is kept, not the file.">
            <input ref={file} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden aria-label="Upload CV" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
            <button type="button" disabled={busy} onClick={() => file.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void upload(f); }}
              style={{ border: '2px dashed #c4b5fd', borderRadius: 14, padding: state.profile ? 14 : 28, background: '#faf5ff', display: 'grid', placeItems: 'center', gap: 6, cursor: 'pointer', color: '#6b21a8', fontWeight: 600 }}>
              {busy ? <><Loader2 size={22} className="animate-spin" /> Reading your CV…</> : <><FileUp size={22} /> {state.profile ? 'Upload a different CV' : 'Choose a CV or drop it here'}<span style={{ fontWeight: 400, fontSize: 12, color: '#64748b' }}>PDF or DOCX, up to 4 MB</span></>}
            </button>
          </Block>
          {note && <div className="acq-notice" role="status" style={{ fontSize: 13 }}>{note}</div>}
          {state.profile && <Block title="Check what we read" help="Open a section to check or change it. You can rewrite a field with AI, and every field can go back to what your CV said."><ProfileReview key={uploadKey} profile={state.profile} baseline={state.baseline} source={state.profileSource} confirmed={state.profileConfirmed} removed={removed} busy={busy} onSave={saveProfile} onRevertAll={revertProfile} /></Block>}
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'grid', gap: 22 }}>
          <div className="acq-notice" style={{ fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span><Sparkles size={14} style={{ verticalAlign: -2 }} /> {sug ? `Filled in from your CV${sug.source === 'ai' ? ' with AI' : ''}. Check it and change anything.` : 'Fill this in from your CV. You can change anything.'}</span>
            {!sug && <button type="button" className="acq-btn acq-btn-sm" disabled={suggesting !== null} onClick={() => suggest('all')}>{suggesting === 'all' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Fill from my CV</button>}
          </div>

          <Block title="What job are you looking for?" help="Press Enter after each title. The first one matters most."
            actions={<span style={{ display: 'inline-flex', gap: 2 }}>
              <Mini tone="#6b21a8" disabled={suggesting !== null} onClick={() => suggest('titles')}>{suggesting === 'titles' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Suggest again</Mini>
              {sug && !same(sug.preferences.titles, prefs.titles) && <Mini onClick={() => setP({ titles: sug.preferences.titles })}><RotateCcw size={13} /> Back to my CV</Mini>}</span>}>
            <TagInput label="Job titles" value={prefs.titles} onChange={(titles) => setP({ titles })} placeholder="e.g. Frontend Developer" max={8} />
          </Block>

          <Block title="How do you want to work?" actions={sug && !same(sug.preferences.workModes, prefs.workModes) ? <Mini onClick={() => setP({ workModes: sug.preferences.workModes })}><RotateCcw size={13} /> Back to suggestion</Mini> : undefined}>
            <MultiPills label="Work style" options={WORK_MODES.map((m) => ({ id: m }))} value={prefs.workModes} onChange={(workModes) => setP({ workModes })} />
          </Block>

          <Block title="Where?" help="Your country, and any cities you would accept."
            actions={sug && (sug.preferences.country !== prefs.country || !same(sug.preferences.locations, prefs.locations)) ? <Mini onClick={() => setP({ country: sug.preferences.country, locations: sug.preferences.locations })}><RotateCcw size={13} /> Back to my CV</Mini> : undefined}>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
              <input className="acq-input" aria-label="Country" placeholder="Country" value={prefs.country} onChange={(e) => setP({ country: e.target.value })} />
              <TagInput label="Cities" value={prefs.locations} onChange={(locations) => setP({ locations })} placeholder="Cities (optional)" max={10} />
            </div>
          </Block>

          <Block title="Your level" actions={sug && sug.preferences.level !== prefs.level ? <Mini onClick={() => setP({ level: sug.preferences.level })}><RotateCcw size={13} /> Back to my CV</Mini> : undefined}>
            <Pills label="Experience level" options={LEVELS.map((l) => ({ id: l }))} value={prefs.level} onChange={(level) => setP({ level })} />
          </Block>

          <More summary="More options: industries and salary">
            <Block title="Industries" help="Optional. It helps rank jobs."
              actions={<span style={{ display: 'inline-flex', gap: 2 }}><Mini tone="#6b21a8" disabled={suggesting !== null} onClick={() => suggest('industries')}>{suggesting === 'industries' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Suggest</Mini>{sug && !same(sug.preferences.industries, prefs.industries) && <Mini onClick={() => setP({ industries: sug.preferences.industries })}><RotateCcw size={13} /> Back to my CV</Mini>}</span>}>
              <TagInput label="Industries" value={prefs.industries} onChange={(industries) => setP({ industries })} placeholder="e.g. Fintech" max={8} />
            </Block>
            <Block title="Salary" help="Optional, per year. Only you can say this, so it is never guessed.">
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '90px 1fr 1fr' }}>
                <input className="acq-input" aria-label="Currency" placeholder="USD" maxLength={4} value={prefs.currency} onChange={(e) => setP({ currency: e.target.value.toUpperCase() })} />
                <input className="acq-input" aria-label="Minimum salary" placeholder="Minimum" inputMode="numeric" value={prefs.salaryMin ?? ''} onChange={(e) => setP({ salaryMin: num(e.target.value.replace(/\D/g, '')) })} />
                <input className="acq-input" aria-label="Maximum salary" placeholder="Maximum" inputMode="numeric" value={prefs.salaryMax ?? ''} onChange={(e) => setP({ salaryMax: num(e.target.value.replace(/\D/g, '')) })} />
              </div>
            </Block>
          </More>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: 'grid', gap: 22 }}>
          <Block title="Where should it look?" help="Only places that allow automated reading are offered.">
            {SOURCES.map((s) => <ChoiceCard key={s.id} type="checkbox" checked={disc.sources.includes(s.id)} onChange={() => setDisc({ ...disc, sources: disc.sources.includes(s.id) ? disc.sources.filter((x) => x !== s.id) : [...disc.sources, s.id] })} title={s.label} note={s.note} />)}
          </Block>
          <Block title="How often?"><Pills label="Search frequency" options={[{ id: 'daily', label: 'Every day' }, { id: 'weekly', label: 'Every week' }]} value={disc.frequency} onChange={(frequency) => setDisc({ ...disc, frequency })} /></Block>
          <Block title={`How good a match? ${disc.minScore}% or more`} help="Jobs below this are not shown. Lower it to see more.">
            <input type="range" aria-label="Minimum match" min={50} max={95} step={5} value={disc.minScore} onChange={(e) => setDisc({ ...disc, minScore: Number(e.target.value) })} style={{ width: '100%', accentColor: '#7e22ce' }} />
          </Block>
          <More summary="More options: employers you like">
            <Block title="Preferred employers" help="Optional. The agent checks these companies' own job pages first."><TagInput label="Employers" value={disc.employers} onChange={(employers) => setDisc({ ...disc, employers })} placeholder="e.g. Stripe" max={30} /></Block>
          </More>
        </div>
      )}

      {step === 4 && (
        <div style={{ display: 'grid', gap: 22 }}>
          <Block title="What may the agent do with a good match?" help="You can change this any time.">
            {PERMISSION_MODES.map((m) => <ChoiceCard key={m.id} type="radio" name="perm" checked={perm.mode === m.id} onChange={() => setPerm({ ...perm, mode: m.id })} title={m.label} note={m.note} />)}
          </Block>

          {perm.mode === 'auto' && (
            <Block title="Your rules for automatic applying">
              <div style={{ display: 'grid', gap: 14 }}>
                <label><span style={lbl}>Only jobs that match {perm.autoMinScore}% or more</span><input type="range" aria-label="Automatic minimum match" min={70} max={99} value={perm.autoMinScore} onChange={(e) => setPerm({ ...perm, autoMinScore: Number(e.target.value) })} style={{ width: '100%', accentColor: '#7e22ce' }} /></label>
                <label><span style={lbl}>Most applications per day</span><input className="acq-input" style={{ maxWidth: 120 }} placeholder="e.g. 5" inputMode="numeric" value={perm.autoMaxPerDay} onChange={(e) => setPerm({ ...perm, autoMaxPerDay: Number(e.target.value.replace(/\D/g, '')) || 1 })} /></label>
                <div><span style={lbl}>Never apply automatically to</span><TagInput label="Employers to avoid" value={perm.autoBlockedEmployers} onChange={(autoBlockedEmployers) => setPerm({ ...perm, autoBlockedEmployers })} placeholder="Company names" max={30} /></div>
                <label style={{ ...box, display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', borderColor: '#7e22ce' }}><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: 3 }} /><span style={{ fontSize: 13.5 }}>I understand the agent will apply for jobs on my behalf, without asking me each time, only inside these rules. Each application goes out under my name.</span></label>
              </div>
            </Block>
          )}

          {perm.mode !== 'prepare' && (
            <More summary="Details the agent may need for application forms (optional)">
              <p style={{ ...hint, marginTop: 0 }}>Only you can state these. They are used only when an employer's form asks, exactly as you enter them. Leave a box empty and the agent hands that application back to you instead of guessing.</p>
              {standingFromCv && <div><Mini tone="#6b21a8" onClick={() => setStanding({ linkedin: sug!.standing.linkedin, github: sug!.standing.github, website: sug!.standing.website, residenceCountry: sug!.standing.residenceCountry })}><RotateCcw size={13} /> Fill the links and country from my CV</Mini></div>}
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))' }}>
                <label><span style={lbl}>LinkedIn</span><input className="acq-input" placeholder="https://www.linkedin.com/in/…" value={prefs.standing.linkedin} onChange={(e) => setStanding({ linkedin: e.target.value })} /></label>
                <label><span style={lbl}>GitHub</span><input className="acq-input" placeholder="https://github.com/your-name" value={prefs.standing.github} onChange={(e) => setStanding({ github: e.target.value })} /></label>
                <label><span style={lbl}>Website or portfolio</span><input className="acq-input" placeholder="https://your-site.com" value={prefs.standing.website} onChange={(e) => setStanding({ website: e.target.value })} /></label>
                <label><span style={lbl}>Country you live in</span><input className="acq-input" placeholder="e.g. Nigeria" value={prefs.standing.residenceCountry} onChange={(e) => setStanding({ residenceCountry: e.target.value })} /></label>
              </div>
              <Block title="Legal questions (only if you want them answered for you)">
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))' }}>
                  <div><span style={lbl}>Legally allowed to work where you apply?</span><Pills label="Work authorization" options={[{ id: '', label: 'Ask me' }, { id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]} value={prefs.standing.authorizedToWork} onChange={(v) => setStanding({ authorizedToWork: v as '' | 'yes' | 'no' })} /></div>
                  <div><span style={lbl}>Need visa sponsorship?</span><Pills label="Visa sponsorship" options={[{ id: '', label: 'Ask me' }, { id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]} value={prefs.standing.needsSponsorship} onChange={(v) => setStanding({ needsSponsorship: v as '' | 'yes' | 'no' })} /></div>
                </div>
              </Block>
              <label><span style={lbl}>How did you hear about jobs?</span><input className="acq-input" style={{ maxWidth: 320 }} placeholder="e.g. Job board" value={prefs.standing.howHeard} onChange={(e) => setStanding({ howHeard: e.target.value })} /></label>
            </More>
          )}

          {perm.mode !== 'prepare' && (
            <More summary="What submitting means">
              <ul style={{ margin: '0 0 0 18px', fontSize: 13, display: 'grid', gap: 6 }}>
                <li>It works only on Greenhouse and Lever hosted application forms. Everything else is yours to send.</li>
                <li>It fills a form only from your confirmed profile and the answers you saw. If any required question cannot be answered that way, it sends nothing and hands the application back.</li>
                <li>It never answers legal or eligibility questions you did not answer above, never ticks consent or privacy boxes, and never solves or bypasses a CAPTCHA or security check.</li>
                <li>It counts an application as submitted only when the site's own confirmation page appears. If it cannot confirm, it says so and does not try again, so you never get a duplicate.</li>
                <li>You can pause the agent at any time; waiting submissions are cancelled.</li>
              </ul>
            </More>
          )}

          <label style={{ ...box, display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={perm.remindByEmail} onChange={(e) => setPerm({ ...perm, remindByEmail: e.target.checked })} /><span><b style={{ fontSize: 14 }}>Email me reminders</b><span style={{ display: 'block', ...hint, marginTop: 0 }}>Upcoming interviews and follow-ups. One email a day at most, only to you.</span></span></label>
          <div className="acq-notice" style={{ fontSize: 13 }}><ShieldCheck size={14} style={{ verticalAlign: -2 }} /> Whatever you choose, the agent stops and asks you at a CAPTCHA, an identity check, a question it cannot answer from your profile, or a site that restricts automation. It never tries to get around those.</div>
        </div>
      )}

      {step === 5 && (
        <div style={{ display: 'grid', gap: 20 }}>
          <Block title="Here is your setup" help="Go back to any step to change it.">
            <div style={{ ...box, display: 'grid', gap: 6, fontSize: 14 }}>
              <div><b>Looking for:</b> {prefs.titles.join(', ') || '—'}</div>
              <div><b>Style:</b> {prefs.workModes.join(', ') || '—'} · <b>Level:</b> {prefs.level}{prefs.country || prefs.locations.length ? <> · <b>Where:</b> {[prefs.country, ...prefs.locations].filter(Boolean).join(', ')}</> : null}</div>
              <div><b>Searching:</b> {disc.frequency === 'daily' ? 'every day' : 'every week'}, {disc.minScore}% matches or better</div>
              <div><b>The agent may:</b> {mode?.label.toLowerCase()}</div>
            </div>
          </Block>
          <div className="acq-notice" style={{ fontSize: 13 }}>Once deployed, the agent searches your places and scores what it finds. {perm.mode === 'prepare' ? 'It prepares applications and you send them.' : 'Submitting works only on the forms described in the previous step.'}</div>
          {state.issues.length > 0 && <div style={{ ...box, background: '#fef2f2', borderColor: '#fecaca', fontSize: 13 }}><b>Before you can deploy:</b><ul style={{ margin: '4px 0 0 18px' }}>{state.issues.map((i) => <li key={i}>{i}</li>)}</ul></div>}
          <div><button type="button" className="acq-btn acq-btn-primary" style={{ height: 46, paddingInline: 22 }} disabled={busy || state.issues.length > 0} onClick={deploy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />} Deploy my Career Agent</button></div>

          <More summary="Optional: try it on a real job first">
            <p style={{ ...hint, marginTop: 0 }}>Paste a job description to see the tailored CV highlights, cover letter and answers. Nothing is sent anywhere.</p>
            <input className="acq-input" aria-label="Job title" placeholder="Job title (optional)" value={role} onChange={(e) => setRole(e.target.value)} />
            <textarea className="acq-input" rows={6} aria-label="Job description" value={job} onChange={(e) => setJob(e.target.value)} placeholder="Paste the full job advert here" />
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
          </More>
        </div>
      )}

      {err && <div role="alert" style={{ color: '#b91c1c', fontSize: 13.5 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
        <button type="button" className="acq-btn" disabled={step === 1 || busy} onClick={() => { setErr(''); setStep(step - 1); }}><ArrowLeft size={15} /> Back</button>
        {step < 5 && <button type="button" className="acq-btn acq-btn-primary" disabled={busy} onClick={next}>{busy ? <Loader2 size={15} className="animate-spin" /> : null} Next <ArrowRight size={15} /></button>}
      </div>
    </section>
  );
}
