import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import nodemailer from 'nodemailer';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
  });

  const host = settings?.smtpHost || process.env.SMTP_HOST;
  const port = Number(settings?.smtpPort ?? process.env.SMTP_PORT ?? 587);
  const user = settings?.smtpUser || process.env.SMTP_USER;
  const pass = settings?.smtpPass || process.env.SMTP_PASS;
  const toEmail = session.user.email!;

  if (!host || !user || !pass) {
    return NextResponse.json({ error: 'No SMTP credentials configured' }, { status: 400 });
  }

  try {
    const transporter = nodemailer.createTransport({
      host, port, secure: port === 465, auth: { user, pass },
    });

    await transporter.verify();

    await transporter.sendMail({
      from: settings?.smtpFrom
        ? `"${settings.smtpFrom}" <${user}>`
        : `"AI Prospect Finder" <${user}>`,
      to: toEmail,
      subject: 'SMTP test — AI Prospect Finder',
      text: `Your email settings are working correctly. Emails will be sent from ${user}.`,
      html: `<p>Your email settings are working correctly.</p><p>Emails will be sent from <strong>${user}</strong>.</p>`,
    });

    return NextResponse.json({ ok: true, sentTo: toEmail });
  } catch (err: unknown) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Connection failed',
    }, { status: 500 });
  }
}
