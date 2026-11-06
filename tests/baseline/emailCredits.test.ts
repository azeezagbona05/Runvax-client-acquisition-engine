import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = { userId: string; kind: string; source: string; credits: number; revealKey?: string | null; period?: string | null; createdAt: Date };
const db = vi.hoisted(() => {
  const s = { plan: 'pro', trial: null as { paidAt: Date } | null, paid: 0, wallet: null as { balance: number } | null, ledger: [] as Row[] };
  const dup = () => Object.assign(new Error('dup'), { code: 'P2002' });
  return {
    s,
    prisma: {
      user: { findUnique: async () => ({ plan: s.plan }) },
      payment: { findUnique: async () => s.trial, count: async () => s.paid },
      emailWallet: {
        findUnique: async () => s.wallet,
        updateMany: async (a: { where: { balance: { gte: number } }; data: { balance: { decrement: number } } }) => {
          if (!s.wallet || s.wallet.balance < a.where.balance.gte) return { count: 0 };
          s.wallet.balance -= a.data.balance.decrement; return { count: 1 };
        },
        update: async (a: { data: { balance: { increment: number } } }) => { s.wallet!.balance += a.data.balance.increment; return s.wallet; },
        upsert: async (a: { create: { balance: number }; update: { balance: { increment: number } } }) => { if (s.wallet) s.wallet.balance += a.update.balance.increment; else s.wallet = { balance: a.create.balance }; return s.wallet; },
      },
      emailCreditLedger: {
        aggregate: async (a: { where: { source: string; period?: string; createdAt?: { gte: Date } } }) => ({ _sum: { credits: s.ledger.filter((r) => r.kind === 'reveal' && r.source === a.where.source && (a.where.period ? r.period === a.where.period : r.createdAt >= a.where.createdAt!.gte)).reduce((n, r) => n + r.credits, 0) } }),
        findUnique: async (a: { where: { userId_revealKey: { revealKey: string } } }) => s.ledger.find((r) => r.revealKey === a.where.userId_revealKey.revealKey) ?? null,
        create: async (a: { data: Omit<Row, 'createdAt'> }) => { if (a.data.revealKey && s.ledger.some((r) => r.revealKey === a.data.revealKey)) throw dup(); s.ledger.push({ ...a.data, createdAt: new Date() }); return {}; },
      },
    },
  };
});
vi.mock('@/lib/prisma', () => ({ prisma: db.prisma }));

import { PLAN_ALLOWANCE, TRIAL_ALLOWANCE, addToWallet, allowanceFor, chargeReveals, loadCredits, periodOf, reserve, summarise } from '@/lib/emailCredits';

beforeEach(() => { Object.assign(db.s, { plan: 'pro', trial: null, paid: 1, wallet: null, ledger: [] }); });

describe('allowances', () => {
  it('uses the plan allowance, or the small trial one', () => {
    expect(allowanceFor('pro', false)).toBe(PLAN_ALLOWANCE.pro);
    expect(allowanceFor('pro', true)).toBe(TRIAL_ALLOWANCE);
    expect(allowanceFor('free', false)).toBe(0);
    expect(allowanceFor('mystery', false)).toBe(0);
  });
  it('summarises without going negative', () => {
    expect(summarise('pro', false, 130, 5)).toMatchObject({ remainingAllowance: 0, wallet: 5, total: 5 });
    expect(summarise('pro', false, 40, 10)).toMatchObject({ remainingAllowance: 60, total: 70 });
  });
});

describe('charging', () => {
  it('charges one credit per distinct successful email, from the allowance first', async () => {
    const r = await chargeReveals('u1', ['A@x.com', 'a@x.com', 'b@x.com']);
    expect(r.charged).toBe(2);
    expect(r.summary.used).toBe(2);
    expect(db.s.ledger.every((l) => l.source === 'allowance')).toBe(true);
  });
  it('never charges the same email twice, even in a later request', async () => {
    await chargeReveals('u1', ['a@x.com']);
    const again = await chargeReveals('u1', ['A@X.com']);
    expect(again.charged).toBe(0);
    expect(again.alreadyRevealed).toBe(1);
    expect(db.s.ledger).toHaveLength(1);
  });
  it('moves to the wallet when the allowance is used up, and stops when both are empty', async () => {
    db.s.wallet = { balance: 1 };
    for (let i = 0; i < PLAN_ALLOWANCE.pro; i++) db.s.ledger.push({ userId: 'u1', kind: 'reveal', source: 'allowance', credits: 1, revealKey: `email:old${i}@x.com`, period: periodOf(), createdAt: new Date() });
    const r = await chargeReveals('u1', ['n1@x.com', 'n2@x.com']);
    expect(r.charged).toBe(1);
    expect(r.unaffordable).toEqual(['n2@x.com']);
    expect(db.s.wallet.balance).toBe(0);
    expect(db.s.ledger.at(-1)).toMatchObject({ source: 'wallet', revealKey: 'email:n1@x.com' });
  });
  it('charges nothing when nothing was found', async () => {
    const r = await chargeReveals('u1', []);
    expect(r.charged).toBe(0);
    expect(db.s.ledger).toHaveLength(0);
  });
  it('a duplicate that lands between check and write is not charged and the wallet is given back', async () => {
    db.s.wallet = { balance: 2 };
    db.s.plan = 'free'; // allowance 0, so the wallet path runs
    const orig = db.prisma.emailCreditLedger.findUnique;
    let first = true;
    db.prisma.emailCreditLedger.findUnique = async (a) => { if (first) { first = false; db.s.ledger.push({ userId: 'u1', kind: 'reveal', source: 'wallet', credits: 1, revealKey: 'email:r@x.com', createdAt: new Date() }); return null; } return orig(a); };
    const r = await chargeReveals('u1', ['r@x.com']);
    db.prisma.emailCreditLedger.findUnique = orig;
    expect(r.charged).toBe(0);
    expect(db.s.wallet.balance).toBe(2);
  });
});

describe('reserve and trial', () => {
  it('only allows as many reveals as the balance covers', async () => {
    db.s.plan = 'free'; db.s.wallet = { balance: 3 };
    expect((await reserve('u1', 10)).allowed).toBe(3);
    db.s.wallet = { balance: 0 };
    expect((await reserve('u1', 10)).allowed).toBe(0);
  });
  it('a trial gets the small one-off allowance, counted from when it started', async () => {
    db.s.paid = 0; db.s.trial = { paidAt: new Date(Date.now() - 86_400_000) };
    const c = await loadCredits('u1');
    expect(c).toMatchObject({ onTrial: true, allowance: TRIAL_ALLOWANCE, total: TRIAL_ALLOWANCE });
  });
  it('a paying Professional customer is not on a trial even if they once had one', async () => {
    db.s.paid = 1; db.s.trial = { paidAt: new Date() };
    expect((await loadCredits('u1')).onTrial).toBe(false);
  });
});

describe('wallet', () => {
  it('adds credits and records them', async () => {
    expect(await addToWallet('u1', 50, 'grant', 'welcome')).toBe(50);
    expect(await addToWallet('u1', 100, 'topup')).toBe(150);
    expect(db.s.ledger).toHaveLength(2);
    await expect(addToWallet('u1', 0, 'grant')).rejects.toThrow();
    await expect(addToWallet('u1', 1.5, 'grant')).rejects.toThrow();
  });
});
