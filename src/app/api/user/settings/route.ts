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

  return NextResponse.json(settings ?? {
    dailyGoal: 10, avgDealValue: 300000, closeRatePct: 10,
    senderName: null, businessName: null, whatsapp: null,
    replyEmail: null, city: null, tagline: null,
    smtpHost: null, smtpPort: null, smtpUser: null,
    smtpPass: null, smtpFrom: null,
    bankName: null, bankAccount: null, bankAcctName: null, paymentLink: null,
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
  };

  const data = Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== undefined)
  );

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

  // Don't return smtpPass in response
  const { smtpPass: _, ...safe } = settings;
  return NextResponse.json({ ...safe, smtpPass: settings.smtpPass ? '••••••••' : null });
}
