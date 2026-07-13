import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAppUrl, getAppName } from '@/lib/url';
import { createTransporter, verificationEmailHtml } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { email: rawEmail } = await req.json() as { email: string };
  if (!rawEmail) return NextResponse.json({ error: 'Email required' }, { status: 400 });
  const email = rawEmail.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });

  // Return ok even if user not found — don't reveal account existence
  if (!user) return NextResponse.json({ ok: true });

  if (user.emailVerified) {
    return NextResponse.json({ error: 'Email is already verified' }, { status: 400 });
  }

  // Delete any existing tokens for this user and create a fresh one
  await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const verifyUrl = `${getAppUrl()}/api/auth/verify-email?token=${token}`;

  const senderName = getAppName();

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"${senderName}" <${process.env.SMTP_FROM}>`,
      to: email,
      subject: `Verify your email — ${senderName}`,
      text: `Hi ${user.name},\n\nHere's your new verification link:\n\n${verifyUrl}\n\nThis link expires in 24 hours.\n\n— ${senderName}`,
      html: verificationEmailHtml(user.name ?? 'there', verifyUrl, senderName),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to send email. Check your spam or try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
