import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
  });

  if (!settings) {
    return NextResponse.json({
      dailyGoal: 10, avgDealValue: 300000, closeRatePct: 10,
      senderName: null, businessName: null, whatsapp: null,
      replyEmail: null, city: null, tagline: null,
      jobTitle: null, website: null,
      smtpHost: null, smtpPort: null, smtpUser: null,
      smtpPass: null, smtpFrom: null,
      bankName: null, bankAccount: null, bankAcctName: null, paymentLink: null,
      waPhoneNumberId: null, waAccessToken: null, waTemplateName: null,
    });
  }

  // Mask sensitive fields before sending to client
  const { smtpPass: _, waAccessToken: __, ...safe } = settings;
  return NextResponse.json({
    ...safe,
    smtpPass: settings.smtpPass ? '••••••••' : null,
    waAccessToken: settings.waAccessToken ? '••••••••' : null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    dailyGoal?: number;
    avgDealValue?: number;
    closeRatePct?: number;
    senderName?: string;
    businessName?: string;
    whatsapp?: string;
    replyEmail?: string;
    city?: string;
    tagline?: string;
    jobTitle?: string;
    website?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    smtpFrom?: string;
    bankName?: string;
    bankAccount?: string;
    bankAcctName?: string;
    paymentLink?: string;
    onboardingDone?: boolean;
    rateCard?: unknown;
    portfolio?: unknown;
    waPhoneNumberId?: string;
    waAccessToken?: string;
    waTemplateName?: string;
  };

  // Strip auto-managed / identity fields so Prisma uses regular CreateInput (not Unchecked),
  // and filter placeholder password so we never overwrite a saved password with empty.
  const SKIP = new Set(['id', 'userId', 'updatedAt', 'createdAt']);
  const data = Object.fromEntries(
    Object.entries(body).filter(([k, v]) => {
      if (v === undefined) return false;
      if (SKIP.has(k)) return false;
      if (k === 'smtpPass' && (!v || v === '••••••••')) return false;
      if (k === 'waAccessToken' && (!v || v === '••••••••')) return false;
      return true;
    })
  );

  try {
    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        dailyGoal: body.dailyGoal ?? 10,
        avgDealValue: body.avgDealValue ?? 300000,
        closeRatePct: body.closeRatePct ?? 10,
        ...data,
      },
      update: data,
    });

    const { smtpPass: _, ...safe } = settings;
    return NextResponse.json({ ...safe, smtpPass: settings.smtpPass ? '••••••••' : null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
