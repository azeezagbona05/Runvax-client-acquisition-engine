import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAppUrl, getAppName } from '@/lib/url';
import { createTransporter, welcomeEmailHtml } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const appUrl = getAppUrl();

  if (!token) {
    return NextResponse.redirect(`${appUrl}/auth/verify-email?error=missing`);
  }

  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });

  if (!record) {
    return NextResponse.redirect(`${appUrl}/auth/verify-email?error=invalid`);
  }
  if (record.expiresAt < new Date()) {
    await prisma.emailVerificationToken.delete({ where: { token } });
    return NextResponse.redirect(`${appUrl}/auth/verify-email?error=expired`);
  }

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
      select: { email: true, name: true },
    }),
    prisma.emailVerificationToken.delete({ where: { token } }),
  ]);

  if (user.email && process.env.SMTP_HOST) {
    const appName = getAppName();
    createTransporter().sendMail({
      from: `"${appName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
      to: user.email,
      subject: `Welcome to ${appName} — let's find your first client 🚀`,
      html: welcomeEmailHtml(user.name ?? 'there', appUrl, appName),
    }).catch(() => {});
  }

  return NextResponse.redirect(`${appUrl}/auth/signin?verified=1`);
}
