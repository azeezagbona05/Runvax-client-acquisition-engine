import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireVerifiedUser } from '@/lib/requireUser';

/**
 * Team access. A workspace belongs to one account (the owner: whoever owns the campaigns). A teammate signs in with their OWN account and is
 * matched to an invitation by their VERIFIED email address, so an invitation to an address nobody controls grants nothing.
 * Teammates reach the CRM routes only: nothing here gives them the owner's campaigns, mailbox, billing or settings.
 *
 * Roles: owner and admin manage the team and can reassign anyone's contacts. A member can view the workspace, add notes and tasks, work
 * contacts assigned to them and take unassigned ones.
 */
export type CrmRole = 'owner' | 'admin' | 'member';
export interface CrmContext { userId: string; ownerId: string; role: CrmRole; email: string; name: string | null }
export const ROLES = ['admin', 'member'] as const;
export const canManage = (r: CrmRole) => r === 'owner' || r === 'admin';
export const cleanMemberEmail = (s: unknown) => (typeof s === 'string' ? s.trim().toLowerCase() : '');
export const MEMBER_EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;

/** Which workspace this user works in. Own workspace if they own any campaign; otherwise the one they were invited to (activating a pending invitation). */
export async function resolveWorkspace(userId: string): Promise<CrmContext | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, emailVerified: true } });
  if (!u?.email) return null;
  const email = u.email.trim().toLowerCase();
  const base = { userId, email, name: u.name };

  if (await prisma.outreachCampaign.count({ where: { userId } }) > 0) return { ...base, ownerId: userId, role: 'owner' };

  let m = await prisma.crmMember.findFirst({ where: { userId, status: 'active' }, orderBy: { joinedAt: 'desc' } });
  if (!m && u.emailVerified) {
    const pending = await prisma.crmMember.findFirst({ where: { email, status: 'invited' }, orderBy: { invitedAt: 'desc' } });
    if (pending) m = await prisma.crmMember.update({ where: { id: pending.id }, data: { userId, status: 'active', joinedAt: new Date() } });
  }
  if (m) return { ...base, ownerId: m.ownerId, role: m.role === 'admin' ? 'admin' : 'member' };
  return { ...base, ownerId: userId, role: 'owner' };                                   // a new account: its own (empty) workspace
}

export async function requireCrm(req: NextRequest): Promise<{ ok: true; ctx: CrmContext } | { ok: false; response: NextResponse }> {
  const u = await requireVerifiedUser(req); if (!u.ok) return u;
  const ctx = await resolveWorkspace(u.userId);
  if (!ctx) return { ok: false, response: NextResponse.json({ error: 'Your account has no email address.' }, { status: 400 }) };
  return { ok: true, ctx };
}

/** Everyone who may be assigned work in this workspace: the owner and the active teammates. */
export async function workspaceUsers(ownerId: string): Promise<Array<{ id: string; name: string | null; email: string; role: CrmRole }>> {
  const [owner, members] = await Promise.all([
    prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, name: true, email: true } }),
    prisma.crmMember.findMany({ where: { ownerId, status: 'active', userId: { not: null } }, select: { userId: true, role: true } }),
  ]);
  const users = members.length ? await prisma.user.findMany({ where: { id: { in: members.map((m) => m.userId as string) } }, select: { id: true, name: true, email: true } }) : [];
  return [
    ...(owner ? [{ id: owner.id, name: owner.name, email: owner.email ?? '', role: 'owner' as CrmRole }] : []),
    ...users.map((x) => ({ id: x.id, name: x.name, email: x.email ?? '', role: (members.find((m) => m.userId === x.id)?.role === 'admin' ? 'admin' : 'member') as CrmRole })),
  ];
}
