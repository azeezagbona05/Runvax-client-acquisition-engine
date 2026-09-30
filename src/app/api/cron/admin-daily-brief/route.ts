import { NextRequest, NextResponse } from 'next/server';
import { createTransporter, adminDailyBriefHtml } from '@/lib/email';
import { getAppUrl, getAppName } from '@/lib/url';
import { getOrCreateTodaysAdminBrief } from '@/lib/adminOps';
import { guardCron } from '@/lib/cron';
import type { AdminOpsRecommendation } from '@/lib/adminOps';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Called by Vercel Cron daily — emails today's Argus admin brief to ADMIN_EMAILS.
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/admin-daily-brief", "schedule": "30 8 * * *" }] }

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean);

export async function GET(req: NextRequest) {
  if (!guardCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.SMTP_HOST) {
    return NextResponse.json({ skipped: true, reason: 'SMTP not configured' });
  }
  if (ADMIN_EMAILS.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'ADMIN_EMAILS not configured' });
  }

  const brief = await getOrCreateTodaysAdminBrief();
  const recommendations = brief.recommendations as unknown as AdminOpsRecommendation[];

  const appName = getAppName();
  const appUrl = getAppUrl();
  const transporter = createTransporter();
  const html = adminDailyBriefHtml(brief.summary, recommendations, appUrl, appName);

  let sent = 0;
  for (const to of ADMIN_EMAILS) {
    try {
      await transporter.sendMail({
        from: `"${appName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
        to,
        subject: `${appName} admin brief — ${brief.date}`,
        html,
      });
      sent++;
    } catch (e) {
      console.error('[admin-daily-brief] Failed to email', to, e);
    }
  }

  return NextResponse.json({ ok: true, sent, at: new Date().toISOString() });
}
