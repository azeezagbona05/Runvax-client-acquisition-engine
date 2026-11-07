'use client';

import { useMemo, useRef, useState } from 'react';
import { Ban, Bell, CalendarClock, Check, CircleStop, Clock, CornerDownRight, GitBranch, GripVertical, HelpCircle, Inbox, Mail, MailOpen, Minus, Plus, RotateCcw, ShieldCheck, ThumbsDown, UserPlus, Zap } from 'lucide-react';
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
  /** Lets emails be dragged to reorder, the canvas be dragged to pan, and an email be added. */
  editable?: boolean;
  onReorder?: (from: number, to: number) => void;
  onAdd?: () => void;
  canAdd?: boolean;
}

/** The campaign as a flow chart: every email, wait and decision, the branches, the reply handling and the out-of-office loop. */
export default function WorkflowCanvas({ auto, lit, current, selected, onSelect, animate = true, editable = false, onReorder, onAdd, canAdd = false }: Props) {
  const flow = useMemo(() => buildFlow(auto), [auto]);
  const [zoom, setZoom] = useState(1);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; y: number; l: number; t: number } | null>(null);
  const testing = !!lit && lit.size > 0;
  let seq = 0;

  const node = (n: FlowNode, extra?: string) => {
    const Icon = ICON[n.id] ?? KIND_ICON[n.kind] ?? Mail;
    const state = current === n.id ? ' current' : lit?.has(n.id) ? ' lit' : testing ? ' dim' : '';
    const drag = editable && n.kind === 'email' && n.index !== undefined;
    const reset = () => { setDragFrom(null); setOver(null); };
    return (
      <button type="button" key={n.id} className={`acq-flow-node k-${n.kind}${n.variant ? ' variant' : ''}${selected === n.id ? ' selected' : ''}${state}${animate ? ' appear' : ''}${extra ? ` ${extra}` : ''}${drag ? ' draggable' : ''}${drag && dragFrom === n.index ? ' dragging' : ''}${over === n.id ? ' drop-here' : ''}`}
        style={{ ['--i' as string]: seq++ }} onClick={() => onSelect?.(n.id)} aria-label={`${n.title}${n.detail ? `: ${n.detail}` : ''}`}
        draggable={drag || undefined}
        onDragStart={drag ? (e) => { e.dataTransfer.setData('text/plain', String(n.index)); e.dataTransfer.effectAllowed = 'move'; setDragFrom(n.index!); } : undefined}
        onDragEnd={drag ? reset : undefined}
        onDragOver={drag && dragFrom !== null ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== n.id) setOver(n.id); } : undefined}
        onDragLeave={drag ? () => setOver((o) => (o === n.id ? null : o)) : undefined}
        onDrop={drag ? (e) => { e.preventDefault(); const from = dragFrom ?? Number(e.dataTransfer.getData('text/plain')); reset(); if (Number.isInteger(from) && n.index !== undefined) onReorder?.(from, n.index); } : undefined}>
        {drag && <GripVertical size={14} className="acq-flow-grip" aria-hidden />}
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
          {editable && canAdd && r.node.id === 'end' && (<>{link()}<button type="button" className="acq-flow-add" onClick={() => onAdd?.()}><Plus size={14} /> Add an email</button></>)}
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
      <div className="acq-flow-canvas" ref={canvas} style={editable ? { cursor: pan.current ? 'grabbing' : 'grab' } : undefined}
        onPointerDown={editable ? (e) => { if ((e.target as HTMLElement).closest('.acq-flow-node, button, a, input, select, textarea')) return; const c = canvas.current; if (!c) return; pan.current = { x: e.clientX, y: e.clientY, l: c.scrollLeft, t: c.scrollTop }; c.setPointerCapture(e.pointerId); } : undefined}
        onPointerMove={editable ? (e) => { const p = pan.current, c = canvas.current; if (!p || !c) return; c.scrollLeft = p.l - (e.clientX - p.x); c.scrollTop = p.t - (e.clientY - p.y); } : undefined}
        onPointerUp={editable ? () => { pan.current = null; } : undefined} onPointerCancel={editable ? () => { pan.current = null; } : undefined}>
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
