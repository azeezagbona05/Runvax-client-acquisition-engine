import { beforeEach, describe, expect, it, vi } from 'vitest';

let stored: { secrets: Record<string, string>; metaObj: Record<string, unknown> } | null = null; let suspended = false;
vi.mock('@/lib/integrations/store', () => ({
  getConnection: async () => stored,
  saveConnection: async (_u: string, _p: string, secrets: Record<string, string>, meta: Record<string, unknown>) => { stored = { secrets, metaObj: meta }; },
  removeConnection: async () => { stored = null; },
}));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: async () => ({ isSuspended: suspended }) }, integrationConnection: { updateMany: async () => ({}) } } }));

import { createMcpToken, mcpTokenStatus, revokeMcpToken, verifyMcpToken } from '@/lib/mcp/token';
beforeEach(() => { stored = null; suspended = false; });

describe('Claude tokens', () => {
  it('a new token works, and only its fingerprint is stored', async () => {
    const t = await createMcpToken('cmw6yo1fd00006h0dm93zfj9r');
    expect(t).toMatch(/^rvx_cmw6yo1fd00006h0dm93zfj9r_[A-Za-z0-9_-]{40,}$/);
    expect(JSON.stringify(stored)).not.toContain(t); expect(stored!.secrets.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyMcpToken(t)).toBe('cmw6yo1fd00006h0dm93zfj9r'); expect(await verifyMcpToken(`Bearer ${t}`)).toBe('cmw6yo1fd00006h0dm93zfj9r');
    expect((await mcpTokenStatus('x')).connected).toBe(true);
  });
  it('wrong, altered, empty and someone else\'s tokens are refused', async () => {
    const t = await createMcpToken('cmw6yo1fd00006h0dm93zfj9r');
    for (const bad of [null, undefined, '', 'Bearer', 'rvx_x_y', t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A'), t.replace('cmw6yo1fd00006h0dm93zfj9r', 'cmw6yo1fd00006h0dm93zfj9s')]) expect(await verifyMcpToken(bad as string), String(bad)).toBeNull();
  });
  it('making a new token retires the old one, and revoking stops them all', async () => {
    const a = await createMcpToken('cmw6yo1fd00006h0dm93zfj9r'); const b = await createMcpToken('cmw6yo1fd00006h0dm93zfj9r');
    expect(await verifyMcpToken(a)).toBeNull(); expect(await verifyMcpToken(b)).toBe('cmw6yo1fd00006h0dm93zfj9r');
    await revokeMcpToken('cmw6yo1fd00006h0dm93zfj9r'); expect(await verifyMcpToken(b)).toBeNull(); expect((await mcpTokenStatus('x')).connected).toBe(false);
  });
  it('a suspended account cannot use its token', async () => {
    const t = await createMcpToken('cmw6yo1fd00006h0dm93zfj9r'); suspended = true; expect(await verifyMcpToken(t)).toBeNull();
  });
});
