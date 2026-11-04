import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';

/**
 * Suppression list and tombstones. Every path that would store a contact
 * value checks here first, so an opted-out, objected-to or erased value can't
 * come back through an import, an extractor or (later) a provider.
 *
 * Matching is by a KEYED hash — HMAC-SHA-256 under a server secret
 * (IA_SUPPRESSION_KEY) — stored as "hmac:<keyId>:<hex>". An unsalted hash of
 * a phone number can be reversed by enumerating every number; a keyed one
 * can't without the key. The plain value is kept only for domains (needed to
 * show and manage the blocklist), never for an email or phone.
 *
 * Keys: docs/suppression-keys.md (storage, rotation, recovery, migration).
 *   IA_SUPPRESSION_KEY           current secret, ≥32 characters (never in Git)
 *   IA_SUPPRESSION_KEY_ID        its id, e.g. "k1" (default "k1")
 *   IA_SUPPRESSION_KEYS_PREVIOUS "k0:<secret>,…" — still matched after rotation
 *   IA_SUPPRESSION_LEGACY_MATCH  "true" only during a migration window: also
 *                                match pre-P0 unsalted SHA-256 rows and
 *                                upgrade them to the current key on match
 * Without a valid key nothing is written or matched: suppression fails closed.
 */

export type SuppressionKind = 'email' | 'phone' | 'domain' | 'crawl_domain';
export type SuppressionReason =
  | 'opt_out' | 'objection' | 'erasure' | 'complaint' | 'bounce' | 'manual' | 'retention_expiry';

// Free/personal mailbox providers. An address here is probably a person's own
// inbox rather than a business one, so drafts to it are flagged for review.
export const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'hotmail.com', 'outlook.com',
  'live.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
];

const PLAIN_KINDS: SuppressionKind[] = ['domain', 'crawl_domain'];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailDomain(email: string): string | null {
  const e = normalizeEmail(email);
  const at = e.lastIndexOf('@');
  return at > 0 ? e.slice(at + 1) || null : null;
}

export function isPersonalEmail(email: string): boolean {
  const d = emailDomain(email);
  return !!d && PERSONAL_EMAIL_DOMAINS.includes(d);
}

export function normalizeSuppressionValue(kind: SuppressionKind, value: string): string {
  if (kind === 'email') return normalizeEmail(value);
  if (kind === 'domain' || kind === 'crawl_domain') return value.trim().toLowerCase().replace(/^@/, '').replace(/^www\./, '');
  return normalizePhone(value);
}

export class SuppressionKeyError extends Error {}

interface Key { id: string; secret: string }

function parseKey(id: string, secret: string | undefined): Key {
  if (!/^[a-z0-9]{1,16}$/.test(id)) throw new SuppressionKeyError('Suppression key id must be 1–16 lower-case letters/digits');
  if (!secret || secret.length < 32) throw new SuppressionKeyError('IA_SUPPRESSION_KEY must be set to a secret of at least 32 characters');
  return { id, secret };
}

export function suppressionKeys(): { current: Key; previous: Key[] } {
  const current = parseKey(process.env.IA_SUPPRESSION_KEY_ID || 'k1', process.env.IA_SUPPRESSION_KEY);
  const previous = (process.env.IA_SUPPRESSION_KEYS_PREVIOUS ?? '')
    .split(',').map((x) => x.trim()).filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf(':');
      if (i < 1) throw new SuppressionKeyError('IA_SUPPRESSION_KEYS_PREVIOUS must be "id:secret,…"');
      return parseKey(pair.slice(0, i), pair.slice(i + 1));
    })
    .filter((k) => k.id !== current.id);
  return { current, previous };
}

/** Throws SuppressionKeyError unless a valid key is configured. */
export function assertSuppressionKey(): void {
  suppressionKeys();
}

function hmac(key: Key, kind: SuppressionKind, normalized: string): string {
  return `hmac:${key.id}:${crypto.createHmac('sha256', key.secret).update(`${kind}:${normalized}`).digest('hex')}`;
}

function legacyHash(kind: SuppressionKind, normalized: string): string {
  return crypto.createHash('sha256').update(`${kind}:${normalized}`).digest('hex');
}

/** The hash new entries are written with (current key). */
export function suppressionHash(kind: SuppressionKind, normalized: string): string {
  return hmac(suppressionKeys().current, kind, normalized);
}

/** Every stored form a value may have: current key, previous keys, and (only if enabled) legacy. */
function candidateHashes(kind: SuppressionKind, normalized: string): { current: string; all: string[]; legacy: string | null } {
  const { current, previous } = suppressionKeys();
  const cur = hmac(current, kind, normalized);
  const legacy = process.env.IA_SUPPRESSION_LEGACY_MATCH === 'true' ? legacyHash(kind, normalized) : null;
  return { current: cur, all: [cur, ...previous.map((k) => hmac(k, kind, normalized)), ...(legacy ? [legacy] : [])], legacy };
}

/** A legacy unsalted row found by value is rewritten under the current key (or dropped if that already exists). */
async function upgradeLegacy(rowId: string, currentHash: string) {
  try {
    await prisma.acquisitionSuppression.updateMany({ where: { id: rowId }, data: { valueHash: currentHash } });
  } catch (err) {
    if ((err as { code?: string }).code !== 'P2002') throw err;
    await prisma.acquisitionSuppression.deleteMany({ where: { id: rowId } });
  }
}

function display(kind: string, value: string | null, hash: string): string {
  return value ? `${kind}:${value}` : `${kind}:#${hash.slice(-10)}`;
}

/**
 * Every active entry that matches the contact. Hits are labels safe to show
 * and store ("email:#3fa2…", "domain:clinic.ng"), never the raw email/phone.
 */
export async function findSuppressionHits(
  userId: string,
  contact: { email?: string | null; phone?: string | null; domain?: string | null },
): Promise<string[]> {
  const candidates: Array<{ kind: SuppressionKind; hash: string; current: string; legacy: string | null }> = [];
  const push = (kind: SuppressionKind, raw: string | null | undefined) => {
    if (!raw) return;
    const n = normalizeSuppressionValue(kind, raw);
    if (!n) return;
    const h = candidateHashes(kind, n);
    for (const hash of h.all) candidates.push({ kind, hash, current: h.current, legacy: h.legacy });
  };
  push('email', contact.email);
  if (contact.email) {
    const d = emailDomain(contact.email);
    // A personal-provider domain is never suppressed wholesale.
    if (d && !PERSONAL_EMAIL_DOMAINS.includes(d)) push('domain', d);
  }
  push('domain', contact.domain);
  push('phone', contact.phone);
  if (candidates.length === 0) return [];

  const now = new Date();
  const hits = await prisma.acquisitionSuppression.findMany({
    where: { userId, OR: candidates.map((c) => ({ kind: c.kind, valueHash: c.hash })) },
    select: { id: true, kind: true, value: true, valueHash: true, expiresAt: true },
  });
  for (const h of hits as Array<{ id: string; valueHash: string }>) {
    const c = candidates.find((x) => x.legacy && x.hash === h.valueHash);
    if (c) await upgradeLegacy(h.id, c.current);
  }
  return hits
    .filter((h: { expiresAt: Date | null }) => !h.expiresAt || h.expiresAt > now)
    .map((h: { kind: string; value: string | null; valueHash: string }) => display(h.kind, h.value, h.valueHash));
}

export async function isCrawlBlocked(userId: string, domain: string): Promise<boolean> {
  const n = normalizeSuppressionValue('crawl_domain', domain);
  const hit = await prisma.acquisitionSuppression.findFirst({
    where: { userId, kind: 'crawl_domain', OR: candidateHashes('crawl_domain', n).all.map((valueHash) => ({ valueHash })) },
    select: { id: true },
  });
  return !!hit;
}

/**
 * Idempotent: an already-present entry is left as it is, except that a
 * permanent reason replaces a temporary retention_expiry marker.
 */
export async function addSuppression(params: {
  userId: string;
  kind: SuppressionKind;
  value: string;
  reason: SuppressionReason;
  source: string;
  expiresAt?: Date;
}): Promise<void> {
  const normalized = normalizeSuppressionValue(params.kind, params.value);
  if (!normalized) throw new Error('Cannot suppress an empty value');
  const cand = candidateHashes(params.kind, normalized); // throws without a valid key
  const valueHash = cand.current;
  const permanent = params.reason !== 'retention_expiry';

  // Already suppressed under any key (or legacy)? Then don't add a second row.
  const existing = await prisma.acquisitionSuppression.findFirst({
    where: { userId: params.userId, kind: params.kind, OR: cand.all.map((h) => ({ valueHash: h })) },
    select: { id: true, valueHash: true, reason: true },
  });
  if (existing) {
    if (cand.legacy && existing.valueHash === cand.legacy) await upgradeLegacy(existing.id, valueHash);
    if (permanent && existing.reason === 'retention_expiry') {
      await prisma.acquisitionSuppression.updateMany({
        where: { id: existing.id },
        data: { reason: params.reason, expiresAt: null, source: params.source.slice(0, 190) },
      });
    }
    return;
  }
  try {
    await prisma.acquisitionSuppression.create({
      data: {
        userId: params.userId,
        kind: params.kind,
        value: PLAIN_KINDS.includes(params.kind) ? normalized : null,
        valueHash,
        reason: params.reason,
        source: params.source.slice(0, 190),
        expiresAt: permanent ? null : params.expiresAt ?? null,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code !== 'P2002') throw err;
    if (permanent) {
      await prisma.acquisitionSuppression.updateMany({
        where: { userId: params.userId, kind: params.kind, valueHash, reason: 'retention_expiry' },
        data: { reason: params.reason, expiresAt: null, source: params.source.slice(0, 190) },
      });
    }
  }
}
