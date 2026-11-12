import { describe, it, expect, vi, beforeEach } from 'vitest';

const ai = vi.hoisted(() => ({ has: true, text: '' as string, boom: false }));
vi.mock('@/lib/ai', async (orig) => ({
  ...(await orig<typeof import('@/lib/ai')>()),
  hasProvider: () => ai.has,
  generate: vi.fn(async () => { if (ai.boom) throw new Error('down'); return { text: JSON.stringify({ text: ai.text }), provider: 'openai' }; }),
}));
import { rewriteField } from '@/lib/career/rewrite';

const CV = 'Ada Obi. Frontend developer with five years building React applications. Built a React dashboard used by 300 customers. Cut page load time by 40%. Led a team at Bright Labs.';
beforeEach(() => { ai.has = true; ai.boom = false; });

describe('rewriteField: wording only', () => {
  it('accepts a rewrite whose facts are all in the CV', async () => {
    ai.text = 'Frontend developer with five years of experience building React applications.';
    expect(await rewriteField('summary', 'Frontend developer with five years building React applications.', CV)).toEqual({ ok: true, text: ai.text });
  });
  it('discards a rewrite that adds a number, a skill or a claim', async () => {
    for (const bad of ['Frontend developer with ten years building React applications.', 'Frontend developer building React applications and Kubernetes clusters at Google.', 'Award-winning frontend developer who transformed five engineering organisations worldwide.']) {
      ai.text = bad; const r = await rewriteField('summary', 'Frontend developer with five years building React applications.', CV);
      expect(r.ok).toBe(false); if (!r.ok) expect(r.error).toMatch(/not in your CV|much longer/); }
  });
  it('spelled-out numbers are claims too: "ten" is refused, "5" for "five" is fine', async () => {
    ai.text = 'Frontend developer with ten years building React applications.'; expect((await rewriteField('summary', 'Frontend developer with five years building React applications.', CV)).ok).toBe(false);
    ai.text = 'Frontend developer with 5 years building React applications.'; expect((await rewriteField('summary', 'Frontend developer with five years building React applications.', CV)).ok).toBe(true);
  });
  it('discards a rewrite that is far longer than the original', async () => {
    ai.text = 'Frontend developer with five years building React applications. ' + 'Built a React dashboard used by 300 customers. '.repeat(3);
    const r = await rewriteField('summary', 'Frontend developer with five years building React applications.', CV); expect(r.ok).toBe(false);
  });
  it('bullets must keep the same number of lines, and each line must be backed by the CV', async () => {
    const original = 'Built a React dashboard used by 300 customers\nCut page load time by 40%';
    ai.text = 'Built a React dashboard used by 300 customers\nCut page load time by 40%\nLed a team at Bright Labs';
    expect((await rewriteField('bullets', original, CV)).ok).toBe(false);
    ai.text = 'Delivered a React dashboard used by 300 customers\nReduced page load time by 40%'; expect((await rewriteField('bullets', original, CV)).ok).toBe(true);
    ai.text = 'Delivered a React dashboard used by 900 customers\nReduced page load time by 40%'; expect((await rewriteField('bullets', original, CV)).ok).toBe(false);
  });
  it('says plainly when AI is not connected or fails, and never returns changed text', async () => {
    ai.has = false; const a = await rewriteField('summary', 'Frontend developer with five years.', CV); expect(a).toMatchObject({ ok: false, status: 503 }); if (!a.ok) expect(a.error).toMatch(/unchanged/);
    ai.has = true; ai.boom = true; const b = await rewriteField('summary', 'Frontend developer with five years.', CV); expect(b).toMatchObject({ ok: false, status: 502 });
  });
  it('refuses text that is too short to rewrite', async () => { expect(await rewriteField('headline', 'Dev', CV)).toMatchObject({ ok: false, status: 400 }); });
});
