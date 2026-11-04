import { describe, it, expect } from 'vitest';
import { WORKFORCE, summariseWorkforce, asAgentId } from '@/lib/workforce';

const NOW = Date.parse('2026-11-04T12:00:00Z');
const row = (agent: string, hoursAgo: number, action = 'did something') => ({ id: `${agent}${hoursAgo}`, agent, action, detail: null, campaignId: null, createdAt: new Date(NOW - hoursAgo * 3_600_000) });

describe('workforce', () => {
  it('always shows the six agents, in order', () => {
    expect(WORKFORCE.map((w) => w.name)).toEqual([
      'Campaign Strategist', 'Audience Intelligence Agent', 'Campaign Content Agent', 'Outreach Agent', 'Follow-up Agent', 'Reply Intelligence Agent',
    ]);
    expect(summariseWorkforce([], NOW)).toHaveLength(6);
  });
  it('is idle with no rows, and does not invent activity', () => {
    for (const a of summariseWorkforce([], NOW)) { expect(a.active).toBe(false); expect(a.week).toBe(0); expect(a.latest).toBeNull(); }
  });
  it('reports the latest action, the weekly count and whether it acted in the last day', () => {
    const a = summariseWorkforce([row('outreach', 2, 'newest'), row('outreach', 30, 'older'), row('outreach', 24 * 9), row('reply', 50)], NOW);
    const out = a.find((x) => x.id === 'outreach')!;
    expect(out.latest?.action).toBe('newest');
    expect(out.week).toBe(2);
    expect(out.active).toBe(true);
    expect(a.find((x) => x.id === 'reply')!.active).toBe(false);
  });
  it('maps unknown agent ids to the reply agent', () => {
    expect(asAgentId('outreach')).toBe('outreach');
    expect(asAgentId('nope')).toBe('reply');
  });
});
