import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { getAppUrl, getAppName } from '@/lib/url';

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

  // Use the user's own business name as the sender name if available
  const settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: { businessName: true, senderName: true },
  });
  const senderName = settings?.businessName || settings?.senderName || user.name || getAppName();

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const smtpUser = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && smtpUser && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host, port, secure: port === 465, auth: { user: smtpUser, pass },
      });
      await transporter.sendMail({
        from: `"${senderName}" <${smtpUser}>`,
        to: email,
        subject: `Reset your password — ${senderName}`,
        text: `You requested a password reset.\n\nClick this link to set a new password (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
        html: `
          <p>You requested a password reset.</p>
          <p><a href="${resetUrl}" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Reset Password</a></p>
          <p style="color:#888;font-size:12px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        `,
      });
    } catch (err) {
      console.error('Reset email send failed:', err);
      // Still return ok — token is saved, user can get link another way
    }
  }

  return NextResponse.json({ ok: true });
}
