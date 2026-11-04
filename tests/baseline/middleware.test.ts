/**
 * Baseline: pins the admin/growth redirects in src/middleware.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const jwt = vi.hoisted(() => ({ getToken: vi.fn() }));
vi.mock('next-auth/jwt', () => ({ getToken: jwt.getToken }));

import { middleware } from '@/middleware';

const run = (path: string) => middleware(new NextRequest(`http://localhost${path}`));
const location = (res: Response) => res.headers.get('location');

beforeEach(() => jwt.getToken.mockReset());

describe('middleware', () => {
  it('lets /admin/login through', async () => {
    const res = await run('/admin/login');
    expect(location(res)).toBeNull();
    expect(jwt.getToken).not.toHaveBeenCalled();
  });

  it.each(['/admin', '/admin/users', '/growth', '/growth/seo'])('redirects signed-out %s to /admin/login', async (p) => {
    jwt.getToken.mockResolvedValue(null);
    expect(location(await run(p))).toBe('http://localhost/admin/login');
  });

  it('redirects a non-admin away from /admin', async () => {
    jwt.getToken.mockResolvedValue({ isAdmin: false });
    expect(location(await run('/admin'))).toBe('http://localhost/admin/login');
  });

  it('sends a non-admin on /growth to /command-centre', async () => {
    jwt.getToken.mockResolvedValue({ isAdmin: false });
    expect(location(await run('/growth'))).toBe('http://localhost/command-centre');
  });

  it.each(['/admin', '/growth/seo'])('lets an admin through %s', async (p) => {
    jwt.getToken.mockResolvedValue({ isAdmin: true });
    expect(location(await run(p))).toBeNull();
  });

  it('does not touch unrelated routes', async () => {
    const res = await run('/pipeline');
    expect(location(res)).toBeNull();
    expect(jwt.getToken).not.toHaveBeenCalled();
  });
});
