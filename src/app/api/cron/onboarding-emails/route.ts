import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createTransporter } from '@/lib/email';
import { getAppUrl, getAppName } from '@/lib/url';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Called by Vercel Cron daily at 8am WAT (7am UTC)
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/onboarding-emails", "schedule": "0 7 * * *" }] }

function guardCron(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

function day3Html(name: string, appUrl: string, appName: string): string {
  return `
    <!DOCTYPE html><html><body style="margin:0;padding:0;background:#030712;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
      <p style="color:#a78bfa;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:0 0 20px;">${appName}</p>
      <h1 style="color:#f9fafb;font-size:26px;font-weight:800;margin:0 0 16px;letter-spacing:-0.5px;">How's your pipeline looking, ${name}?</h1>
      <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 20px;">
        It's been a few days since you joined. The web designers seeing the best results are the ones who search every morning for 10 minutes.
      </p>
      <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 28px;">
        Here's the move: pick a city and an industry you want to serve. Search it. Find 5 no-website businesses. Send each one a message today. That's it.
      </p>
      <a href="${appUrl}" style="display:inline-block;background:#7c3aed;color:#fff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:12px;text-decoration:none;">Find leads now →</a>
      <p style="color:#4b5563;font-size:12px;margin:32px 0 0;">You're receiving this because you signed up for ${appName}. <a href="${appUrl}/settings" style="color:#6b7280;">Update preferences</a></p>
    </div>
    </body></html>
  `;
}

function day7Html(name: string, appUrl: string, appName: string): string {
  return `
    <!DOCTYPE html><html><body style="margin:0;padding:0;background:#030712;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
      <p style="color:#a78bfa;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:0 0 20px;">${appName}</p>
      <h1 style="color:#f9fafb;font-size:26px;font-weight:800;margin:0 0 16px;letter-spacing:-0.5px;">Have you sent your first proposal, ${name}?</h1>
      <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 20px;">
        One week in. The fastest way to land a client is to send a real proposal. Not a template. A personalised one that names their business, their city, and their gap.
      </p>
      <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 28px;">
        ${appName} generates that in one click. Find a business → click Proposal → send it via WhatsApp or email. The whole process takes under 3 minutes.
      </p>
      <a href="${appUrl}" style="display:inline-block;background:#7c3aed;color:#fff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:12px;text-decoration:none;">Generate a proposal →</a>
      <p style="color:#4b5563;font-size:12px;margin:32px 0 0;">You're receiving this because you signed up for ${appName}. <a href="${appUrl}/settings" style="color:#6b7280;">Update preferences</a></p>
    </div>
    </body></html>
  `;
}

function day14Html(name: string, appUrl: string, appName: string): string {
  return `
    <!DOCTYPE html><html><body style="margin:0;padding:0;background:#030712;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
      <p style="color:#a78bfa;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:0 0 20px;">${appName}</p>
      <h1 style="color:#f9fafb;font-size:26px;font-weight:800;margin:0 0 16px;letter-spacing:-0.5px;">Still looking for your first client?</h1>
      <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 20px;">
        We noticed you haven't been active recently. That's okay — life gets busy. But here's the truth: the longer you wait, the harder it gets to start.
      </p>
      <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 20px;">
        Give it 10 minutes today. Search your city. Find 5 businesses with no website. Send one message. That's the only commitment.
      </p>
      <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 28px;">
        If the product isn't working for you, reply to this email and tell us why. We read every reply.
      </p>
      <a href="${appUrl}" style="display:inline-block;background:#7c3aed;color:#fff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:12px;text-decoration:none;">Give it 10 minutes →</a>
      <p style="color:#4b5563;font-size:12px;margin:32px 0 0;">You're receiving this because you signed up for ${appName}. <a href="${appUrl}/settings" style="color:#6b7280;">Update preferences</a></p>
    </div>
    </body></html>
  `;
}

export async function GET(req: NextRequest) {
  if (!guardCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.SMTP_HOST) {
    return NextResponse.json({ skipped: true, reason: 'SMTP not configured' });
  }

  const appUrl = getAppUrl();
  const appName = getAppName();
  const now = new Date();

  // Find users due for day 3, 7, or 14 emails
  // Segmented by days since createdAt
  const thresholds = [
    { days: 3,  subject: `Quick check-in — ${appName}`,               html: day3Html  },
    { days: 7,  subject: `One week in — have you found a client yet?`, html: day7Html  },
    { days: 14, subject: `Still here for you, ${'{name}'}`,            html: day14Html },
  ];

  const transporter = createTransporter();
  let sent = 0;
  let skipped = 0;

  for (const { days, subject, html } of thresholds) {
    const windowStart = new Date(now.getTime() - (days + 0.5) * 24 * 60 * 60 * 1000);
    const windowEnd   = new Date(now.getTime() - (days - 0.5) * 24 * 60 * 60 * 1000);

    const users = await prisma.user.findMany({
      where: {
        createdAt: { gte: windowStart, lte: windowEnd },
        emailVerified: { not: null },
        email: { not: null },
        // Don't spam suspended users or those on paid plans (they're already activated)
        isSuspended: false,
      },
      select: { id: true, email: true, name: true, plan: true },
    });

    for (const user of users) {
      if (!user.email) { skipped++; continue; }

      const name = user.name ?? 'there';
      const personalSubject = subject.replace('{name}', name);

      try {
        await transporter.sendMail({
          from: `"${appName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
          to: user.email,
          subject: personalSubject,
          html: html(name, appUrl, appName),
        });
        sent++;
      } catch (e) {
        console.error('[onboarding-email] Failed for', user.email, e);
        skipped++;
      }
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, at: now.toISOString() });
}
