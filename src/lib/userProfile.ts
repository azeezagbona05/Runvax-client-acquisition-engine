import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateCardSummary } from '@/lib/rateCard';
import type { RateCard } from '@/lib/rateCard';

export interface EffectiveProfile {
  senderName: string;
  businessName: string;
  whatsapp: string;
  replyEmail: string;
  city: string;
  tagline: string;
  services: string;
  jobTitle: string;
  website: string;
  bankName: string;
  bankAccount: string;
  bankAcctName: string;
  paymentLink: string;
  rateCardSummary: string;
}

const DEFAULT_EMAIL = 'info@beamai.net';

// Cached default profile — loaded once per process lifetime
let _defaultCache: EffectiveProfile | null = null;

async function getDefaultProfile(): Promise<EffectiveProfile> {
  if (_defaultCache) return _defaultCache;
  const defaultUser = await prisma.user.findUnique({
    where: { email: DEFAULT_EMAIL },
    include: { settings: true },
  });
  _defaultCache = {
    senderName: defaultUser?.settings?.senderName ?? 'BeamAI Team',
    businessName: defaultUser?.settings?.businessName ?? 'BeamAI',
    whatsapp: defaultUser?.settings?.whatsapp ?? '+234 800 000 0000',
    replyEmail: defaultUser?.settings?.replyEmail ?? DEFAULT_EMAIL,
    city: defaultUser?.settings?.city ?? 'Lagos, Nigeria',
    tagline: defaultUser?.settings?.tagline ?? 'Building digital front doors for Nigerian businesses',
    services: 'Web design, SEO, Google Business Profile setup',
    jobTitle: defaultUser?.settings?.jobTitle ?? '',
    website: defaultUser?.settings?.website ?? '',
    bankName: defaultUser?.settings?.bankName ?? '',
    bankAccount: defaultUser?.settings?.bankAccount ?? '',
    bankAcctName: defaultUser?.settings?.bankAcctName ?? '',
    paymentLink: defaultUser?.settings?.paymentLink ?? '',
    rateCardSummary: defaultUser?.settings?.rateCard
      ? rateCardSummary(defaultUser.settings.rateCard as unknown as RateCard)
      : '',
  };
  return _defaultCache;
}

export async function getEffectiveProfile(): Promise<EffectiveProfile> {
  const session = await getServerSession(authOptions);
  const defaults = await getDefaultProfile();

  if (!session?.user?.id) return defaults;

  const s = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
  });

  return {
    senderName: s?.senderName || defaults.senderName,
    businessName: s?.businessName || defaults.businessName,
    whatsapp: s?.whatsapp || defaults.whatsapp,
    replyEmail: s?.replyEmail || defaults.replyEmail,
    city: s?.city || defaults.city,
    tagline: s?.tagline || defaults.tagline,
    services: 'Web design, SEO, Google Business Profile setup',
    jobTitle: s?.jobTitle || defaults.jobTitle,
    website: s?.website || defaults.website,
    bankName: s?.bankName || defaults.bankName,
    bankAccount: s?.bankAccount || defaults.bankAccount,
    bankAcctName: s?.bankAcctName || defaults.bankAcctName,
    paymentLink: s?.paymentLink || defaults.paymentLink,
    rateCardSummary: s?.rateCard
      ? rateCardSummary(s.rateCard as unknown as RateCard)
      : defaults.rateCardSummary,
  };
}
