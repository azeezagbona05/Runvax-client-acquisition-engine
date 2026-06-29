import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { getAppUrl, getAppName } from '@/lib/url';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email: string };
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

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

  // Use the user's own business name as the sender name if available
  const settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: { businessName: true, senderName: true },
  });
  const senderName = settings?.businessName || settings?.senderName || user.name || getAppName();

  try {
    const smtpPort = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"${senderName}" <${process.env.SMTP_FROM}>`,
      to: email,
      subject: `Verify your email — ${senderName}`,
      text: `Hi ${user.name},\n\nHere's a new verification link:\n\n${verifyUrl}\n\nThis link expires in 24 hours.\n\n— ${senderName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f172a;color:#e2e8f0;border-radius:16px">
          <div style="background:linear-gradient(135deg,#7c3aed,#f97316);width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;color:#fff;margin-bottom:24px">A</div>
          <h2 style="color:#fff;margin:0 0 8px">Verify your email</h2>
          <p style="color:#94a3b8;margin:0 0 24px">Hi ${user.name}, here's your new verification link:</p>
          <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#9333ea);color:#fff;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px">Verify my email →</a>
          <p style="color:#475569;font-size:12px;margin-top:24px">Link expires in 24 hours. If you didn't request this, ignore it.</p>
        </div>`,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to send email. Check your spam or try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
