import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAppUrl, getAppName } from '@/lib/url';
import { createTransporter, verificationEmailHtml, welcomeEmailHtml, newUserRegisteredEmailHtml } from '@/lib/email';
import { rateLimit, getIp } from '@/lib/rateLimiter';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

export async function POST(req: NextRequest) {
  // 10 registrations per IP per hour
  const rl = rateLimit(`register:${getIp(req)}`, { maxRequests: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  const body = await req.json() as { name: string; email: string; password: string; acceptedTerms?: boolean; company?: string };
  const { name, password, acceptedTerms, company } = body;
  const email = body.email?.trim().toLowerCase();

  // Honeypot — a real user never fills this hidden field; a bot form-filler usually does.
  // Return a fake success so the bot doesn't learn its submission was rejected.
  if (company) {
    return NextResponse.json({ id: 'ok', email, name }, { status: 201 });
  }

  if (!email || !password || !name) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }
  if (!acceptedTerms) {
    return NextResponse.json({ error: 'You must accept the Terms and Privacy Policy' }, { status: 400 });
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
    data: { name, email, password: hashed, plan: 'free', registrationIp, termsAcceptedAt: new Date() },
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
  const appUrl = getAppUrl();
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

  // Send welcome email right away too — don't gate it behind email verification,
  // since that's exactly when interest (and drop-off risk) is highest.
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"${senderName}" <${process.env.SMTP_FROM}>`,
      to: email,
      subject: `Welcome to ${senderName} — let's find your first client 🚀`,
      html: welcomeEmailHtml(name, appUrl, senderName),
    });
  } catch {
    // Welcome email is non-critical — never block signup on it.
  }

  // Notify admins of the new signup, with the running total user count.
  if (ADMIN_EMAILS.length > 0) {
    try {
      const totalUsers = await prisma.user.count();
      const transporter = createTransporter();
      await transporter.sendMail({
        from: `"${senderName}" <${process.env.SMTP_FROM}>`,
        to: ADMIN_EMAILS.join(', '),
        subject: `New user registered — ${totalUsers} total users`,
        html: newUserRegisteredEmailHtml(name, email, totalUsers, appUrl, senderName),
      });
    } catch {
      // Admin notification is non-critical — never block signup on it.
    }
  }

  return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
}
