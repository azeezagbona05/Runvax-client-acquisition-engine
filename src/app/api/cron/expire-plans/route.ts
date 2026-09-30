import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createTransporter, planExpiredHtml } from '@/lib/email';
import { getAppUrl, getAppName } from '@/lib/url';
import { guardCron } from '@/lib/cron';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Called by Vercel Cron daily. Downgrades any user whose planExpiresAt has
// passed back to the free plan and emails them.
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/expire-plans", "schedule": "0 2 * * *" }] }

export async function GET(req: NextRequest) {
  if (!guardCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  const expired = await prisma.user.findMany({
    where: {
      plan: { not: 'free' },
      planExpiresAt: { lte: now },
    },
    select: { id: true, email: true, name: true, plan: true },
  });

  if (expired.length === 0) {
    return NextResponse.json({ ok: true, downgraded: 0, at: now.toISOString() });
  }

  await prisma.user.updateMany({
    where: { id: { in: expired.map((u) => u.id) } },
    data: { plan: 'free', planExpiresAt: null, expiryReminderSentAt: null },
  });

  // Durable churn trail for Argus's Revenue/Growth signal — the updateMany
  // above leaves no per-user record on its own.
  await prisma.adminAuditLog.createMany({
    data: expired.map((u) => ({
      actorEmail: 'system',
      action: 'plan_auto_expired',
      title: `${u.email ?? u.id} auto-downgraded (${u.plan} plan expired)`,
    })),
  });

  let sent = 0;
  let skipped = 0;

  if (process.env.SMTP_HOST) {
    const appName = getAppName();
    const appUrl = getAppUrl();
    const transporter = createTransporter();

    for (const u of expired) {
      if (!u.email) { skipped++; continue; }
      try {
        await transporter.sendMail({
          from: `"${appName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
          to: u.email,
          subject: `Your ${appName} plan has expired`,
          html: planExpiredHtml(u.name ?? 'there', u.plan, appUrl, appName),
        });
        sent++;
      } catch (e) {
        console.error('[expire-plans] Failed to email', u.email, e);
        skipped++;
      }
    }
  } else {
    skipped = expired.length;
  }

  return NextResponse.json({ ok: true, downgraded: expired.length, sent, skipped, at: now.toISOString() });
}
