import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
import { normalizeForDedup } from '@/lib/overpass';
import { domainFromUrl } from '@/lib/apollo';
import { registrableDomain } from './web/url';

/**
 * Duplicate-detection keys for acquisition prospects.
 *   strong: place_id, registrable domain, normalised business phone → merge
 *   weak:   normalised name + area → flag "possible duplicate" for an admin
 */

export type IdentityKind = 'place_id' | 'domain' | 'phone' | 'name_area';
export interface IdentityKey { kind: IdentityKind; value: string }

export const STRONG: IdentityKind[] = ['place_id', 'domain', 'phone'];

export function siteDomain(website?: string | null): string | null {
  // Reuses the existing rule that social pages and site builders are not company domains.
  const host = domainFromUrl(website ?? null);
  return host ? registrableDomain(host) : null;
}

export function identityKeys(input: {
  placeId?: string | null; website?: string | null; phone?: string | null; name?: string | null; area?: string | null;
}): IdentityKey[] {
  const keys: IdentityKey[] = [];
  if (input.placeId) keys.push({ kind: 'place_id', value: input.placeId.trim() });
  const d = siteDomain(input.website);
  if (d) keys.push({ kind: 'domain', value: d });
  const p = input.phone ? normalizePhone(input.phone) : '';
  if (p && p.length >= 10) keys.push({ kind: 'phone', value: p });
  if (input.name) {
    const n = normalizeForDedup(input.name);
    const a = (input.area ?? '').trim().toLowerCase();
    if (n) keys.push({ kind: 'name_area', value: `${n}|${a}` });
  }
  return keys;
}

/** Existing acquisition prospects holding any of the keys. */
export async function findIdentityMatches(userId: string, keys: IdentityKey[]) {
  if (keys.length === 0) return [];
  const hits = await prisma.acquisitionIdentity.findMany({
    where: { userId, OR: keys.map((k) => ({ kind: k.kind, value: k.value })) },
    select: { acqProspectId: true, kind: true, value: true },
  });
  return hits as Array<{ acqProspectId: string; kind: IdentityKind; value: string }>;
}

/** Deterministic CRM id for prospects without a Google place ID. */
export function acquisitionBusinessId(keys: IdentityKey[], name: string): string {
  const basis = keys.filter((k) => k.kind === 'domain' || k.kind === 'phone').map((k) => `${k.kind}:${k.value}`).sort().join('|')
    || `name:${normalizeForDedup(name)}`;
  return `acq_${crypto.createHash('sha256').update(basis).digest('hex').slice(0, 24)}`;
}

export interface CrmIndex {
  byBusinessId: Map<string, { id: string; contacted: boolean; source: string | null }>;
  byDomain: Map<string, { id: string; contacted: boolean }>;
  byPhone: Map<string, { id: string; contacted: boolean }>;
  byName: Map<string, { id: string; contacted: boolean }>;
}

/**
 * Read-only index of the admin's existing CRM, so a clinic already being
 * worked (e.g. pitched through the WhatsApp workflow) is flagged rather than
 * picked up again. Values are read in memory only; nothing from these rows is
 * copied into acquisition tables except the matching prospect id.
 */
export async function buildCrmIndex(userId: string): Promise<CrmIndex> {
  const prospects = await prisma.prospect.findMany({
    where: { userId },
    select: { id: true, businessId: true, businessName: true, businessData: true, outreachSentAt: true, source: true },
  });
  const idx: CrmIndex = { byBusinessId: new Map(), byDomain: new Map(), byPhone: new Map(), byName: new Map() };
  for (const p of prospects as Array<{ id: string; businessId: string; businessName: string; businessData: unknown; outreachSentAt: Date | null; source: string | null }>) {
    const contacted = !!p.outreachSentAt;
    idx.byBusinessId.set(p.businessId, { id: p.id, contacted, source: p.source });
    if (p.source === 'industry-acquisition') continue; // ours: handled by identities
    const data = (p.businessData ?? {}) as { website?: string; phone?: string };
    const d = siteDomain(data.website);
    if (d) idx.byDomain.set(d, { id: p.id, contacted });
    const ph = data.phone ? normalizePhone(data.phone) : '';
    if (ph.length >= 10) idx.byPhone.set(ph, { id: p.id, contacted });
    const n = normalizeForDedup(p.businessName ?? '');
    if (n) idx.byName.set(n, { id: p.id, contacted });
  }
  return idx;
}

export function crmConflictFor(idx: CrmIndex, businessId: string, keys: IdentityKey[], name: string): string | null {
  const b = idx.byBusinessId.get(businessId);
  if (b && b.source !== 'industry-acquisition') return b.contacted ? 'already_contacted_in_crm' : 'already_in_crm';
  for (const k of keys) {
    const hit = k.kind === 'domain' ? idx.byDomain.get(k.value) : k.kind === 'phone' ? idx.byPhone.get(k.value) : undefined;
    if (hit) return hit.contacted ? 'already_contacted_in_crm' : 'already_in_crm';
  }
  const n = idx.byName.get(normalizeForDedup(name));
  if (n) return n.contacted ? 'possibly_contacted_in_crm' : 'possibly_in_crm';
  return null;
}
