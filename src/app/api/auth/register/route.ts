import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAppUrl, getAppName } from '@/lib/url';
import { createTransporter, verificationEmailHtml } from '@/lib/email';

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
  const senderName = getAppName();
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"${senderName}" <${process.env.SMTP_FROM}>`,
      to: email,
      subject: `Verify your email — ${senderName}`,
      text: `Hi ${name},\n\nClick the link below to verify your email:\n\n${verifyUrl}\n\nThis link expires in 24 hours.\n\n— ${senderName}`,
      html: verificationEmailHtml(name, verifyUrl, senderName),
    });
  } catch {
    // Verification email failed — user can resend later. Don't break signup.
  }

  return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
}
