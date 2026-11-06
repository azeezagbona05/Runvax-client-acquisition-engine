/**
 * The campaign as a flow chart: the main sequence (emails, waits, decisions) and the reply-handling branch.
 * Pure, so the canvas, the test run and the tests share one picture of what the engine does.
 *
 * Node ids: start, e0 (first email), w{i} (wait before email i), r{i} (replied?), o{i} (opened?/clicked?),
 * e{i} (email i), e{i}v (email i, version for people who opened), x{i} (sequence ends here), end,
 * reply (a reply arrives), sort (it is classified), p_{class} (what happens for that class).
 */

import { SEND_IF_LABEL, dayNumbers, stepCopy, type Automation, type Scenario } from '@/lib/automation';
import { PLAY_ACTION, PLAY_LABEL, PLAY_ORDER, ACTION_LABEL } from '@/lib/replyPlaybook';
import type { ReplyClass } from '@/lib/replyIntel';

export type FlowKind = 'trigger' | 'email' | 'wait' | 'decision' | 'stop' | 'end' | 'reply' | 'play';

export interface FlowNode { id: string; kind: FlowKind; title: string; detail?: string; day?: number; index?: number; variant?: boolean }
/** One row of the main lane: a single node, or a decision's two outcomes side by side. */
export type FlowRow =
  | { type: 'node'; node: FlowNode; branch?: { label: string; to: string; text: string } }
  | { type: 'split'; yes: { label: string; node: FlowNode }; no: { label: string; node: FlowNode } };

export interface FlowGraph { rows: FlowRow[]; replies: FlowNode[]; loopDays: number }

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function buildFlow(a: Automation): FlowGraph {
  const days = dayNumbers(a);
  const rows: FlowRow[] = [];
  rows.push({ type: 'node', node: { id: 'start', kind: 'trigger', title: 'Lead added to the campaign', detail: 'Imported, found in Find Prospects or added by hand. Unsubscribed and bounced addresses are skipped.' } });
  rows.push({ type: 'node', node: { id: 'e0', kind: 'email', title: 'Email 1: Introduction', detail: a.emails[0].subject, day: days[0], index: 0 } });

  a.emails.slice(1).forEach((e, k) => {
    const i = k + 1;
    const last = i === a.emails.length - 1;
    const label = last ? `Email ${i + 1}: Final follow-up` : `Email ${i + 1}: Follow-up`;
    rows.push({ type: 'node', node: { id: `w${i}`, kind: 'wait', title: `Wait ${plural(e.waitDays, 'day')}`, detail: `Then Day ${days[i]}. Weekdays ${a.windowStart}:00 to ${a.windowEnd}:00.` } });
    rows.push({ type: 'node', node: { id: `r${i}`, kind: 'decision', title: 'Did they reply?' }, branch: { label: 'Yes', to: 'reply', text: 'Go to reply handling' } });
    const email = (variant: boolean): FlowNode => {
      const c = stepCopy(e, variant);
      return { id: variant ? `e${i}v` : `e${i}`, kind: 'email', title: variant ? `${label} (opened version)` : label, detail: c.subject, day: days[i], index: i, variant };
    };
    const stop: FlowNode = { id: `x${i}`, kind: 'stop', title: 'Sequence ends', detail: `Email ${i + 1} only goes to people who ${SEND_IF_LABEL[e.sendIf].toLowerCase().replace(/^they (have )?/, '')}.` };
    if (e.sendIf === 'no_reply') {
      if (e.openedVariant) rows.push({ type: 'split', yes: { label: 'Opened', node: email(true) }, no: { label: 'Not opened', node: email(false) } });
      else rows.push({ type: 'node', node: email(false) });
    } else {
      const q = e.sendIf === 'clicked' ? 'Did they click a link?' : 'Did they open it?';
      rows.push({ type: 'node', node: { id: `o${i}`, kind: 'decision', title: q } });
      const send = e.sendIf === 'not_opened' ? email(false) : email(!!e.openedVariant);
      rows.push(e.sendIf === 'not_opened'
        ? { type: 'split', yes: { label: 'Yes', node: stop }, no: { label: 'No', node: send } }
        : { type: 'split', yes: { label: 'Yes', node: send }, no: { label: 'No', node: stop } });
    }
  });
  rows.push({ type: 'node', node: { id: 'end', kind: 'end', title: 'Sequence finished', detail: 'No reply after every email. The contact stays in your leads, and nothing more is sent.' } });

  const pause = a.replyRules.outOfOfficePauseDays;
  const replies: FlowNode[] = [
    { id: 'reply', kind: 'reply', title: 'A reply arrives', detail: 'Read from your mailbox. Only messages from campaign contacts are looked at.' },
    { id: 'sort', kind: 'decision', title: 'What kind of reply is it?', detail: 'Sorted automatically. Unclear ones get a second look.' },
    ...PLAY_ORDER.map((c): FlowNode => ({
      id: `p_${c}`, kind: 'play', title: PLAY_LABEL[c],
      detail: c === 'out_of_office' ? `Pause ${plural(pause, 'day')}, then loop back to the next email` : ACTION_LABEL[PLAY_ACTION[c]],
    })),
  ];
  return { rows, replies, loopDays: pause };
}

export interface PathStep { id: string; note: string }

/** The nodes one imaginary lead passes through in a scenario, in order, with what happens at each. */
export function scenarioPath(a: Automation, scenario: Scenario): PathStep[] {
  const path: PathStep[] = [{ id: 'start', note: 'The lead is added to the campaign.' }, { id: 'e0', note: `Day 1: "${a.emails[0].subject}" goes out.` }];
  const days = dayNumbers(a);
  const opened = scenario === 'opens' || scenario === 'clicks';
  const clicked = scenario === 'clicks';
  const replyClass: ReplyClass | null = scenario === 'interested' ? 'interested' : scenario === 'not_interested' ? 'not_interested' : scenario === 'unsubscribe' ? 'unsubscribe' : scenario === 'out_of_office' ? 'out_of_office' : null;
  if (opened) path.push({ id: 'e0', note: clicked ? 'Day 2: they open it and click a link.' : 'Day 2: they open it, but do not reply.' });

  for (let i = 1; i < a.emails.length; i++) {
    const e = a.emails[i];
    path.push({ id: `w${i}`, note: `Waiting ${plural(e.waitDays, 'day')}.` });
    if (replyClass && i === 1) {
      path.push({ id: `r${i}`, note: replyClass === 'out_of_office' ? 'An out-of-office auto-reply arrives.' : 'They reply.' });
      path.push({ id: 'reply', note: 'The reply is read from your mailbox.' }, { id: 'sort', note: `Sorted as "${PLAY_LABEL[replyClass].replace(/^Replies: /, '')}".` });
      path.push({ id: `p_${replyClass}`, note: replyClass === 'out_of_office' ? `Follow-ups pause for ${plural(a.replyRules.outOfOfficePauseDays, 'day')}, then the sequence carries on.` : replyClass === 'unsubscribe' ? 'They are removed from every campaign and never emailed again.' : `${ACTION_LABEL[PLAY_ACTION[replyClass]]}.` });
      if (replyClass !== 'out_of_office') return path;
      path.push({ id: `w${i}`, note: 'Back from the pause: the lead loops back into the sequence.' });
    }
    path.push({ id: `r${i}`, note: 'No reply yet.' });
    const ok = e.sendIf === 'no_reply' || (e.sendIf === 'opened' && opened) || (e.sendIf === 'clicked' && clicked) || (e.sendIf === 'not_opened' && !opened);
    if (e.sendIf !== 'no_reply') path.push({ id: `o${i}`, note: ok ? 'The condition is met.' : 'The condition is not met.' });
    if (!ok) { path.push({ id: `x${i}`, note: `Email ${i + 1} is not sent, and the sequence ends.` }); return path; }
    const variant = opened && !!e.openedVariant;
    path.push({ id: variant ? `e${i}v` : `e${i}`, note: `Day ${days[i]}: "${stepCopy(e, variant).subject}" goes out${variant ? ' (the version for people who opened)' : ''}.` });
  }
  path.push({ id: 'end', note: 'Every email has been sent. The sequence is finished.' });
  return path;
}
