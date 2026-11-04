'use client';

import { useMemo, useState } from 'react';
import { Loader2, RefreshCw, Target } from 'lucide-react';
import { PIPELINE, acquisitionStage, pipelineCounts } from '@/lib/replyIntel';
import { goalTarget, type CampaignBrief } from '@/lib/campaignBrief';
import { stageLabelsFor } from '@/lib/templateLibrary';
import { Card } from './ui';
import type { LeadDto } from './types';

/** Real numbers only: the funnel, the goal progress, a box to paste a reply, and a button that reads the mailbox. */
export default function CampaignPipeline({ leads, brief, onChanged }: { leads: LeadDto[]; brief: CampaignBrief | null; onChanged: () => Promise<void> }) {
  const [leadId, setLeadId] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'' | 'paste' | 'check'>('');
  const [msg, setMsg] = useState('');

  const rows = useMemo(() => leads.map((l) => ({ ...l, p: { replyClass: l.replyClass, sentAt: l.sentAt, openedAt: l.openedAt, clickedAt: l.clickedAt, repliedAt: l.repliedAt, outcome: l.outcome, stage: l.pipelineStage } })), [leads]);
  const counts = useMemo(() => pipelineCounts(rows.map((r) => r.p)), [rows]);
  const sent = useMemo(() => rows.filter((r) => r.sentAt), [rows]);

  const target = brief ? goalTarget(brief.goal) : null;
  // "Book 20 demos" counts demos; any other goal counts customers, the end of the pipeline.
  const wantsDemos = !!brief && /demo|meeting|call|book/i.test(brief.goal || brief.objective);
  const achieved = wantsDemos ? counts.reached.demo_booked : counts.reached.customer;

  const paste = async () => {
    setBusy('paste'); setMsg('');
    try {
      const res = await fetch('/api/client-acquisition/replies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId, text }) });
      const j = await res.json().catch(() => ({})) as { error?: string; replyClass?: string; stoppedSequence?: boolean };
      if (!res.ok) { setMsg(j.error ?? 'Could not file that reply.'); return; }
      setMsg(j.stoppedSequence ? 'Filed. Follow-ups to this contact have stopped. The suggested answer is in your Inbox.' : 'Filed. Follow-ups are paused for a few days. Nothing else to do.');
      setText(''); setLeadId(''); await onChanged();
    } catch { setMsg('Could not reach the server.'); } finally { setBusy(''); }
  };
  const check = async () => {
    setBusy('check'); setMsg('');
    try {
      const res = await fetch('/api/client-acquisition/replies/check', { method: 'POST' });
      const j = await res.json().catch(() => ({})) as { error?: string; replies?: number; scanned?: number };
      setMsg(res.ok ? `Looked at ${j.scanned ?? 0} recent message${j.scanned === 1 ? '' : 's'}: ${j.replies ?? 0} new repl${j.replies === 1 ? 'y' : 'ies'}.` : j.error ?? 'Could not check your mailbox.');
      await onChanged();
    } catch { setMsg('Could not check your mailbox.'); } finally { setBusy(''); }
  };

  const labels = stageLabelsFor(brief?.templateId);
  const max = Math.max(1, counts.reached.identified);
  return (
    <Card title="Acquisition pipeline" right={<button className="acq-btn acq-btn-sm" disabled={!!busy} onClick={() => void check()}>{busy === 'check' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Check my inbox</button>}>
      {target !== null && brief && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13.5, display: 'flex', gap: 6, alignItems: 'center' }}><Target size={14} style={{ color: '#9333ea' }} /><b>Goal: {brief.goal}</b> <span className="acq-sub">{achieved} of {target} so far</span></p>
          <div style={{ height: 8, background: '#f1f5f9', borderRadius: 999, marginTop: 6, overflow: 'hidden' }} role="progressbar" aria-valuenow={Math.min(achieved, target)} aria-valuemax={target}><div style={{ width: `${Math.min(100, (achieved / target) * 100)}%`, height: '100%', background: '#9333ea' }} /></div>
        </div>
      )}
      <div style={{ display: 'grid', gap: 8 }}>
        {PIPELINE.map((p) => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 48px', gap: 10, alignItems: 'center', fontSize: 13 }} title={p.hint}>
            <span>{labels[p.id]}</span>
            <div style={{ height: 10, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}><div style={{ width: `${(counts.reached[p.id] / max) * 100}%`, height: '100%', background: '#c084fc' }} /></div>
            <b style={{ textAlign: 'right' }}>{counts.reached[p.id]}</b>
          </div>
        ))}
      </div>
      <p className="acq-faint" style={{ fontSize: 12, marginTop: 8 }}>Each bar is the number of contacts who reached that stage or went beyond it.{counts.lost ? ` ${counts.lost} marked lost.` : ''}</p>

      <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14, display: 'grid', gap: 8 }}>
        <p style={{ fontWeight: 600, fontSize: 13.5 }}>Got a reply somewhere else? Paste it in.</p>
        <select className="acq-select" aria-label="Who replied" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
          <option value="">Choose who replied…</option>
          {sent.map((l) => <option key={l.id} value={l.id}>{l.business || l.name || l.email} ({l.email})</option>)}
        </select>
        <textarea className="acq-textarea" rows={3} aria-label="Their reply" placeholder="Paste what they wrote" value={text} onChange={(e) => setText(e.target.value)} />
        <div><button className="acq-btn acq-btn-primary acq-btn-sm" disabled={!leadId || !text.trim() || !!busy} onClick={() => void paste()}>{busy === 'paste' ? <Loader2 size={14} className="animate-spin" /> : null} File this reply</button></div>
        {msg && <p role="status" className="acq-sub" style={{ fontSize: 12.5 }}>{msg}</p>}
      </div>
    </Card>
  );
}
