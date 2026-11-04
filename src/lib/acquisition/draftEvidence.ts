import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import type { IndustryConfig, Offer } from './config/schema';
import { freshnessFactor } from './scoring';

/**
 * Versions a draft is bound to. A draft (and any approval of it) records the
 * hash of the exact evidence it relies on and of the offer configuration it
 * was generated from. If either changes, the draft is stale.
 *
 * The evidence hash covers each cited signal's id, code, value, basis,
 * confidence and content hash — but NOT lastVerifiedAt, so simply re-seeing
 * the same fact doesn't invalidate a draft. A cited signal that is
 * superseded, deleted, or past the industry's stale threshold makes the
 * evidence no longer current.
 */

export interface HashableSignal { id: string; code: string; value: unknown; basis: string; confidence: string; contentHash: string }

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`;
}

export function evidenceHashOf(signals: HashableSignal[]): string {
  return sha(stable([...signals].map((s) => [s.id, s.code, s.value, s.basis, s.confidence, s.contentHash]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))));
}

export function offerHashOf(offer: Offer): string {
  return sha(stable(offer));
}

export interface EvidenceState { hash: string; missing: string[]; superseded: string[]; stale: string[]; current: boolean }

/** Current state of the cited signals, as stored now. */
export async function currentEvidence(userId: string, acqProspectId: string, signalIds: string[], industry: IndustryConfig, now = new Date()): Promise<EvidenceState> {
  const rows = signalIds.length === 0 ? [] : await prisma.acquisitionSignal.findMany({
    where: { userId, acqProspectId, id: { in: signalIds } },
    select: { id: true, code: true, value: true, basis: true, confidence: true, contentHash: true, supersededAt: true, lastVerifiedAt: true },
  }) as Array<HashableSignal & { supersededAt: Date | null; lastVerifiedAt: Date }>;
  const found = new Set(rows.map((r) => r.id));
  const missing = signalIds.filter((id) => !found.has(id));
  const superseded = rows.filter((r) => r.supersededAt).map((r) => r.id);
  const stale = rows.filter((r) => freshnessFactor(r.lastVerifiedAt, now, industry.retention) === 0).map((r) => r.id);
  return {
    hash: evidenceHashOf(rows.filter((r) => !r.supersededAt)),
    missing, superseded, stale,
    current: missing.length === 0 && superseded.length === 0 && stale.length === 0,
  };
}
