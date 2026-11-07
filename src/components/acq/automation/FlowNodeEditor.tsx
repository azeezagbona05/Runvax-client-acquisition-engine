'use client';

import { useEffect } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { MAX_WAIT_DAYS, SEND_IF_LABEL, dayNumbers, type Automation, type SendIf } from '@/lib/automation';
import { addEmailAfter, canAddEmail, emailIndexOfNode, moveEmail, removeEmail, updateEmail } from '@/lib/workflowEdit';

const SEND_IFS = Object.keys(SEND_IF_LABEL) as SendIf[];
const label = { fontSize: 12.5, fontWeight: 600, color: '#64748b', marginBottom: 6, display: 'block' } as const;
const DAYS = Array.from({ length: MAX_WAIT_DAYS }, (_, i) => i + 1);

/** Edits one step of the workflow: an email, a wait, or the condition for an email. Changes apply as you type. */
export default function FlowNodeEditor({ auto, nodeId, onChange, onClose, onOpenReplies }: {
  auto: Automation; nodeId: string; onChange: (next: Automation, selectNode?: string) => void; onClose: () => void; onOpenReplies: () => void;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  const i = emailIndexOfNode(nodeId);
  const email = i !== null ? auto.emails[i] : undefined;
  const kind = nodeId.charAt(0);
  const days = dayNumbers(auto);

  let title = 'This step';
  let body: React.ReactNode = null;

  if (email && i !== null && (kind === 'e')) {
    title = i === 0 ? 'Email 1: Introduction' : `Email ${i + 1}: Follow-up`;
    body = (
      <div style={{ display: 'grid', gap: 14 }}>
        <div><label style={label} htmlFor="fne-subject">Subject</label><input id="fne-subject" className="acq-input" maxLength={190} value={email.subject} onChange={(e) => onChange(updateEmail(auto, i, { subject: e.target.value }))} /></div>
        <div><label style={label} htmlFor="fne-body">Email</label><textarea id="fne-body" className="acq-textarea" rows={9} value={email.body} onChange={(e) => onChange(updateEmail(auto, i, { body: e.target.value }))} />
          <p className="acq-faint" style={{ fontSize: 12, marginTop: 4 }}>Placeholders: {'{{name}}'} (first name), {'{{business}}'}, {'{{website}}'}. A signature and an unsubscribe link are added automatically.</p></div>
        {i > 0 && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div><label style={label} htmlFor="fne-wait">Wait after the previous email</label>
              <select id="fne-wait" className="acq-select" style={{ width: 'auto' }} value={email.waitDays} onChange={(e) => onChange(updateEmail(auto, i, { waitDays: Number(e.target.value) }))}>{DAYS.map((d) => <option key={d} value={d}>{d} day{d === 1 ? '' : 's'}</option>)}</select></div>
            <div style={{ flex: '1 1 220px' }}><label style={label} htmlFor="fne-if">Send it if</label>
              <select id="fne-if" className="acq-select" value={email.sendIf} onChange={(e) => onChange(updateEmail(auto, i, { sendIf: e.target.value as SendIf }))}>{SEND_IFS.map((v) => <option key={v} value={v}>{SEND_IF_LABEL[v]}</option>)}</select></div>
          </div>
        )}
        {i > 0 && (
          <div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
              <input type="checkbox" style={{ accentColor: '#9333ea' }} checked={!!email.openedVariant} onChange={(e) => onChange(updateEmail(auto, i, { openedVariant: e.target.checked ? { subject: email.subject, body: email.body } : undefined }))} />
              Different wording for people who opened an earlier email but did not reply
            </label>
            {email.openedVariant && (
              <div style={{ display: 'grid', gap: 10, marginTop: 10, paddingLeft: 12, borderLeft: '3px solid #bae6fd' }}>
                <div><label style={label} htmlFor="fne-vsubject">Subject (opened version)</label><input id="fne-vsubject" className="acq-input" maxLength={190} value={email.openedVariant.subject} onChange={(e) => onChange(updateEmail(auto, i, { openedVariant: { ...email.openedVariant!, subject: e.target.value } }))} /></div>
                <div><label style={label} htmlFor="fne-vbody">Email (opened version)</label><textarea id="fne-vbody" className="acq-textarea" rows={6} value={email.openedVariant.body} onChange={(e) => onChange(updateEmail(auto, i, { openedVariant: { ...email.openedVariant!, body: e.target.value } }))} /></div>
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
          <button type="button" className="acq-btn acq-btn-sm" disabled={i === 0} onClick={() => onChange(moveEmail(auto, i, i - 1), `e${i - 1}`)}><ArrowUp size={14} /> Earlier</button>
          <button type="button" className="acq-btn acq-btn-sm" disabled={i === auto.emails.length - 1} onClick={() => onChange(moveEmail(auto, i, i + 1), `e${i + 1}`)}><ArrowDown size={14} /> Later</button>
          <button type="button" className="acq-btn acq-btn-sm" disabled={!canAddEmail(auto)} onClick={() => onChange(addEmailAfter(auto, i), `e${i + 1}`)}><Plus size={14} /> Add one after</button>
          <button type="button" className="acq-btn acq-btn-sm" style={{ color: '#b91c1c', marginLeft: 'auto' }} disabled={auto.emails.length <= 1} onClick={() => { if (window.confirm('Remove this email from the sequence?')) { onChange(removeEmail(auto, i)); onClose(); } }}><Trash2 size={14} /> Remove</button>
        </div>
      </div>
    );
  } else if (email && i !== null && kind === 'w') {
    title = `Wait before email ${i + 1}`;
    body = (
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={label} htmlFor="fne-wait2">How long to wait after the previous email</label>
        <select id="fne-wait2" className="acq-select" style={{ width: 'auto' }} value={email.waitDays} onChange={(e) => onChange(updateEmail(auto, i, { waitDays: Number(e.target.value) }))}>{DAYS.map((d) => <option key={d} value={d}>{d} day{d === 1 ? '' : 's'}</option>)}</select>
        <p className="acq-sub" style={{ fontSize: 13.5 }}>Email {i + 1} goes out on Day {days[i]}, on weekdays between {auto.windowStart}:00 and {auto.windowEnd}:00.</p>
      </div>
    );
  } else if (email && i !== null && (kind === 'o' || kind === 'x')) {
    title = `When email ${i + 1} is sent`;
    body = (
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={label} htmlFor="fne-if2">Send email {i + 1} if</label>
        <select id="fne-if2" className="acq-select" value={email.sendIf} onChange={(e) => onChange(updateEmail(auto, i, { sendIf: e.target.value as SendIf }))}>{SEND_IFS.map((v) => <option key={v} value={v}>{SEND_IF_LABEL[v]}</option>)}</select>
        <p className="acq-sub" style={{ fontSize: 13.5 }}>Anyone who does not match stops here and gets no more emails.</p>
      </div>
    );
  } else if (email && i !== null && kind === 'r') {
    title = 'Did they reply?';
    body = (
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5 }}>
        <input type="checkbox" style={{ accentColor: '#9333ea', marginTop: 3 }} checked={auto.stopOnReply} onChange={(e) => onChange({ ...auto, stopOnReply: e.target.checked })} />
        <span>Stop the follow-ups as soon as someone replies. <span className="acq-sub">Recommended: nobody gets a follow-up after they have answered.</span></span>
      </label>
    );
  } else if (nodeId === 'start' || nodeId === 'end') {
    title = nodeId === 'start' ? 'Lead added to the campaign' : 'Sequence finished';
    body = <p className="acq-sub" style={{ fontSize: 14 }}>{nodeId === 'start' ? 'The sequence starts when a lead is added and you press Run. Unsubscribed and bounced addresses are skipped.' : 'After the last email, nothing more is sent. The contact stays in your leads.'} Nothing to change here.</p>;
  } else {
    title = 'Reply handling';
    body = (
      <div style={{ display: 'grid', gap: 10 }}>
        <p className="acq-sub" style={{ fontSize: 14 }}>What happens when someone replies is set in the Reply playbook.</p>
        <button type="button" className="acq-btn acq-btn-primary" style={{ justifySelf: 'start' }} onClick={() => { onClose(); onOpenReplies(); }}>Open the Reply playbook</button>
      </div>
    );
  }

  return (
    <div className="acq-modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="acq-modal" role="dialog" aria-modal="true" aria-label={`Edit: ${title}`} style={{ padding: 20, maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h2 className="acq-title" style={{ fontSize: 18 }}>{title}</h2>
          <button type="button" className="acq-icon-btn" aria-label="Close editor" onClick={onClose}><X size={18} /></button>
        </div>
        {body}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><button type="button" className="acq-btn acq-btn-primary" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
