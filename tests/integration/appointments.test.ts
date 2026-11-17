import { describe, it, expect, vi, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';

let uid = 'ap_userA';
vi.mock('@/lib/campaignAuth', () => ({ requireCampaignUser: async () => ({ ok: true, userId: uid }) }));

import { prisma } from '@/lib/prisma';
import * as list from '@/app/api/client-acquisition/appointments/route';
import * as one from '@/app/api/client-acquisition/appointments/[leadId]/route';
import * as resched from '@/app/api/client-acquisition/appointments/reschedule/route';

const IDS = ['ap_userA', 'ap_userB'];
const DAY = 86_400_000;
const req = (url: string, init?: RequestInit) => new NextRequest('http://x' + url, init as never);
const body = (b: unknown, m = 'POST') => ({ method: m, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const ctx = (leadId: string) => ({ params: { leadId } });
const L: Record<string, string> = {};

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: IDS } } });
  for (const id of IDS) await prisma.user.create({ data: { id, email: `${id}@t.test`, name: 'Sam' } });
  const c = await prisma.outreachCampaign.create({ data: { userId: 'ap_userA', name: 'Clinics', subject: 's', body: 'b' } });
  const mk = (k: string, extra: object) => prisma.outreachLead.create({ data: { campaignId: c.id, userId: 'ap_userA', email: `${k}@clinic.test`, business: `${k} Clinic`, token: `tok_ap_${k}`, status: 'sent', stage: 'demo_booked', ...extra } }).then((l) => { L[k] = l.id; });
  await mk('future', { demoAt: new Date(Date.now() + 3 * DAY) });
  await mk('passed', { demoAt: new Date(Date.now() - 2 * DAY) });
  await mk('missed', { demoAt: new Date(Date.now() - 5 * DAY) });
  await mk('optout', { demoAt: new Date(Date.now() - 5 * DAY), unsubscribedAt: new Date() });
  await mk('noappt', { stage: null });                                                      // never booked: must not be listed
  const other = await prisma.outreachCampaign.create({ data: { userId: 'ap_userB', name: 'Theirs', subject: 's', body: 'b' } });
  L.theirs = (await prisma.outreachLead.create({ data: { campaignId: other.id, userId: 'ap_userB', email: 't@x.test', token: 'tok_ap_theirs', status: 'sent', stage: 'demo_booked', demoAt: new Date(Date.now() - DAY) } })).id;
});

describe('appointments', () => {
  it('lists booked meetings only, and a passed meeting with no outcome "needs update"', async () => {
    const j = await (await list.GET(req('/x'))).json();
    const by = Object.fromEntries(j.rows.map((r: { email: string; state: string }) => [r.email.split('@')[0], r.state]));
    expect(by).toEqual({ future: 'upcoming', passed: 'needs_update', missed: 'needs_update', optout: 'needs_update' });
    expect(j.counts).toMatchObject({ needsUpdate: 3, upcoming: 1, missed: 0 });
  });

  it('records the outcome and next step; rejects bad input; will not touch another user\'s contact', async () => {
    expect((await one.PATCH(req('/x', body({ outcome: 'ghosted' }, 'PATCH')), ctx(L.missed))).status).toBe(400);
    expect((await one.PATCH(req('/x', body({ nextActionDue: 'not a date' }, 'PATCH')), ctx(L.missed))).status).toBe(400);
    expect((await one.PATCH(req('/x', body({ outcome: 'missed' }, 'PATCH')), ctx(L.theirs))).status).toBe(404);
    for (const k of ['missed', 'optout']) expect((await one.PATCH(req('/x', body({ outcome: 'missed' }, 'PATCH')), ctx(L[k]))).status).toBe(200);
    expect((await one.PATCH(req('/x', body({ outcome: 'held', nextAction: 'Send the proposal', nextActionDue: new Date(Date.now() - DAY).toISOString() }, 'PATCH')), ctx(L.passed))).status).toBe(200);
    const j = await (await list.GET(req('/x'))).json();
    const passed = j.rows.find((r: { email: string }) => r.email.startsWith('passed'));
    expect(passed).toMatchObject({ state: 'held', nextAction: 'Send the proposal', followUp: 'overdue' });
    expect(j.counts).toMatchObject({ missed: 2, followUps: 1, overdue: 1, needsUpdate: 0 });
    expect(await prisma.leadAppointment.count({ where: { userId: 'ap_userB' } })).toBe(0);
  });

  it('marking the step done closes it; a new meeting time clears the old outcome', async () => {
    await one.PATCH(req('/x', body({ nextActionDone: true }, 'PATCH')), ctx(L.passed));
    let j = await (await list.GET(req('/x'))).json();
    expect(j.rows.find((r: { email: string }) => r.email.startsWith('passed')).followUp).toBe('done');
    await one.PATCH(req('/x', body({ demoAt: new Date(Date.now() + 7 * DAY).toISOString() }, 'PATCH')), ctx(L.missed));
    j = await (await list.GET(req('/x'))).json();
    expect(j.rows.find((r: { email: string }) => r.email.startsWith('missed'))).toMatchObject({ state: 'upcoming', outcome: null });
  });

  it('the reschedule campaign is a draft with only missed, not-opted-out contacts, and sends nothing', async () => {
    expect((await resched.POST(req('/x', body({ leadIds: [] })))).status).toBe(400);
    // 'missed' was rebooked above, so only the opted-out one is still "missed": nobody can be included
    expect((await resched.POST(req('/x', body({ leadIds: [L.missed, L.optout, L.theirs] })))).status).toBe(400);
    await one.PATCH(req('/x', body({ outcome: 'missed' }, 'PATCH')), ctx(L.missed));
    const r = await resched.POST(req('/x', body({ leadIds: [L.missed, L.optout, L.theirs] })));
    expect(r.status).toBe(201);
    const j = await r.json();
    expect(j.added).toBe(1); expect(j.skipped).toBe(2);
    const c = await prisma.outreachCampaign.findUnique({ where: { id: j.id }, include: { leads: true } });
    expect(c?.status).toBe('draft'); expect(c?.leads.map((l) => l.email)).toEqual(['missed@clinic.test']); expect(c?.leads[0].status).toBe('queued');
    expect(c?.body).toContain('missed each other'); expect(JSON.stringify(c?.automation)).toContain('whatsappActions'); expect((c?.automation as { sendMode?: string })?.sendMode).toBe('review');
  });
});
