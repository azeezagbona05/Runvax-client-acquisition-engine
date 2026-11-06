'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FlaskConical, Loader2, Mail, MessageSquare, Pause, Play, RotateCcw, Send } from 'lucide-react';
import { SCENARIOS, dayNumbers, stepCopy, type Automation, type Scenario } from '@/lib/automation';
import { renderTemplate } from '@/lib/outreachCampaign';
import { PLAY_ACTION, PLAY_LABEL, PLAY_ORDER, ACTION_LABEL, renderPlay, defaultPlaybook } from '@/lib/replyPlaybook';
import { scenarioPath, type PathStep } from '@/lib/workflowGraph';
import type { ReplyClass } from '@/lib/replyIntel';
import WorkflowCanvas from './WorkflowCanvas';

const SPEED = 900;

/**
 * Test and preview a campaign before it runs: play a scenario through the flow chart, read every email as a sample
 * contact would see it (both versions), read the drafted answer to each kind of reply, and send yourself a test.
 */
export default function CampaignTest({ auto, campaignId }: { auto: Automation; campaignId?: string | null }) {
  const [name, setName] = useState('Amaka Obi');
  const [business, setBusiness] = useState('Bright Smile Dental');
  const [scenario, setScenario] = useState<Scenario>('opens');
  const [pos, setPos] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [emailIx, setEmailIx] = useState(0);
  const [opened, setOpened] = useState(false);
  const [replyClass, setReplyClass] = useState<ReplyClass>('interested');
  const [sending, setSending] = useState(false);
  const [sendNote, setSendNote] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const path = useMemo<PathStep[]>(() => scenarioPath(auto, scenario), [auto, scenario]);
  const lit = useMemo(() => new Set(path.slice(0, pos + 1).map((p) => p.id)), [path, pos]);
  const lead = { email: 'amaka@example.com', name, business };

  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; setPlaying(false); };
  useEffect(() => () => stop(), []);
  useEffect(() => { stop(); setPos(-1); }, [scenario, auto]);

  const play = () => {
    stop();
    let p = pos >= path.length - 1 ? -1 : pos;
    setPlaying(true);
    timer.current = setInterval(() => {
      p += 1;
      setPos(p);
      if (p >= path.length - 1) stop();
    }, SPEED);
  };

  const onSelect = (id: string) => {
    const m = id.match(/^e(\d+)(v?)$/);
    if (m) { setEmailIx(Number(m[1])); setOpened(m[2] === 'v'); return; }
    const p = id.match(/^p_(.+)$/);
    if (p) setReplyClass(p[1] as ReplyClass);
  };

  const step = auto.emails[Math.min(emailIx, auto.emails.length - 1)];
  const copy = stepCopy(step, opened && emailIx > 0);
  const firstSubject = renderTemplate(auto.emails[0].subject, lead);
  const subject = renderTemplate(copy.subject, lead, { subject: firstSubject });
  const body = renderTemplate(copy.body, lead, { subject: firstSubject });
  const playbook = auto.playbook?.length ? auto.playbook : defaultPlaybook(auto.brief);
  const answer = renderPlay(playbook, replyClass, lead);
  const sampleReply: Record<ReplyClass, string> = {
    interested: 'This sounds interesting. Tell me more.', meeting_request: 'Can we have a call on Thursday?', info_request: 'How much does it cost?',
    objection: 'We already use something similar.', not_interested: 'Not for us, thanks.', out_of_office: 'I am out of the office until Monday.',
    unsubscribe: 'Please remove me from your list.', other: 'Who gave you my email?',
  };

  const sendTest = async () => {
    if (!campaignId) return;
    setSending(true); setSendNote('');
    try {
      const res = await fetch(`/api/outreach-campaigns/${campaignId}/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step: emailIx, opened: opened && emailIx > 0 }) });
      const j = await res.json().catch(() => ({})) as { to?: string; error?: string };
      setSendNote(res.ok ? `Sent to ${j.to}. Check your inbox.` : j.error ?? 'Could not send the test.');
    } catch { setSendNote('Could not send the test. Check your connection.'); }
    finally { setSending(false); }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <h3 className="acq-title" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><FlaskConical size={17} style={{ color: 'var(--brand)' }} /> Test run</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {playing
              ? <button className="acq-btn acq-btn-sm" onClick={stop}><Pause size={14} /> Pause</button>
              : <button className="acq-btn acq-btn-primary acq-btn-sm" onClick={play}><Play size={14} /> {pos >= 0 && pos < path.length - 1 ? 'Resume' : 'Run test'}</button>}
            <button className="acq-btn acq-btn-sm" onClick={() => { stop(); setPos(-1); }} disabled={pos < 0}><RotateCcw size={14} /> Reset</button>
          </div>
        </div>
        <p className="acq-sub" style={{ fontSize: 13 }}>Pick how an imaginary lead behaves, press Run test and watch the path light up on the workflow. Click any email or reply on the chart to preview it below.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SCENARIOS.map((s) => <button key={s.id} className={`acq-chip${scenario === s.id ? ' on' : ''}`} style={{ fontSize: 12, padding: '5px 10px' }} aria-pressed={scenario === s.id} title={s.desc} onClick={() => setScenario(s.id)}>{s.label}</button>)}
        </div>
        {pos >= 0 && (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }} aria-live="polite">
            {path.slice(0, pos + 1).map((p, i) => (
              <li key={i} className="acq-build-items" style={{ margin: 0 }}><span style={{ color: i === pos ? 'var(--brand-ink)' : undefined, fontWeight: i === pos ? 600 : 400 }}><b className="acq-pill" style={{ minWidth: 24, justifyContent: 'center', background: i === pos ? 'var(--brand)' : 'var(--brand-soft)', color: i === pos ? '#fff' : 'var(--brand-ink)' }}>{i + 1}</b>{p.note}</span></li>
            ))}
          </ol>
        )}
      </section>

      <WorkflowCanvas auto={auto} lit={pos >= 0 ? lit : undefined} current={pos >= 0 ? path[pos]?.id : null} selected={`e${emailIx}${opened && emailIx > 0 && step.openedVariant ? 'v' : ''}`} onSelect={onSelect} animate={false} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <h3 className="acq-title" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Mail size={17} style={{ color: 'var(--brand)' }} /> Email preview</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input className="acq-input" aria-label="Sample contact name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contact name" />
            <input className="acq-input" aria-label="Sample business" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Business" />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {auto.emails.map((_, i) => <button key={i} className={`acq-chip${emailIx === i ? ' on' : ''}`} style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setEmailIx(i)}>Email {i + 1} · Day {dayNumbers(auto)[i]}</button>)}
          </div>
          {emailIx > 0 && step.openedVariant && (
            <div className="acq-seg" role="group" aria-label="Which version">
              <button className={!opened ? 'on' : ''} onClick={() => setOpened(false)}>Standard</button>
              <button className={opened ? 'on' : ''} onClick={() => setOpened(true)}>If they opened</button>
            </div>
          )}
          <div className="acq-mail-preview">
            <header><span>To: {name || 'there'} &lt;{lead.email}&gt;</span><b>{subject}</b></header>
            <pre>{body}</pre>
            <p className="acq-faint" style={{ fontSize: 11.5, padding: '0 14px 12px' }}>Your signature and an unsubscribe link are added when it is sent.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="acq-btn acq-btn-sm" disabled={!campaignId || sending} onClick={() => void sendTest()} title={campaignId ? undefined : 'Create the campaign first'}>{sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send me this email as a test</button>
            {!campaignId && <span className="acq-faint" style={{ fontSize: 12 }}>Available once the campaign is created.</span>}
            {sendNote && <span style={{ fontSize: 12.5, color: 'var(--brand-ink)' }}>{sendNote}</span>}
          </div>
        </section>

        <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <h3 className="acq-title" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><MessageSquare size={17} style={{ color: 'var(--brand)' }} /> Reply preview</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PLAY_ORDER.map((c) => <button key={c} className={`acq-chip${replyClass === c ? ' on' : ''}`} style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setReplyClass(c)}>{PLAY_LABEL[c].replace(/^Replies: /, '')}</button>)}
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px', fontSize: 13.5 }}><b style={{ fontSize: 12, color: 'var(--sub)', display: 'block', marginBottom: 4 }}>{name || 'They'} reply</b>&ldquo;{sampleReply[replyClass]}&rdquo;</div>
          <p className="acq-pill acq-pill-purple" style={{ justifySelf: 'start', whiteSpace: 'normal', height: 'auto', padding: '4px 10px' }}>{ACTION_LABEL[PLAY_ACTION[replyClass]]}</p>
          {answer
            ? <div className="acq-mail-preview"><header><span>Drafted in your Inbox for you to check and send</span><b>Re: {subject}</b></header><pre>{answer}</pre></div>
            : <p className="acq-sub" style={{ fontSize: 13 }}>Nothing is sent for this kind of reply.</p>}
        </section>
      </div>
    </div>
  );
}
