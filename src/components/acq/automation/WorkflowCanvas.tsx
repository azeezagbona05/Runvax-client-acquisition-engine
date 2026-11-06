'use client';

import { useMemo, useState } from 'react';
import { Ban, Bell, CalendarClock, Check, CircleStop, Clock, CornerDownRight, GitBranch, HelpCircle, Inbox, Mail, MailOpen, Minus, Plus, RotateCcw, ShieldCheck, ThumbsDown, UserPlus, Zap } from 'lucide-react';
import type { Automation } from '@/lib/automation';
import { buildFlow, type FlowNode, type FlowRow } from '@/lib/workflowGraph';

const ICON: Record<string, typeof Mail> = {
  start: UserPlus, reply: Inbox, sort: GitBranch, end: Check,
  p_interested: Bell, p_meeting_request: CalendarClock, p_info_request: HelpCircle, p_objection: MailOpen,
  p_not_interested: ThumbsDown, p_out_of_office: RotateCcw, p_unsubscribe: Ban, p_other: Mail,
};
const KIND_ICON: Record<string, typeof Mail> = { email: Mail, wait: Clock, decision: GitBranch, stop: CircleStop, end: Check, trigger: Zap, reply: Inbox, play: Mail };

interface Props {
  auto: Automation;
  /** Nodes the test run has passed through. */
  lit?: Set<string>;
  /** The node the test run is on now. */
  current?: string | null;
  selected?: string | null;
  onSelect?: (id: string) => void;
  /** Play the build-in animation (nodes appear one after another). */
  animate?: boolean;
}

/** The campaign as a flow chart: every email, wait and decision, the branches, the reply handling and the out-of-office loop. */
export default function WorkflowCanvas({ auto, lit, current, selected, onSelect, animate = true }: Props) {
  const flow = useMemo(() => buildFlow(auto), [auto]);
  const [zoom, setZoom] = useState(1);
  const testing = !!lit && lit.size > 0;
  let seq = 0;

  const node = (n: FlowNode, extra?: string) => {
    const Icon = ICON[n.id] ?? KIND_ICON[n.kind] ?? Mail;
    const state = current === n.id ? ' current' : lit?.has(n.id) ? ' lit' : testing ? ' dim' : '';
    return (
      <button type="button" key={n.id} className={`acq-flow-node k-${n.kind}${n.variant ? ' variant' : ''}${selected === n.id ? ' selected' : ''}${state}${animate ? ' appear' : ''}${extra ? ` ${extra}` : ''}`}
        style={{ ['--i' as string]: seq++ }} onClick={() => onSelect?.(n.id)} aria-label={`${n.title}${n.detail ? `: ${n.detail}` : ''}`}>
        <span className="acq-flow-icon"><Icon size={15} /></span>
        <span className="acq-flow-text">
          <b>{n.title}{n.day ? <span className="acq-flow-day">Day {n.day}</span> : null}</b>
          {n.detail && <span>{n.detail}</span>}
        </span>
      </button>
    );
  };
  const link = (label?: string, cls = '') => <div className={`acq-flow-link${cls ? ` ${cls}` : ''}`} aria-hidden>{label && <i>{label}</i>}</div>;

  // The row after "Did they reply?" is the "No" path.
  const afterDecision = (k: number) => { const p = flow.rows[k - 1]; return !!p && p.type === 'node' && p.node.kind === 'decision' && !!p.branch; };
  const row = (r: FlowRow, k: number) => {
    if (r.type === 'node') {
      return (
        <div key={k} className="acq-flow-row">
          {k > 0 && link(afterDecision(k) ? 'No' : undefined)}
          <div className="acq-flow-line">
            {node(r.node)}
            {r.branch && (
              <span className={`acq-flow-branch${lit?.has('reply') && lit?.has(r.node.id) ? ' lit' : ''}${animate ? ' appear' : ''}`} style={{ ['--i' as string]: seq++ }}>
                <i>{r.branch.label}</i><CornerDownRight size={13} />{r.branch.text}
              </span>
            )}
          </div>
        </div>
      );
    }
    return (
      <div key={k} className="acq-flow-row">
        {link(afterDecision(k) ? 'No' : undefined, 'split')}
        <div className="acq-flow-split">
          <div><span className="acq-flow-tag yes">{r.yes.label}</span>{node(r.yes.node)}</div>
          <div><span className="acq-flow-tag no">{r.no.label}</span>{node(r.no.node)}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="acq-flow">
      <div className="acq-flow-tools">
        <span className="acq-flow-legend"><i className="lg-email" />Email<i className="lg-wait" />Wait<i className="lg-decision" />Decision<i className="lg-stop" />Stop<i className="lg-loop" />Loop</span>
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <button type="button" className="acq-icon-btn" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(1)))}><Minus size={14} /></button>
          <span className="acq-faint" style={{ fontSize: 12, minWidth: 40, textAlign: 'center', alignSelf: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button type="button" className="acq-icon-btn" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.3, +(z + 0.1).toFixed(1)))}><Plus size={14} /></button>
        </span>
      </div>
      <div className="acq-flow-canvas">
        <div className="acq-flow-board" style={{ zoom }}>
          <section className="acq-flow-lane" aria-label="Main sequence">
            <h3>Main sequence</h3>
            {flow.rows.map(row)}
          </section>
          <section className="acq-flow-lane replies" aria-label="Reply handling">
            <h3>Reply handling</h3>
            {node(flow.replies[0])}
            {link()}
            {node(flow.replies[1])}
            {link(undefined, 'split')}
            <div className="acq-flow-plays">
              {flow.replies.slice(2).map((p) => node(p, p.id === 'p_out_of_office' ? 'loop' : p.id === 'p_unsubscribe' ? 'k-stop' : ''))}
            </div>
            <div className={`acq-flow-loop${lit?.has('p_out_of_office') ? ' lit' : ''}`}><RotateCcw size={14} /> Out-of-office loops back: after {flow.loopDays} days the lead returns to the main sequence at the next email.</div>
            <div className="acq-flow-guard"><ShieldCheck size={14} /> Always, at any step: an unsubscribe, a bounce, a booked meeting or a deal marked won or lost ends the sequence.</div>
          </section>
        </div>
      </div>
    </div>
  );
}
