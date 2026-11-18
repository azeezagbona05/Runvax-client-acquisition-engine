import { describe, it, expect } from 'vitest';
import { reachOut, buildQueue, type QueueContact } from '@/lib/crm/queue';

const NOW = new Date('2026-12-01T10:00:00Z').getTime(); const DAY = 86_400_000; const d = (n: number) => new Date(NOW + n * DAY);
const c = (over: Partial<QueueContact> = {}): QueueContact => ({ leadId: 'l1', business: 'Acme', name: null, email: 'a@x.com', stage: null, replyClass: null, outcome: null, repliedAt: null, unansweredReplyAt: null, openCount: 0, clickCount: 0, lastTouchAt: d(-1), unsubscribed: false, demoAt: null, appointmentOutcome: null, tasks: [], assigneeId: null, ...over });

describe('who to reach out to', () => {
  it('nothing happening means nobody to chase', () => expect(reachOut(c(), NOW)).toBeNull());
  it('a waiting reply from an interested contact is top priority, with its reason', () => {
    const r = reachOut(c({ replyClass: 'interested', repliedAt: d(-2), unansweredReplyAt: d(-2) }), NOW)!;
    expect(r.score).toBeGreaterThanOrEqual(100); expect(r.reasons[0]).toMatch(/Replied 2 day\(s\) ago and is waiting/); expect(r.action).toBe('Reply to them');
  });
  it('overdue task, passed meeting and missed meeting each surface with their own action', () => {
    expect(reachOut(c({ tasks: [{ title: 'Send proposal', dueAt: d(-1), doneAt: null }] }), NOW)).toMatchObject({ score: 90, action: 'Send proposal' });
    expect(reachOut(c({ demoAt: d(-1), stage: 'demo_booked' }), NOW)?.action).toMatch(/Record the outcome/);
    expect(reachOut(c({ demoAt: d(-3), appointmentOutcome: 'missed', stage: 'demo_booked' }), NOW)?.action).toMatch(/book again/);
  });
  it('a done task, a far-off task and a meeting next month do not count', () => {
    expect(reachOut(c({ tasks: [{ title: 't', dueAt: d(-1), doneAt: d(0) }, { title: 'later', dueAt: d(5), doneAt: null }], demoAt: d(30), stage: 'demo_booked' }), NOW)).toBeNull();
  });
  it('quiet engagement and stale proposals are lower priority than replies', () => {
    expect(reachOut(c({ openCount: 4 }), NOW)?.score).toBe(45);
    expect(reachOut(c({ stage: 'proposal_sent', lastTouchAt: d(-10) }), NOW)?.reasons[0]).toMatch(/10 days since the proposal/);
  });
  it('customers, lost, not interested and opted-out contacts are never chased', () => {
    const hot = { replyClass: 'interested', unansweredReplyAt: d(-1), repliedAt: d(-1) };
    for (const x of [{ stage: 'customer' }, { stage: 'lost' }, { replyClass: 'not_interested' }, { unsubscribed: true }]) expect(reachOut(c({ ...hot, ...x }), NOW), JSON.stringify(x)).toBeNull();
  });
  it('several true reasons raise the score a little; the queue is sorted and scoped to me plus unassigned', () => {
    const many = reachOut(c({ replyClass: 'interested', unansweredReplyAt: d(-1), repliedAt: d(-1), tasks: [{ title: 't', dueAt: d(-1), doneAt: null }] }), NOW)!;
    expect(many.score).toBe(103);
    const q = buildQueue([c({ leadId: 'a', openCount: 5, assigneeId: 'me' }), c({ leadId: 'b', openCount: 5, assigneeId: 'other' }), c({ leadId: 'c', replyClass: 'interested', unansweredReplyAt: d(0), repliedAt: d(0) })], { userId: 'me', scope: 'mine', now: NOW });
    expect(q.map((i) => i.leadId)).toEqual(['c', 'a']);
    expect(buildQueue([c({ leadId: 'b', openCount: 5, assigneeId: 'other' })], { userId: 'me', scope: 'all', now: NOW })).toHaveLength(1);
  });
});
