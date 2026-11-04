import { describe, it, expect } from 'vitest';
import {
  PIPELINE, acquisitionStage, asReplyClass, classifyReplyRules, freshText, isPositive, needsSecondLook, pipelineCounts, STOPS_FOLLOW_UPS, STOPS_SEQUENCE, suggestReplyRules,
} from '@/lib/replyIntel';
import { emptyBrief } from '@/lib/campaignBrief';

const c = (t: string, s = '') => classifyReplyRules(t, s).replyClass;

describe('classifying replies', () => {
  it('reads the owner example: interest plus a pricing question is a request for information', () => {
    const r = classifyReplyRules('Interesting. Can you send me more information about your pricing?');
    expect(r.replyClass).toBe('info_request');
    expect(r.reason).toMatch(/pricing/);
    expect(isPositive(r.replyClass)).toBe(true);
  });
  it('covers every class the owner listed', () => {
    expect(c('Yes, this sounds great, please tell me more')).toBe('info_request');
    expect(c('Sounds good, I am interested.')).toBe('interested');
    expect(c('Can we schedule a demo next week?')).toBe('meeting_request');
    expect(c("It's too expensive for us right now")).toBe('objection');
    expect(c('We already use another system')).toBe('objection');
    expect(c('Not interested, thanks.')).toBe('not_interested');
    expect(c('I am out of the office until Monday')).toBe('out_of_office');
    expect(c('Please remove me from your list')).toBe('unsubscribe');
    expect(c('Who are you?')).toBe('other');
  });
  it('lets opt-outs and auto-replies win over positive words', () => {
    expect(c('Interested? No. Unsubscribe me.')).toBe('unsubscribe');
    expect(c('Thanks for your interest. I am on annual leave and will be back on the 12th.')).toBe('out_of_office');
  });
  it('does not mistake "not interested" or quoted history for interest', () => {
    expect(c('Not interested in a demo, thank you')).toBe('not_interested');
    expect(c('No thanks.\n\nOn Tue, 3 Nov 2026 at 10:00, Sam <sam@x.com> wrote:\n> Would you like a demo and the pricing?')).toBe('not_interested');
  });
  it('judges the subject too, and is unsure when it cannot tell', () => {
    expect(c('Thanks', 'Re: pricing question')).toBe('info_request');
    const other = classifyReplyRules('ok');
    expect(other.replyClass).toBe('other');
    expect(needsSecondLook(other)).toBe(true);
    expect(needsSecondLook(classifyReplyRules('Please unsubscribe me'))).toBe(false);
  });
  it('drops quoted history and signatures', () => {
    expect(freshText('Yes please\n\n> earlier text\n> more')).toBe('Yes please');
    expect(freshText('Great\nOn Mon, 2 Nov 2026 at 9:00 AM Sam wrote:\nold stuff')).toBe('Great');
  });
  it('validates classes from any source', () => {
    expect(asReplyClass('interested')).toBe('interested');
    expect(asReplyClass('hacked')).toBe('other');
    expect(asReplyClass(undefined)).toBe('other');
  });
  it('knows which replies stop the sequence', () => {
    expect(STOPS_SEQUENCE('interested')).toBe(true);
    expect(STOPS_SEQUENCE('not_interested')).toBe(true);
    expect(STOPS_SEQUENCE('out_of_office')).toBe(false);
    expect(STOPS_SEQUENCE(null)).toBe(false);
    expect(STOPS_FOLLOW_UPS).toEqual(['demo_booked', 'proposal_sent', 'customer', 'lost']);
  });
});

describe('suggested response', () => {
  const brief = { ...emptyBrief(), offer: 'Dental AI Hub: AI Patient Acquisition System', signOff: 'Dental AI Hub Team' };
  const mk = (replyClass: Parameters<typeof suggestReplyRules>[0]['replyClass'], replyText = 'x') => suggestReplyRules({ replyClass, replyText, leadName: 'Dr. Ada Obi', business: 'Bright Smile', brief });
  it('answers the pricing question honestly: no invented price, offers a walkthrough and a proposal', () => {
    const r = mk('info_request', 'Interesting. Can you send me more information about your pricing?');
    expect(r).toContain('Hello Ada,');
    expect(r).toMatch(/depends on the size of Bright Smile/);
    expect(r).toMatch(/walkthrough/);
    expect(r).toMatch(/proposal/);
    expect(r).not.toMatch(/[₦$£€]\s?\d|\d+\s?(naira|dollars|usd|ngn)/i);
    expect(r).toContain('Dental AI Hub Team');
  });
  it('writes a sensible draft for each class and never sends anything for opt-outs or auto-replies', () => {
    for (const k of ['meeting_request', 'interested', 'objection', 'not_interested', 'other'] as const) expect(mk(k)).toMatch(/Hello Ada,/);
    expect(mk('meeting_request')).toMatch(/calendar invite/);
    expect(mk('not_interested')).toMatch(/will not follow up again/);
    expect(mk('out_of_office')).toMatch(/No reply needed/);
    expect(mk('unsubscribe')).toMatch(/No reply needed/);
  });
  it('copes with no name, no business and no brief', () => {
    const r = suggestReplyRules({ replyClass: 'interested', replyText: 'yes' });
    expect(r).toContain('Hello there,');
    expect(r).toContain('your business');
  });
});

describe('the acquisition pipeline', () => {
  const t = new Date('2026-11-05T10:00:00Z');
  it('has the seven stages in the owner order', () => {
    expect(PIPELINE.map((p) => p.label)).toEqual(['Contact identified', 'Campaign contacted', 'Engaged', 'Interested', 'Demo booked', 'Proposal sent', 'Customer acquired']);
  });
  it('reads the stage from what happened', () => {
    expect(acquisitionStage({}).stage).toBe('identified');
    expect(acquisitionStage({ sentAt: t }).stage).toBe('contacted');
    expect(acquisitionStage({ sentAt: t, openedAt: t }).stage).toBe('engaged');
    expect(acquisitionStage({ sentAt: t, repliedAt: t, replyClass: 'objection' }).stage).toBe('engaged');
    expect(acquisitionStage({ sentAt: t, repliedAt: t, replyClass: 'info_request' }).stage).toBe('interested');
    expect(acquisitionStage({ sentAt: t, repliedAt: t, outcome: 'interested' }).stage).toBe('interested');
  });
  it('lets the sender move a prospect on, and mark one lost without forgetting how far they got', () => {
    expect(acquisitionStage({ sentAt: t, stage: 'demo_booked' }).stage).toBe('demo_booked');
    expect(acquisitionStage({ stage: 'customer' }).stage).toBe('customer');
    expect(acquisitionStage({ sentAt: t, stage: 'lost' })).toEqual({ stage: 'contacted', lost: true });
  });
  it('counts where everyone is and how many reached each stage', () => {
    const leads = [{}, { sentAt: t }, { sentAt: t, openedAt: t }, { sentAt: t, repliedAt: t, replyClass: 'interested' }, { sentAt: t, stage: 'demo_booked' }, { sentAt: t, stage: 'customer' }, { sentAt: t, stage: 'lost' }];
    const p = pipelineCounts(leads);
    expect(p.at).toEqual({ identified: 1, contacted: 1, engaged: 1, interested: 1, demo_booked: 1, proposal_sent: 0, customer: 1 });
    expect(p.lost).toBe(1);
    expect(p.reached.identified).toBe(6);
    expect(p.reached.interested).toBe(3);
    expect(p.reached.customer).toBe(1);
  });
});
