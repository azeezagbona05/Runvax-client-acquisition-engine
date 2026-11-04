import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => {
  const state = { lead: null as Record<string, unknown> | null, replies: [] as Record<string, unknown>[], updates: [] as Record<string, unknown>[], many: [] as Record<string, unknown>[], logs: [] as Record<string, unknown>[] };
  return {
    state,
    prisma: {
      outreachLead: {
        findFirst: async () => state.lead,
        update: async (a: { data: Record<string, unknown> }) => { state.updates.push(a.data); return {}; },
        updateMany: async (a: Record<string, unknown>) => { state.many.push(a); return { count: 1 }; },
      },
      campaignReply: {
        findFirst: async (a: { where: { messageId?: string } }) => state.replies.find((r) => r.messageId === a.where.messageId) ?? null,
        create: async (a: { data: Record<string, unknown> }) => { const r = { id: `r${state.replies.length + 1}`, ...a.data }; state.replies.push(r); return r; },
      },
      campaignLog: { create: async (a: { data: Record<string, unknown> }) => { state.logs.push(a.data); return {}; } },
    },
  };
});
vi.mock('@/lib/prisma', () => ({ prisma: db.prisma }));

import { ingestReply } from '@/lib/acqReplies';

const lead = { id: 'l1', campaignId: 'c1', email: 'dr@clinic.com', name: 'Dr Ada', business: 'Bright Dental', repliedAt: null, stage: null, campaign: { name: 'Dental AI Hub', automation: null } };

beforeEach(() => { db.state.lead = { ...lead }; db.state.replies = []; db.state.updates = []; db.state.many = []; db.state.logs = []; });

describe('ingestReply', () => {
  it('classifies the pricing question as interested/info, stops the sequence and notifies the owner', async () => {
    const notifyOwner = vi.fn(async () => undefined);
    const r = await ingestReply({ userId: 'u1', leadId: 'l1', text: 'Interesting. Can you send me more information about your pricing?', source: 'manual' }, { notifyOwner });
    expect(r.ok && ['info_request', 'interested'].includes(r.replyClass)).toBe(true);
    expect(r.ok && r.stoppedSequence).toBe(true);
    const u = db.state.updates[0];
    expect(u.repliedAt).toBeInstanceOf(Date);
    expect(u.outcome).toBe('interested');
    expect(notifyOwner).toHaveBeenCalledOnce();
    const reply = db.state.replies[0];
    expect(String(reply.suggestion)).not.toMatch(/[£$€]\s?\d/); // never invents a price
    expect(db.state.logs.some((l) => l.agent === 'reply')).toBe(true);
    expect(db.state.logs.some((l) => l.agent === 'followup')).toBe(true);
  });
  it('an unsubscribe request opts the contact out everywhere', async () => {
    const r = await ingestReply({ userId: 'u1', leadId: 'l1', text: 'Please remove me from your list.', source: 'manual' });
    expect(r.ok && r.replyClass).toBe('unsubscribe');
    expect(db.state.many).toHaveLength(1);
    expect(db.state.updates[0].outcome).toBe('not_interested');
  });
  it('an out-of-office reply only pauses follow-ups', async () => {
    const r = await ingestReply({ userId: 'u1', leadId: 'l1', text: 'I am out of the office until Monday with limited access to email.', source: 'inbox' });
    expect(r.ok && r.replyClass).toBe('out_of_office');
    expect(r.ok && r.stoppedSequence).toBe(false);
    expect(db.state.updates[0].repliedAt).toBeUndefined();
    expect(db.state.updates[0].pausedUntil).toBeInstanceOf(Date);
  });
  it('ignores a message it has already filed', async () => {
    await ingestReply({ userId: 'u1', leadId: 'l1', text: 'Yes please send details', source: 'inbox', messageId: '<m1@x>' });
    const again = await ingestReply({ userId: 'u1', leadId: 'l1', text: 'Yes please send details', source: 'inbox', messageId: '<m1@x>' });
    expect(again.ok && again.duplicate).toBe(true);
    expect(db.state.replies).toHaveLength(1);
  });
  it('rejects an unknown contact and an empty reply', async () => {
    expect((await ingestReply({ userId: 'u1', leadId: 'l1', text: '   ', source: 'manual' })).ok).toBe(false);
    db.state.lead = null;
    expect((await ingestReply({ userId: 'u1', leadId: 'nope', text: 'hi', source: 'manual' })).ok).toBe(false);
  });
  it('still files the reply if the owner email fails', async () => {
    const r = await ingestReply({ userId: 'u1', leadId: 'l1', text: 'Yes, interested, please send details', source: 'manual' }, { notifyOwner: async () => { throw new Error('smtp down'); } });
    expect(r.ok).toBe(true);
    expect(db.state.replies).toHaveLength(1);
  });
});
