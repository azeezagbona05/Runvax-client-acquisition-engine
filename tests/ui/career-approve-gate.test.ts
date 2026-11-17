import { describe, it, expect, vi, afterEach } from 'vitest';
import { patchApplication } from '@/components/acq/career/Applications';

const resp = (status: number, body: object) => ({ ok: status < 400, status, json: async () => body }) as Response;
afterEach(() => vi.unstubAllGlobals());

describe('approve gate', () => {
  it('asks before approving past a shortfall, and retries with confirmGaps only if the candidate agrees', async () => {
    const f = vi.fn().mockResolvedValueOnce(resp(409, { error: 'x', needsConfirm: true, gaps: ['PMP certification'] })).mockResolvedValueOnce(resp(200, { ok: true }));
    vi.stubGlobal('fetch', f);
    const r = await patchApplication('a1', { action: 'approve' }, (g) => g.includes('PMP certification'));
    expect(r.error).toBeUndefined(); expect(f).toHaveBeenCalledTimes(2);
    expect(JSON.parse(f.mock.calls[1][1].body)).toMatchObject({ action: 'approve', confirmGaps: true });
  });
  it('does not approve when the candidate says no', async () => {
    const f = vi.fn().mockResolvedValue(resp(409, { error: 'x', needsConfirm: true, gaps: ['PMP'] })); vi.stubGlobal('fetch', f);
    const r = await patchApplication('a1', { action: 'approve' }, () => false);
    expect(r.error).toMatch(/Not approved/); expect(f).toHaveBeenCalledTimes(1);
  });
});
