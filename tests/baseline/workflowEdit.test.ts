import { describe, it, expect } from 'vitest';
import { addEmailAfter, canAddEmail, emailIndexOfNode, moveEmail, removeEmail, updateEmail } from '@/lib/workflowEdit';
import { MAX_EMAILS, dayNumbers, type Automation } from '@/lib/automation';
import { planFromGoal } from '@/lib/campaignBuilder';

const base = (): Automation => {
  const a = planFromGoal('I want to sell AI agents to dental clinics, 4 emails', null).automation;
  return { ...a, emails: a.emails.slice(0, 4).map((e, i) => ({ ...e, subject: `S${i}`, body: `B${i}`, waitDays: i === 0 ? 0 : i + 1, sendIf: i === 2 ? 'not_opened' : 'no_reply', openedVariant: i === 1 ? { subject: 'OV', body: 'OB' } : undefined })) };
};

describe('which email a chart node belongs to', () => {
  it('reads the index from any node of an email', () => {
    expect(['e0', 'e3', 'e2v', 'w1', 'r2', 'o3', 'x4'].map(emailIndexOfNode)).toEqual([0, 3, 2, 1, 2, 3, 4]);
    for (const id of ['start', 'end', 'reply', 'sort', 'p_interested']) expect(emailIndexOfNode(id), id).toBeNull();
  });
});

describe('editing the sequence', () => {
  it('updates one email and leaves the others', () => {
    const a = updateEmail(base(), 2, { subject: 'New subject' });
    expect(a.emails.map((e) => e.subject)).toEqual(['S0', 'S1', 'New subject', 'S3']);
  });
  it('keeps the first email an introduction whatever is typed', () => {
    const a = updateEmail(base(), 0, { waitDays: 9, sendIf: 'clicked', openedVariant: { subject: 'x', body: 'y' } });
    expect(a.emails[0]).toMatchObject({ waitDays: 0, sendIf: 'no_reply' });
    expect(a.emails[0].openedVariant).toBeUndefined();
  });
  it('clamps the wait between 1 and 30 days for follow-ups', () => {
    expect(updateEmail(base(), 1, { waitDays: 0 }).emails[1].waitDays).toBe(1);
    expect(updateEmail(base(), 1, { waitDays: 99 }).emails[1].waitDays).toBe(30);
    expect(updateEmail(base(), 1, { waitDays: Number.NaN }).emails[1].waitDays).toBe(1);
  });
  it('dragging an email moves its wording and leaves the timing in the slots', () => {
    const a = moveEmail(base(), 3, 1);
    expect(a.emails.map((e) => e.subject)).toEqual(['S0', 'S3', 'S1', 'S2']);
    expect(a.emails.map((e) => e.waitDays)).toEqual([0, 2, 3, 4]);
    expect(a.emails.map((e) => e.sendIf)).toEqual(['no_reply', 'no_reply', 'not_opened', 'no_reply']);
    expect(a.emails[2].openedVariant).toEqual({ subject: 'OV', body: 'OB' }); // the wording takes its opened version with it
  });
  it('moving a follow-up to the front makes it the introduction, without its opened version', () => {
    const a = moveEmail(base(), 1, 0);
    expect(a.emails[0]).toMatchObject({ subject: 'S1', waitDays: 0, sendIf: 'no_reply' });
    expect(a.emails[0].openedVariant).toBeUndefined();
    expect(dayNumbers(a)[0]).toBe(1);
  });
  it('ignores moves that go nowhere or off the end', () => {
    const a = base();
    expect(moveEmail(a, 1, 1)).toBe(a); expect(moveEmail(a, -1, 2)).toBe(a); expect(moveEmail(a, 1, 9)).toBe(a);
  });
  it('adds a follow-up after an email, up to the limit', () => {
    const a = addEmailAfter(base(), 1);
    expect(a.emails).toHaveLength(5);
    expect(a.emails[2].subject).toBe('Re: {{subject}}');
    expect(canAddEmail(a)).toBe(false);
    expect(addEmailAfter(a, 1)).toBe(a);
    expect(a.emails.length).toBeLessThanOrEqual(MAX_EMAILS);
  });
  it('removes an email, never the last one, and a new first email becomes the introduction', () => {
    expect(removeEmail(base(), 2).emails.map((e) => e.subject)).toEqual(['S0', 'S1', 'S3']);
    const first = removeEmail(base(), 0);
    expect(first.emails[0]).toMatchObject({ subject: 'S1', waitDays: 0, sendIf: 'no_reply' });
    let one = base(); while (one.emails.length > 1) one = removeEmail(one, 0);
    expect(removeEmail(one, 0)).toBe(one);
  });
  it('does not change the original', () => {
    const a = base(); const copy = JSON.stringify(a);
    moveEmail(a, 3, 0); updateEmail(a, 1, { subject: 'z' }); addEmailAfter(a, 0); removeEmail(a, 1);
    expect(JSON.stringify(a)).toBe(copy);
  });
});
