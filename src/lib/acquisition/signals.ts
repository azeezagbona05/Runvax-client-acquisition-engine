import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Stores one fact about a prospect with its provenance. Signals only ever
 * come from independent sources (the clinic's own website, PageSpeed, an
 * import, manual entry) or from our own industry config — never from Google
 * Places content (see docs/phase-2-plan.md §1).
 *
 * Seeing the same fact again refreshes lastVerifiedAt instead of adding a
 * row. A different value for the same code supersedes the previous one.
 */

export type Basis = 'observed' | 'inferred' | 'unknown';
export type Method = 'html_rule' | 'csv' | 'manual' | 'industry_config' | 'psi_api';
export type Confidence = 'high' | 'medium' | 'low';

export interface SignalInput {
  userId: string;
  acqProspectId: string;
  code: string;
  value: boolean | number | string | null;
  basis: Basis;
  method: Method;
  confidence: Confidence;
  sourceId?: string | null;
  sourceUrl?: string | null;
  quote?: string | null;
  now?: Date;
}

export function signalHash(s: Pick<SignalInput, 'code' | 'value' | 'basis' | 'sourceUrl'>): string {
  return crypto.createHash('sha256').update(JSON.stringify([s.code, s.value, s.basis, s.sourceUrl ?? null])).digest('hex');
}

export async function recordSignal(s: SignalInput): Promise<{ id: string; created: boolean }> {
  const now = s.now ?? new Date();
  const contentHash = signalHash(s);
  const existing = await prisma.acquisitionSignal.findFirst({
    where: { acqProspectId: s.acqProspectId, code: s.code, contentHash },
    select: { id: true },
  });
  if (existing) {
    await prisma.acquisitionSignal.updateMany({ where: { id: existing.id }, data: { lastVerifiedAt: now, supersededAt: null } });
    return { id: existing.id, created: false };
  }
  await prisma.acquisitionSignal.updateMany({
    where: { acqProspectId: s.acqProspectId, code: s.code, supersededAt: null },
    data: { supersededAt: now },
  });
  const row = await prisma.acquisitionSignal.create({
    data: {
      userId: s.userId,
      acqProspectId: s.acqProspectId,
      code: s.code,
      value: s.value as Prisma.InputJsonValue,
      basis: s.basis,
      method: s.method,
      confidence: s.confidence,
      sourceId: s.sourceId ?? null,
      sourceUrl: s.sourceUrl ?? null,
      evidenceQuote: s.quote ? s.quote.slice(0, 300) : null,
      contentHash,
      observedAt: now,
      lastVerifiedAt: now,
    },
  });
  return { id: row.id, created: true };
}

export async function activeSignals(userId: string, acqProspectId: string) {
  return prisma.acquisitionSignal.findMany({
    where: { userId, acqProspectId, supersededAt: null },
    orderBy: { observedAt: 'asc' },
  });
}
