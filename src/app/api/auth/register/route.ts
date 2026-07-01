import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { getAppUrl, getAppName } from '@/lib/url';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json() as { name: string; email: string; password: string };

  if (!email || !password || !name) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  const registrationIp =
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    null;

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, password: hashed, plan: 'free', registrationIp },
  });

  // Create verification token (24hr expiry)
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // Send verification email (fire-and-forget — don't block registration)
  const verifyUrl = `${getAppUrl()}/api/auth/verify-email?token=${token}`;
  // Transactional email from us — always send as the app brand, never the
  // registrant's own name.
  const senderName = getAppName();
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
      text: `Hi ${name},\n\nClick the link below to verify your email:\n\n${verifyUrl}\n\nThis link expires in 24 hours.\n\n— ${senderName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f172a;color:#e2e8f0;border-radius:16px">
          <div style="background:linear-gradient(135deg,#7c3aed,#f97316);width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;color:#fff;margin-bottom:24px">A</div>
          <h2 style="color:#fff;margin:0 0 8px">Verify your email</h2>
          <p style="color:#94a3b8;margin:0 0 24px">Hi ${name}, one quick step before you start finding prospects:</p>
          <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#9333ea);color:#fff;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px">Verify my email →</a>
          <p style="color:#475569;font-size:12px;margin-top:24px">Link expires in 24 hours. If you didn't create this account, ignore this email.</p>
        </div>`,
    });
  } catch {
    // Verification email failed — user can resend later. Don't break signup.
  }

  return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
}
