/**
 * The module must be unreachable unless the flag is on AND the caller is an
 * admin — for every API route, including ones added later.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { seed } from '../helpers/fakePrisma';

const auth = vi.hoisted(() => ({ getServerSession: vi.fn(), getToken: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: auth.getServerSession }));
vi.mock('next-auth/jwt', () => ({ getToken: auth.getToken }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

// ADMIN_EMAILS is read when adminAuth loads, so it must be set before the
// (hoisted) route imports below.
vi.hoisted(() => { process.env.ADMIN_EMAILS = 'admin@harzotech.test'; });

import { GET as statusGET } from '@/app/api/acquisition/status/route';
import { GET as tasksGET, POST as tasksPOST } from '@/app/api/acquisition/tasks/route';
import { middleware } from '@/middleware';

const post = () => new NextRequest('http://localhost/api/acquisition/tasks', { method: 'POST', body: '{}', headers: { origin: 'http://localhost' } });
const handlers: Array<[string, () => Promise<Response>]> = [
  ['GET /status', () => statusGET()],
  ['GET /tasks', () => tasksGET()],
  ['POST /tasks', () => tasksPOST(post())],
];

beforeEach(() => {
  auth.getServerSession.mockReset();
  auth.getToken.mockReset();
});
afterEach(() => {
  delete process.env.INDUSTRY_ACQUISITION_ENABLED;
});

describe('feature flag', () => {
  it.each([undefined, '', 'false', '1', 'TRUE', 'yes'])('flag=%s → 404 even for an admin', async (value) => {
    if (value === undefined) delete process.env.INDUSTRY_ACQUISITION_ENABLED;
    else process.env.INDUSTRY_ACQUISITION_ENABLED = value;
    auth.getServerSession.mockResolvedValue({ user: { id: 'a1', email: 'admin@harzotech.test', isAdmin: true } });
    for (const [, call] of handlers) expect((await call()).status).toBe(404);
  });
});

describe('with the flag on', () => {
  beforeEach(() => { process.env.INDUSTRY_ACQUISITION_ENABLED = 'true'; });

  it.each(handlers)('%s → 401 when signed out', async (_n, call) => {
    auth.getServerSession.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });

  it.each(handlers)('%s → 403 for a signed-in non-admin', async (_n, call) => {
    auth.getServerSession.mockResolvedValue({ user: { id: 'u1', email: 'customer@example.com' } });
    expect((await call()).status).toBe(403);
  });

  it('a flag alone is not enough: the email must also be on the admin list', async () => {
    auth.getServerSession.mockResolvedValue({ user: { id: 'u1', email: 'customer@example.com', isAdmin: true } });
    expect((await statusGET()).status).toBe(403);
  });

  it('an admin address signed in by password or Google (no admin sign-in) is refused', async () => {
    auth.getServerSession.mockResolvedValue({ user: { id: 'a1', email: 'admin@harzotech.test' } });
    expect((await statusGET()).status).toBe(403);
    auth.getServerSession.mockResolvedValue({ user: { id: 'a1', email: 'admin@harzotech.test', isAdmin: false } });
    expect((await statusGET()).status).toBe(403);
  });

  it.each(handlers)('%s → 200 for an admin', async (_n, call) => {
    seed('user', { id: 'a1', isSuspended: false });
    auth.getServerSession.mockResolvedValue({ user: { id: 'a1', email: 'Admin@Harzotech.test', isAdmin: true } });
    expect((await call()).status).toBe(200);
  });

  it('status lists the dental pack with every offer unconfigured', async () => {
    seed('user', { id: 'a1', isSuspended: false });
    auth.getServerSession.mockResolvedValue({ user: { id: 'a1', email: 'admin@harzotech.test', isAdmin: true } });
    const body = await (await statusGET()).json();
    expect(body.industries[0]).toMatchObject({ id: 'dental', liveSendingEnabled: false });
    expect(body.industries[0].offers.every((o: { status: string }) => o.status === 'unconfigured')).toBe(true);
  });
});

describe('every acquisition route calls the gate first', () => {
  const root = path.resolve(__dirname, '../../src/app/api/acquisition');
  const files: string[] = [];
  const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'route.ts') files.push(p);
  });
  walk(root);

  it('finds the routes', () => expect(files.length).toBeGreaterThan(0));

  it.each(files.map((f) => [path.relative(root, f), f]))('%s', (_rel, file) => {
    const src = fs.readFileSync(file, 'utf8');
    const exported = src.match(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g) ?? [];
    const gated = src.match(/const access = await requireAcquisitionAccess\((req)?\);\s*if \(!access\.ok\) return access\.response;/g) ?? [];
    // Every mutation handler must pass its request so the origin check applies.
    const mutations = src.match(/export async function (POST|PUT|PATCH|DELETE)\b[\s\S]*?requireAcquisitionAccess\(([^)]*)\)/g) ?? [];
    for (const m of mutations) expect(m, file).toMatch(/requireAcquisitionAccess\(req\)/);
    expect(exported.length).toBeGreaterThan(0);
    expect(gated.length).toBe(exported.length);
  });
});

describe('middleware /acquisition', () => {
  const run = (p: string) => middleware(new NextRequest(`http://localhost${p}`));
  it('sends signed-out visitors to /admin/login', async () => {
    auth.getToken.mockResolvedValue(null);
    expect((await run('/acquisition')).headers.get('location')).toBe('http://localhost/admin/login');
  });
  it('sends non-admins to /command-centre', async () => {
    auth.getToken.mockResolvedValue({ isAdmin: false });
    expect((await run('/acquisition/prospects')).headers.get('location')).toBe('http://localhost/command-centre');
  });
  it('lets admins through (the layout still checks the flag)', async () => {
    auth.getToken.mockResolvedValue({ isAdmin: true, adminAt: Date.now(), email: 'admin@harzotech.test' });
    expect((await run('/acquisition')).headers.get('location')).toBeNull();
  });
  it('does not match look-alike paths', async () => {
    expect((await run('/acquisitions-blog')).headers.get('location')).toBeNull();
    expect(auth.getToken).not.toHaveBeenCalled();
  });
});
