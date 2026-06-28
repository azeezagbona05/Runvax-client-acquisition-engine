import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getEffectiveProfile } from '@/lib/userProfile';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { to, subject, body, fromName } = await req.json() as {
    to: string; subject: string; body: string; fromName?: string;
  };

  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
  }

  // Try user's custom SMTP first, fall back to platform SMTP
  let host: string | undefined;
  let port = 587;
  let user: string | undefined;
  let pass: string | undefined;
  let displayFrom: string | undefined = fromName;

  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    const s = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
      select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true, businessName: true, senderName: true },
    });
    if (s?.smtpHost && s?.smtpUser && s?.smtpPass) {
      host = s.smtpHost;
      port = s.smtpPort ?? 587;
      user = s.smtpUser;
      pass = s.smtpPass;
      displayFrom ??= s.smtpFrom ?? s.businessName ?? s.senderName ?? undefined;
    }
  }

  // Platform SMTP fallback
  if (!host || !user || !pass) {
    host = process.env.SMTP_HOST;
    port = Number(process.env.SMTP_PORT ?? 587);
    user = process.env.SMTP_USER;
    pass = process.env.SMTP_PASS;
    displayFrom ??= process.env.SMTP_FROM ?? undefined;
  }

  if (!host || !user || !pass) {
    return NextResponse.json(
      { error: 'No email server configured. Go to Settings → Email to set up your SMTP.' },
      { status: 500 },
    );
  }

  const transporter = nodemailer.createTransport({
    host, port, secure: port === 465, auth: { user, pass },
  });

  // Build auto-signature from effective profile
  const profile = await getEffectiveProfile();
  const sigParts = [
    profile.senderName && profile.businessName
      ? `— ${profile.senderName} | ${profile.businessName}`
      : profile.senderName || profile.businessName || null,
    profile.whatsapp ? `WhatsApp: ${profile.whatsapp}` : null,
    profile.tagline || null,
  ].filter(Boolean);
  const signature = sigParts.length > 0 ? `\n\n${sigParts.join(' | ')}` : '';

  const finalBody = body + signature;
  const finalHtml = finalBody.replace(/\n/g, '<br>');

  try {
    const info = await transporter.sendMail({
      from: displayFrom ? `"${displayFrom}" <${user}>` : user,
      to, subject,
      text: finalBody,
      html: finalHtml,
    });
    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to send email' }, { status: 500 });
  }
}
