import { describe, it, expect, vi, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';

let uid = 'crm_owner';
vi.mock('@/lib/requireUser', () => ({ requireVerifiedUser: async () => ({ ok: true, userId: uid }), requireUser: async () => ({ ok: true, userId: uid }) }));

import { prisma } from '@/lib/prisma';
import * as team from '@/app/api/crm/team/route';
import * as teamOne from '@/app/api/crm/team/[id]/route';
import * as today from '@/app/api/crm/today/route';
import * as contacts from '@/app/api/crm/contacts/route';
import * as contact from '@/app/api/crm/contacts/[id]/route';
import * as notes from '@/app/api/crm/contacts/[id]/notes/route';
import * as tasks from '@/app/api/crm/tasks/route';
import * as taskOne from '@/app/api/crm/tasks/[id]/route';

const IDS = ['crm_owner', 'crm_mate', 'crm_admin', 'crm_stranger'];
const DAY = 86_400_000;
const req = (url: string, init?: RequestInit) => new NextRequest('http://x' + url, init as never);
const body = (b: unknown, m = 'POST') => ({ method: m, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const p = (id: string) => ({ params: { id } });
const as = (id: string) => { uid = id; };
const L: Record<string, string> = {};

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: IDS } } });
  await prisma.crmMember.deleteMany({ where: { ownerId: 'crm_owner' } });
  for (const id of IDS) await prisma.user.create({ data: { id, email: `${id}@t.test`, name: id, emailVerified: new Date() } });
  const c = await prisma.outreachCampaign.create({ data: { userId: 'crm_owner', name: 'Clinics', subject: 's', body: 'b' } });
  const mk = (k: string, extra: object) => prisma.outreachLead.create({ data: { campaignId: c.id, userId: 'crm_owner', email: `${k}@clinic.test`, business: `${k} Clinic`, token: `tok_crm_${k}`, status: 'sent', sentAt: new Date(Date.now() - 3 * DAY), ...extra } }).then((l) => { L[k] = l.id; });
  await mk('hot', { replyClass: 'interested', repliedAt: new Date(Date.now() - DAY) });
  await mk('quiet', {});
  await mk('optout', { unsubscribedAt: new Date(), replyClass: 'interested', repliedAt: new Date() });
  await prisma.campaignReply.create({ data: { userId: 'crm_owner', campaignId: c.id, leadId: L.hot, source: 'manual', fromEmail: 'hot@clinic.test', text: 'Yes, tell me more', receivedAt: new Date(Date.now() - DAY), replyClass: 'interested' } });
});

describe('team CRM', () => {
  it('a stranger gets their own empty workspace and sees none of the owner\'s contacts', async () => {
    as('crm_stranger');
    expect((await (await contacts.GET(req('/x'))).json()).total).toBe(0);
    expect((await contact.GET(req('/x'), p(L.hot))).status).toBe(404);
    expect((await (await team.GET(req('/x'))).json()).me.role).toBe('owner');            // owner of their own (empty) workspace
  });

  it('only the owner invites; bad input, self-invites and duplicates are refused', async () => {
    as('crm_owner');
    expect((await team.POST(req('/x', body({ email: 'nope' })))).status).toBe(400);
    expect((await team.POST(req('/x', body({ email: 'crm_owner@t.test' })))).status).toBe(400);
    const r = await team.POST(req('/x', body({ email: ' CRM_Mate@T.test ' }))); expect(r.status).toBe(201);
    expect((await team.POST(req('/x', body({ email: 'crm_mate@t.test' })))).status).toBe(409);
    expect((await team.POST(req('/x', body({ email: 'crm_admin@t.test', role: 'admin' })))).status).toBe(201);
  });

  it('an invited teammate is activated by signing in with that verified email, and sees the owner\'s contacts', async () => {
    as('crm_mate');
    const w = await (await team.GET(req('/x'))).json();
    expect(w.me.role).toBe('member'); expect(w.members).toEqual([]);                      // a member does not see the invitation list
    expect(w.users.map((u: { id: string }) => u.id).sort()).toEqual(['crm_admin'.slice(0, 0) + 'crm_mate', 'crm_owner'].sort());
    const j = await (await contacts.GET(req('/x'))).json();
    expect(j.contacts.map((x: { email: string }) => x.email.split('@')[0]).sort()).toEqual(['hot', 'quiet']);     // opted-out hidden
  });

  it('an unverified email is never matched to an invitation', async () => {
    await prisma.user.update({ where: { id: 'crm_admin' }, data: { emailVerified: null } });
    as('crm_admin');
    expect((await (await team.GET(req('/x'))).json()).me.role).toBe('owner');
    await prisma.user.update({ where: { id: 'crm_admin' }, data: { emailVerified: new Date() } });
    expect((await (await team.GET(req('/x'))).json()).me.role).toBe('admin');
  });

  it('"today" shows the waiting reply first with reasons, never the opted-out contact', async () => {
    as('crm_mate');
    const j = await (await today.GET(req('/x?scope=mine'))).json();
    expect(j.queue[0]).toMatchObject({ leadId: L.hot, unassigned: true, action: 'Reply to them' });
    expect(j.queue[0].reasons[0]).toMatch(/waiting for an answer/);
    expect(j.queue.some((i: { leadId: string }) => i.leadId === L.optout)).toBe(false);
  });

  it('a member can take an unassigned contact, but not give it to someone else or take another\'s', async () => {
    as('crm_mate');
    expect((await contact.PATCH(req('/x', body({ assigneeId: 'crm_owner' }, 'PATCH')), p(L.hot))).status).toBe(403);
    expect((await contact.PATCH(req('/x', body({ assigneeId: 'crm_stranger' }, 'PATCH')), p(L.hot))).status).toBe(400);
    expect((await contact.PATCH(req('/x', body({ assigneeId: 'crm_mate' }, 'PATCH')), p(L.hot))).status).toBe(200);
    as('crm_admin');
    expect((await contact.PATCH(req('/x', body({ assigneeId: 'crm_owner' }, 'PATCH')), p(L.hot))).status).toBe(200);     // admin may reassign
    as('crm_mate');
    expect((await contact.PATCH(req('/x', body({ assigneeId: 'crm_mate' }, 'PATCH')), p(L.hot))).status).toBe(403);      // owned by someone else now
    // "mine" for the mate no longer includes it; "all" does
    expect((await (await today.GET(req('/x?scope=mine'))).json()).queue.some((i: { leadId: string }) => i.leadId === L.hot)).toBe(false);
    expect((await (await today.GET(req('/x?scope=all'))).json()).queue.some((i: { leadId: string }) => i.leadId === L.hot)).toBe(true);
  });

  it('notes, stage changes and tasks are logged on the contact\'s timeline with who did them', async () => {
    as('crm_mate');
    expect((await notes.POST(req('/x', body({ kind: 'call', body: '  ' })), p(L.quiet))).status).toBe(400);
    expect((await notes.POST(req('/x', body({ kind: 'call', body: 'Spoke to the owner, wants a demo' })), p(L.quiet))).status).toBe(201);
    expect((await contact.PATCH(req('/x', body({ stage: 'proposal_sent' }, 'PATCH')), p(L.quiet))).status).toBe(200);
    expect((await contact.PATCH(req('/x', body({ stage: 'banana' }, 'PATCH')), p(L.quiet))).status).toBe(400);
    const t = await tasks.POST(req('/x', body({ title: 'Send the proposal', leadId: L.quiet, dueAt: new Date(Date.now() - DAY).toISOString() }))); expect(t.status).toBe(201);
    const d = await (await contact.GET(req('/x'), p(L.quiet))).json();
    expect(d.timeline.some((e: { kind: string; by: string }) => e.kind === 'call' && e.by === 'crm_mate')).toBe(true);
    expect(d.timeline.some((e: { kind: string; text: string }) => e.kind === 'system' && /proposal sent/.test(e.text))).toBe(true);
    expect(d.tasks[0]).toMatchObject({ title: 'Send the proposal', assigneeId: 'crm_mate' });
    const q = await (await today.GET(req('/x?scope=mine'))).json();
    expect(q.queue.find((i: { leadId: string }) => i.leadId === L.quiet).reasons.join(' ')).toMatch(/Task overdue: Send the proposal/);
  });

  it('task rules: anyone can tick done; only the maker, assignee or an admin can edit or delete; bad input refused', async () => {
    as('crm_mate');
    const id = (await (await tasks.GET(req('/x?scope=mine'))).json()).tasks[0].id;
    expect((await tasks.POST(req('/x', body({ title: '' })))).status).toBe(400);
    expect((await tasks.POST(req('/x', body({ title: 'x', dueAt: 'nope' })))).status).toBe(400);
    expect((await tasks.POST(req('/x', body({ title: 'x', leadId: 'not-mine' })))).status).toBe(404);
    as('crm_stranger');
    expect((await taskOne.PATCH(req('/x', body({ done: true }, 'PATCH')), p(id))).status).toBe(404);   // another workspace
    as('crm_admin');
    expect((await taskOne.PATCH(req('/x', body({ title: 'Send the proposal today' }, 'PATCH')), p(id))).status).toBe(200);
    as('crm_owner');
    expect((await taskOne.PATCH(req('/x', body({ done: true }, 'PATCH')), p(id))).status).toBe(200);
    expect((await (await tasks.GET(req('/x?scope=all'))).json()).tasks.some((x: { id: string }) => x.id === id)).toBe(false);
    expect((await (await tasks.GET(req('/x?scope=all&done=1'))).json()).tasks.some((x: { id: string }) => x.id === id)).toBe(true);
  });

  it('removing a teammate unassigns their contacts and open tasks, and they lose access', async () => {
    as('crm_mate');
    await contact.PATCH(req('/x', body({ assigneeId: 'crm_mate' }, 'PATCH')), p(L.quiet));
    as('crm_owner');
    const m = (await (await team.GET(req('/x'))).json()).members.find((x: { email: string }) => x.email === 'crm_mate@t.test');
    expect((await teamOne.PATCH(req('/x', body({ role: 'boss' }, 'PATCH')), p(m.id))).status).toBe(400);
    as('crm_mate'); expect((await teamOne.DELETE(req('/x', { method: 'DELETE' }), p(m.id))).status).toBe(403);
    as('crm_owner'); expect((await teamOne.DELETE(req('/x', { method: 'DELETE' }), p(m.id))).status).toBe(200);
    expect(await prisma.leadAssignment.count({ where: { assigneeId: 'crm_mate' } })).toBe(0);
    as('crm_mate');
    expect((await (await contacts.GET(req('/x'))).json()).total).toBe(0);                  // back to their own empty workspace
  });
});
