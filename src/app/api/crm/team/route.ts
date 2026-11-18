import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardInstalled } from '@/lib/v2Setup';
import { canManage, cleanMemberEmail, MEMBER_EMAIL_RE, requireCrm, ROLES, workspaceUsers } from '@/lib/crm/access';
import { rateLimit } from '@/lib/rateLimiter';

export const dynamic = 'force-dynamic';
const MAX_MEMBERS = 25;

/** GET: the workspace and who is on it. */
export const GET = (req: NextRequest) => guardInstalled(async () => {
  const a = await requireCrm(req); if (!a.ok) return a.response;
  const { ctx } = a;
  const [users, invited] = await Promise.all([workspaceUsers(ctx.ownerId), prisma.crmMember.findMany({ where: { ownerId: ctx.ownerId }, orderBy: { invitedAt: 'asc' }, select: { id: true, email: true, role: true, status: true, invitedAt: true, joinedAt: true } })]);
  return NextResponse.json({ me: { id: ctx.userId, role: ctx.role, name: ctx.name, email: ctx.email }, users, members: canManage(ctx.role) ? invited : [] });
});

/** POST { email, role? }: invite a teammate. They sign in with their own account using that email. Owner or admin only. */
export const POST = (req: NextRequest) => guardInstalled(async () => {
  const a = await requireCrm(req); if (!a.ok) return a.response;
  const { ctx } = a;
  if (!canManage(ctx.role)) return NextResponse.json({ error: 'Only the owner or an admin can invite teammates.' }, { status: 403 });
  if (!rateLimit(`crm-invite:${ctx.userId}`, { maxRequests: 20, windowMs: 60 * 60_000 }).ok) return NextResponse.json({ error: 'Too many invitations. Try again later.' }, { status: 429 });
  const b = await req.json().catch(() => ({})) as { email?: unknown; role?: unknown };
  const email = cleanMemberEmail(b.email);
  if (!MEMBER_EMAIL_RE.test(email) || email.length > 190) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (email === ctx.email) return NextResponse.json({ error: 'You are already in this workspace.' }, { status: 400 });
  const role = (ROLES as readonly unknown[]).includes(b.role) ? (b.role as string) : 'member';
  if (await prisma.crmMember.count({ where: { ownerId: ctx.ownerId } }) >= MAX_MEMBERS) return NextResponse.json({ error: `A workspace can have ${MAX_MEMBERS} teammates.` }, { status: 400 });
  const existing = await prisma.crmMember.findUnique({ where: { ownerId_email: { ownerId: ctx.ownerId, email } } });
  if (existing) return NextResponse.json({ error: existing.status === 'active' ? 'That person is already on the team.' : 'That person is already invited.' }, { status: 409 });
  const member = await prisma.crmMember.create({ data: { ownerId: ctx.ownerId, email, role } });

  // No email is sent from the platform: an invitation form that mails any address would be a spam relay. The owner tells the teammate to sign in with that address.
  return NextResponse.json({ ok: true, id: member.id }, { status: 201 });
});
