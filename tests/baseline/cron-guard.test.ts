import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { guardCron } from '@/lib/cron';

const req = (auth?: string) => new NextRequest('http://localhost/api/cron/x', { headers: auth ? { authorization: auth } : {} });
const saved = process.env.CRON_SECRET;
afterEach(() => { if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved; });

describe('guardCron', () => {
  it('accepts only the exact bearer secret', () => {
    process.env.CRON_SECRET = 's3cret-value';
    expect(guardCron(req('Bearer s3cret-value'))).toBe(true);
    for (const a of [undefined, 'Bearer wrong', 's3cret-value', 'Bearer ']) expect(guardCron(req(a))).toBe(false);
  });
  it('with CRON_SECRET unset or empty, refuses everything, including "Bearer undefined"', () => {
    delete process.env.CRON_SECRET;
    for (const a of [undefined, 'Bearer undefined', 'Bearer ', 'Bearer']) expect(guardCron(req(a)), String(a)).toBe(false);
    process.env.CRON_SECRET = '';
    expect(guardCron(req('Bearer '))).toBe(false);
  });
});
