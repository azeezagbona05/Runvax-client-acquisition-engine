/**
 * Email reveal credits. A reveal is "successful" when an email address is actually found for a person.
 *
 *  - Each plan has a monthly allowance; a trial has a small one-off allowance. When it is used up, the wallet
 *    (credits bought or granted) is spent.
 *  - Only successful reveals cost anything. A failed lookup never touches a balance.
 *  - An email that was revealed before is never charged again (ledger key `email:<address>`).
 *  - Nobody can reveal without balance: callers ask `reserve()` first and only process what it allows.
 *
 * PROVISIONAL: the allowances and prices below are placeholders from the pricing proposal. They must be checked against
 * the real cost per successful reveal on the provider subscription before pricing goes live.
 */

import { prisma } from '@/lib/prisma';

/** Successful email reveals included per month, by plan id. Placeholder numbers: see the note above. */
export const PLAN_ALLOWANCE: Record<string, number> = { free: 0, starter: 25, pro: 100, agency: 300 };
/** One-off allowance for the free trial (the trial runs on the Professional plan). */
export const TRIAL_ALLOWANCE = 10;
/** Proposed top-up packs. Not for sale until checkout is built and the prices are validated. */
export const TOPUP_PACKS: Array<{ credits: number; priceUsd: number }> = [
  { credits: 50, priceUsd: 5 }, { credits: 100, priceUsd: 9 }, { credits: 250, priceUsd: 20 }, { credits: 500, priceUsd: 35 },
];

export const periodOf = (d: Date = new Date()): string => d.toISOString().slice(0, 7);
export const allowanceFor = (plan: string, onTrial: boolean): number => (onTrial ? TRIAL_ALLOWANCE : PLAN_ALLOWANCE[plan] ?? 0);
export const revealKeyOf = (email: string): string => `email:${email.trim().toLowerCase()}`;

export interface CreditSummary { plan: string; onTrial: boolean; allowance: number; used: number; remainingAllowance: number; wallet: number; total: number }

/** Pure: the summary from the raw numbers. */
export function summarise(plan: string, onTrial: boolean, used: number, wallet: number): CreditSummary {
  const allowance = allowanceFor(plan, onTrial);
  const remainingAllowance = Math.max(0, allowance - used);
  return { plan, onTrial, allowance, used, remainingAllowance, wallet: Math.max(0, wallet), total: remainingAllowance + Math.max(0, wallet) };
}

export async function loadCredits(userId: string): Promise<CreditSummary> {
  const [user, trial, paid, wallet] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }),
    prisma.payment.findUnique({ where: { reference: `trial_${userId}` }, select: { paidAt: true } }),
    prisma.payment.count({ where: { userId, status: 'success', amount: { gt: 0 } } }),
    prisma.emailWallet.findUnique({ where: { userId }, select: { balance: true } }),
  ]);
  const plan = user?.plan ?? 'free';
  // A trial is the Pro plan with a $0 trial payment and no real payment.
  const onTrial = plan === 'pro' && !!trial && paid === 0;
  const used = await prisma.emailCreditLedger.aggregate({
    _sum: { credits: true },
    where: { userId, kind: 'reveal', source: 'allowance', ...(onTrial ? { createdAt: { gte: trial!.paidAt } } : { period: periodOf() }) },
  });
  return summarise(plan, onTrial, used._sum.credits ?? 0, wallet?.balance ?? 0);
}

/** How many of `want` reveals this account may attempt right now. Zero means refuse the request. */
export async function reserve(userId: string, want: number): Promise<{ allowed: number; summary: CreditSummary }> {
  const summary = await loadCredits(userId);
  return { allowed: Math.max(0, Math.min(want, summary.total)), summary };
}

export const NO_CREDITS_MESSAGE = 'You have no email reveals left. Your plan\'s monthly reveals are used up and your wallet is empty.';

/**
 * Charges one credit for each distinct email that was actually found. Already-revealed emails are free. Stops when the
 * balance runs out (the remaining emails are returned as `unaffordable`). Safe to call twice with the same emails.
 */
export async function chargeReveals(userId: string, emails: string[]): Promise<{ charged: number; alreadyRevealed: number; unaffordable: string[]; summary: CreditSummary }> {
  const unique = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)));
  let summary = await loadCredits(userId);
  let remaining = summary.remainingAllowance;
  const period = periodOf();
  let charged = 0, already = 0;
  const unaffordable: string[] = [];

  for (const email of unique) {
    const key = revealKeyOf(email);
    if (await prisma.emailCreditLedger.findUnique({ where: { userId_revealKey: { userId, revealKey: key } }, select: { id: true } })) { already++; continue; }
    try {
      if (remaining > 0) {
        await prisma.emailCreditLedger.create({ data: { userId, kind: 'reveal', source: 'allowance', credits: 1, revealKey: key, period } });
        remaining--; charged++;
        continue;
      }
      // Take from the wallet only if there is a credit to take, then record it; undo the take if the record is a duplicate.
      const took = await prisma.emailWallet.updateMany({ where: { userId, balance: { gte: 1 } }, data: { balance: { decrement: 1 } } });
      if (took.count === 0) { unaffordable.push(email); continue; }
      try {
        await prisma.emailCreditLedger.create({ data: { userId, kind: 'reveal', source: 'wallet', credits: 1, revealKey: key, period } });
        charged++;
      } catch (e) {
        await prisma.emailWallet.update({ where: { userId }, data: { balance: { increment: 1 } } });
        if ((e as { code?: string }).code === 'P2002') already++; else throw e;
      }
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') { already++; continue; } // a parallel request charged this email first
      throw e;
    }
  }
  summary = await loadCredits(userId);
  return { charged, alreadyRevealed: already, unaffordable, summary };
}

/** Adds credits to a wallet (a purchase, once checkout exists, or a grant by an administrator) and records it. */
export async function addToWallet(userId: string, credits: number, kind: 'topup' | 'grant', note?: string): Promise<number> {
  if (!Number.isInteger(credits) || credits <= 0 || credits > 100_000) throw new Error('Credits must be a positive whole number.');
  const w = await prisma.emailWallet.upsert({ where: { userId }, create: { userId, balance: credits }, update: { balance: { increment: credits } }, select: { balance: true } });
  await prisma.emailCreditLedger.create({ data: { userId, kind, source: 'wallet', credits, note: note?.slice(0, 190) ?? null } });
  return w.balance;
}
