import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAppUrl, getAppName } from '@/lib/url';
import { createTransporter, passwordResetEmailHtml } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email: string };
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

  // Always return success — don't leak whether email exists
  if (!user) return NextResponse.json({ ok: true });

  // Invalidate old tokens
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  const resetUrl = `${getAppUrl()}/auth/reset-password?token=${token}`;

  // Transactional email from us — always send as the app brand.
  const senderName = getAppName();

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = createTransporter();
      await transporter.sendMail({
        from: `"${senderName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
        to: email,
        subject: `Reset your password — ${senderName}`,
        text: `You requested a password reset.\n\nClick this link to set a new password (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
        html: passwordResetEmailHtml(user.name ?? 'there', resetUrl, senderName),
      });
    } catch (err) {
      console.error('Reset email send failed:', err);
    }
  }

  return NextResponse.json({ ok: true });
}
