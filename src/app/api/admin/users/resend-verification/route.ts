import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import crypto from 'crypto';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAppUrl, getAppName } from '@/lib/url';
import { createTransporter, verificationEmailHtml } from '@/lib/email';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase());

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as { ids?: string[] };
  const ids = (body.ids ?? []).filter((id) => typeof id === 'string' && id.trim());
  if (ids.length === 0) {
    return NextResponse.json({ error: 'No user ids provided' }, { status: 400 });
  }

  // Only ever resend to users who are actually unverified — silently skip the rest.
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, emailVerified: null, email: { not: null } },
    select: { id: true, email: true, name: true },
  });

  const appUrl = getAppUrl();
  const appName = getAppName();
  const transporter = createTransporter();

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    if (!user.email) continue;
    try {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.emailVerificationToken.create({
        data: { userId: user.id, token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      });

      const verifyUrl = `${appUrl}/api/auth/verify-email?token=${token}`;
      await transporter.sendMail({
        from: `"${appName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
        to: user.email,
        subject: `Verify your email — ${appName}`,
        html: verificationEmailHtml(user.name ?? 'there', verifyUrl, appName),
      });
      sent++;
    } catch (e) {
      console.error('[admin/resend-verification] failed for', user.email, e);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, failed, skipped: ids.length - users.length });
}
