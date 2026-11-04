/**
 * Baseline: pins the guard clauses of the existing Ava/Rex task handlers
 * (src/lib/tasks/handlers.ts). Composition and detection are mocked — this
 * covers the hand-off rules, not message content.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rows, seed } from '../helpers/fakePrisma';

const m = vi.hoisted(() => ({
  detectOpportunities: vi.fn(),
  composeOutreach: vi.fn(),
  checkAndIncrementAIForUser: vi.fn(),
}));
vi.mock('@/lib/opportunity/detect', () => ({ detectOpportunities: m.detectOpportunities }));
vi.mock('@/lib/outreach/compose', () => ({ composeOutreach: m.composeOutreach }));
vi.mock('@/lib/usage', () => ({ checkAndIncrementAIForUser: m.checkAndIncrementAIForUser }));

import { handlers } from '@/lib/tasks/handlers';

const ctx = (prospectId: string | null) => ({ taskId: 't1', userId: 'u1', prospectId, input: {} });

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
});

describe('detect_opportunity', () => {
  it('skips when the prospect is missing', async () => {
    expect(await handlers.detect_opportunity(ctx('nope'))).toEqual({ status: 'skipped', output: { reason: 'prospect_missing' } });
  });

  it('does not load another user’s prospect', async () => {
    seed('prospect', { id: 'p1', userId: 'someone_else', businessName: 'X', businessData: {} });
    expect((await handlers.detect_opportunity(ctx('p1'))).output).toEqual({ reason: 'prospect_missing' });
  });

  it('stops the chain when there is no opportunity', async () => {
    seed('prospect', { id: 'p1', userId: 'u1', businessName: 'X', businessData: {} });
    m.detectOpportunities.mockReturnValue({ primary: null, all: [], signals: [] });
    const out = await handlers.detect_opportunity(ctx('p1'));
    expect(out).toEqual({ status: 'skipped', output: { reason: 'no_opportunity' } });
    expect(rows('agentActivity')).toHaveLength(0);
  });

  it('records the opportunity and hands off to draft_outreach', async () => {
    seed('prospect', { id: 'p1', userId: 'u1', businessName: 'Smile Dental', businessData: {} });
    const primary = { type: 'website', title: 'Website', reason: 'No site', score: 80, confidence: 'high' };
    m.detectOpportunities.mockReturnValue({ primary, all: [primary], signals: [{ code: 'no_website' }] });
    const out = await handlers.detect_opportunity(ctx('p1'));
    expect(out.status).toBe('completed');
    expect(out.next).toEqual([{ type: 'draft_outreach', prospectId: 'p1' }]);
    expect(rows('agentActivity')[0]).toMatchObject({ agentKey: 'research', action: 'opportunity_flagged' });
    expect(rows('prospectMemory')[0]).toMatchObject({ kind: 'opportunity', source: 'ava_detection' });
  });
});

describe('draft_outreach', () => {
  it('skips an already-contacted prospect', async () => {
    seed('prospect', { id: 'p1', userId: 'u1', businessName: 'X', businessData: {}, outreachSentAt: new Date() });
    expect((await handlers.draft_outreach(ctx('p1'))).output).toEqual({ reason: 'already_contacted' });
  });

  it('skips when a pending draft exists', async () => {
    seed('prospect', { id: 'p1', userId: 'u1', businessName: 'X', businessData: {} });
    seed('outreachDraft', { prospectId: 'p1', status: 'pending' });
    expect((await handlers.draft_outreach(ctx('p1'))).output).toEqual({ reason: 'draft_exists' });
  });

  it('skips when the AI quota is used up, without composing', async () => {
    seed('prospect', { id: 'p1', userId: 'u1', businessName: 'X', businessData: {} });
    seed('user', { id: 'u1', plan: 'pro' });
    m.checkAndIncrementAIForUser.mockResolvedValue({ ok: false });
    expect((await handlers.draft_outreach(ctx('p1'))).output).toEqual({ reason: 'ai_quota_reached' });
    expect(m.composeOutreach).not.toHaveBeenCalled();
  });

  it('parks a pending WhatsApp draft and never sends', async () => {
    seed('prospect', { id: 'p1', userId: 'u1', businessName: 'X', businessData: {} });
    seed('user', { id: 'u1', plan: 'pro' });
    m.checkAndIncrementAIForUser.mockResolvedValue({ ok: true });
    m.composeOutreach.mockResolvedValue({ whatsapp: 'Hi', emailSubject: 's', emailBody: 'b', framework: 'PAS' });
    const out = await handlers.draft_outreach(ctx('p1'));
    expect(out.status).toBe('completed');
    expect(rows('outreachDraft')[0]).toMatchObject({ channel: 'whatsapp', status: 'pending', whatsapp: 'Hi' });
  });
});
