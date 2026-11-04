import crypto from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { IndustryConfig } from '../config/schema';
import { getIndustry } from '../config/registry';
import { parseCsv, looksLikeFormula, CsvError } from './csv';
import { identityKeys, findIdentityMatches, acquisitionBusinessId, buildCrmIndex, crmConflictFor, siteDomain, STRONG, type IdentityKey } from '../identity';
import { findSuppressionHits } from '../suppression';
import { classifyEmail, isEmail, storeContact } from '../contacts';
import { enqueueAcqTask } from '../tasks/queue';
import { recordSignal } from '../signals';

/**
 * CSV and manual prospect imports: preview first (nothing but the batch is
 * written), then commit with the admin's attestation that the data was
 * lawfully obtained from the stated source. Google Maps / Places-sourced rows
 * are rejected so that content can't be brought in through a spreadsheet.
 */

const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;
const ALLOWED_BASES = ['legitimate_interest_b2b', 'consent'] as const;

const opt = (max: number) => z.string().max(max).optional().transform((v) => (v && v.trim() ? v.trim() : undefined));

export const ImportRowSchema = z.strictObject({
  business_name: z.string().trim().min(2).max(200),
  source: z.string().trim().min(2).max(200),
  source_url: opt(500).refine((v) => !v || /^https?:\/\//i.test(v), 'source_url must be an http(s) URL'),
  website: opt(500),
  phone: opt(40),
  email: opt(200).refine((v) => !v || isEmail(v), 'email is not a valid address'),
  address: opt(300),
  area: opt(100),
  city: opt(100),
  place_id: opt(300).refine((v) => !v || /^[A-Za-z0-9_-]{10,300}$/.test(v), 'place_id has an unexpected format'),
  contact_name: opt(150),
  contact_role: opt(150),
  contact_email: opt(200).refine((v) => !v || isEmail(v), 'contact_email is not a valid address'),
  contact_phone: opt(40),
  lawful_basis: opt(50),
  notes: opt(500),
});
export type ImportRow = z.infer<typeof ImportRowSchema>;

export type RowOutcome = 'accepted' | 'duplicate' | 'rejected';
export interface RowResult {
  row: number;
  outcome: RowOutcome;
  businessName?: string;
  reasons: string[];
  flags: string[];
}

export interface PreviewResult {
  batchId: string;
  status: string;
  rowCount: number;
  accepted: number;
  duplicates: number;
  rejected: number;
  results: RowResult[];
}

export class ImportError extends Error {}

function hashText(t: string) {
  return crypto.createHash('sha256').update(t).digest('hex');
}

function prohibitedSource(source: string, industry: IndustryConfig): boolean {
  const s = source.toLowerCase();
  return industry.imports.prohibitedSourcePhrases.some((p) => s.includes(p.toLowerCase()));
}

async function evaluateRows(userId: string, industry: IndustryConfig, raw: Array<Record<string, string>>) {
  const crm = await buildCrmIndex(userId);
  const seen = new Map<string, { row: number; placeId?: string }>(); // strong key → first row in this file
  const results: RowResult[] = [];
  const accepted: Array<{ row: number; data: ImportRow; keys: IdentityKey[]; crmConflict: string | null; businessId: string; possibleDuplicate: boolean }> = [];

  for (let i = 0; i < raw.length; i++) {
    const rowNo = i + 2; // 1-based, after the header
    const r: RowResult = { row: rowNo, outcome: 'rejected', reasons: [], flags: [] };
    results.push(r);

    const formulaCols = Object.entries(raw[i]).filter(([, v]) => looksLikeFormula(v)).map(([k]) => k);
    if (formulaCols.length) r.flags.push(`formula_like_cells:${formulaCols.join(',')}`);

    const parsed = ImportRowSchema.safeParse(raw[i]);
    if (!parsed.success) {
      r.reasons.push(...parsed.error.issues.map((x) => `${x.path.join('.') || 'row'}: ${x.message}`));
      continue;
    }
    const d = parsed.data;
    r.businessName = d.business_name;

    if (prohibitedSource(d.source, industry) || (d.source_url && /google\.|goo\.gl|maps\./i.test(d.source_url))) {
      r.reasons.push('source is Google Maps / Places — that content may not be stored');
      continue;
    }
    if (d.city && d.city.toLowerCase() !== industry.geography.city.toLowerCase()) r.flags.push('outside_configured_city');

    const hasContact = !!(d.contact_name || d.contact_email || d.contact_phone);
    if (hasContact && !d.contact_name) { r.reasons.push('contact_email/contact_phone given without contact_name'); continue; }
    if (hasContact && !(ALLOWED_BASES as readonly string[]).includes(d.lawful_basis ?? '')) {
      r.reasons.push('named contact requires lawful_basis (legitimate_interest_b2b or consent)');
      continue;
    }
    if (d.email && classifyEmail(d.email, industry.research.roleInboxLocalParts) !== 'role') {
      r.reasons.push('email column is for business role inboxes (info@, reception@…); put a person\'s address in contact_email with a lawful_basis');
      continue;
    }

    const domain = siteDomain(d.website);
    const hits = await findSuppressionHits(userId, { email: d.email, phone: d.phone, domain });
    const contactHits = hasContact ? await findSuppressionHits(userId, { email: d.contact_email, phone: d.contact_phone }) : [];
    if (hits.length || contactHits.length) {
      r.reasons.push('contains a suppressed or erased value — the row is not imported');
      continue;
    }

    const keys = identityKeys({ placeId: d.place_id, website: d.website, phone: d.phone, name: d.business_name, area: d.area ?? d.city });
    const strong = keys.filter((k) => STRONG.includes(k.kind));

    // Branches: same domain/phone but a DIFFERENT Google place ID are separate
    // locations of one organisation — kept apart, linked by orgDomain.
    // Without distinguishing place IDs a strong match is a duplicate.
    let branchOf: string | null = null;
    const fileHit = strong.map((k) => ({ k, hit: seen.get(`${k.kind}:${k.value}`) })).find((x) => x.hit);
    if (fileHit?.hit) {
      const isBranch = fileHit.k.kind !== 'place_id' && !!d.place_id && !!fileHit.hit.placeId && fileHit.hit.placeId !== d.place_id;
      if (!isBranch) { r.outcome = 'duplicate'; r.reasons.push(`same clinic as row ${fileHit.hit.row} in this file`); continue; }
      branchOf = `row ${fileHit.hit.row}`;
    }
    const existing = await findIdentityMatches(userId, keys);
    const strongExisting = existing.filter((e) => STRONG.includes(e.kind));
    if (strongExisting.length > 0) {
      if (strongExisting.some((e) => e.kind === 'place_id') || !d.place_id) {
        r.outcome = 'duplicate';
        r.reasons.push('already an acquisition prospect (same place ID, website domain or phone)');
        continue;
      }
      const theirPlaceIds = await prisma.acquisitionIdentity.findMany({
        where: { userId, kind: 'place_id', acqProspectId: { in: strongExisting.map((e) => e.acqProspectId) } },
        select: { value: true },
      });
      if (theirPlaceIds.length === 0) {
        r.outcome = 'duplicate';
        r.reasons.push('already an acquisition prospect with the same website domain or phone');
        continue;
      }
      branchOf = 'an existing prospect';
    }
    if (branchOf) r.flags.push(`branch_of:${branchOf}`);
    const possibleDuplicate = existing.some((e) => e.kind === 'name_area');
    if (possibleDuplicate) r.flags.push('possible_duplicate_same_name_and_area');

    const businessId = d.place_id ?? acquisitionBusinessId(keys, d.business_name);
    const crmConflict = crmConflictFor(crm, businessId, keys, d.business_name);
    if (crmConflict) r.flags.push(`crm_conflict:${crmConflict}`);

    strong.forEach((k) => { if (!seen.has(`${k.kind}:${k.value}`)) seen.set(`${k.kind}:${k.value}`, { row: rowNo, placeId: d.place_id }); });
    r.outcome = 'accepted';
    accepted.push({ row: rowNo, data: d, keys, crmConflict, businessId, possibleDuplicate });
  }
  return { results, accepted };
}

export async function previewImport(params: {
  userId: string; industryKey: string; kind: 'csv' | 'manual'; csvText?: string; manualRow?: Record<string, string>; label?: string;
}): Promise<PreviewResult> {
  const industry = getIndustry(params.industryKey);
  if (!industry) throw new ImportError(`Unknown industry "${params.industryKey}"`);

  let raw: Array<Record<string, string>>;
  let fingerprint: string;
  if (params.kind === 'csv') {
    if (typeof params.csvText !== 'string') throw new ImportError('csvText is required');
    try {
      raw = parseCsv(params.csvText, { maxBytes: industry.imports.maxBytes, maxRows: industry.imports.maxRows }).rows;
    } catch (err) {
      if (err instanceof CsvError) throw new ImportError(err.message);
      throw err;
    }
    fingerprint = hashText(`${params.industryKey}\n${params.csvText}`);
  } else {
    if (!params.manualRow) throw new ImportError('manualRow is required');
    raw = [Object.fromEntries(Object.entries(params.manualRow).map(([k, v]) => [k, String(v ?? '').trim()]))];
    fingerprint = hashText(`${params.industryKey}\nmanual\n${JSON.stringify(raw[0])}`);
  }

  const prior = await prisma.acquisitionImportBatch.findFirst({ where: { userId: params.userId, fileHash: fingerprint } });
  if (prior && (prior.status === 'committed' || prior.expiresAt > new Date())) {
    return summarise(prior);
  }
  if (prior) await prisma.acquisitionImportBatch.deleteMany({ where: { id: prior.id } });

  const { results, accepted } = await evaluateRows(params.userId, industry, raw);
  const batch = await prisma.acquisitionImportBatch.create({
    data: {
      userId: params.userId,
      industryKey: params.industryKey,
      kind: params.kind,
      label: params.label?.slice(0, 190),
      fileHash: fingerprint,
      status: 'previewed',
      rowCount: raw.length,
      acceptedCount: accepted.length,
      duplicateCount: results.filter((r) => r.outcome === 'duplicate').length,
      rejectedCount: results.filter((r) => r.outcome === 'rejected').length,
      rows: accepted as unknown as Prisma.InputJsonValue,
      results: results as unknown as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
    },
  });
  return summarise(batch);
}

function summarise(b: { id: string; status: string; rowCount: number; acceptedCount: number; duplicateCount: number; rejectedCount: number; results: unknown }): PreviewResult {
  return {
    batchId: b.id, status: b.status, rowCount: b.rowCount,
    accepted: b.acceptedCount, duplicates: b.duplicateCount, rejected: b.rejectedCount,
    results: (b.results ?? []) as RowResult[],
  };
}

export async function commitImport(params: { userId: string; batchId: string; attestedBy: string; attest: boolean }): Promise<{ created: number; skipped: number; acqProspectIds: string[] }> {
  if (params.attest !== true) throw new ImportError('You must confirm the data was lawfully obtained and the sources are accurate');
  const batch = await prisma.acquisitionImportBatch.findFirst({ where: { id: params.batchId, userId: params.userId } });
  if (!batch) throw new ImportError('Import not found');
  if (batch.status === 'committed') return { created: 0, skipped: 0, acqProspectIds: [] };
  if (batch.status !== 'previewed' || batch.expiresAt <= new Date()) throw new ImportError('This preview has expired; upload the file again');
  const industry = getIndustry(batch.industryKey);
  if (!industry) throw new ImportError(`Unknown industry "${batch.industryKey}"`);

  const rows = (batch.rows ?? []) as unknown as Array<{ row: number; data: ImportRow; keys: IdentityKey[]; crmConflict: string | null; businessId: string; possibleDuplicate: boolean }>;
  const ids: string[] = [];
  let skipped = 0;
  for (const r of rows) {
    // Re-check: another import may have created the same clinic since the preview.
    const existing = await findIdentityMatches(params.userId, r.keys);
    const hasPlaceId = r.keys.some((k) => k.kind === 'place_id');
    if (existing.some((e) => e.kind === 'place_id') || (!hasPlaceId && existing.some((e) => STRONG.includes(e.kind)))) { skipped++; continue; }
    const id = await createProspectFromRow(params.userId, industry, batch.id, batch.kind as 'csv' | 'manual', r, params.attestedBy);
    if (id) ids.push(id); else skipped++;
  }

  // Parsed rows (which may include contact details) are no longer needed.
  await prisma.acquisitionImportBatch.update({
    where: { id: batch.id },
    data: { status: 'committed', rows: Prisma.DbNull, attestedBy: params.attestedBy, attestedAt: new Date() },
  });
  return { created: ids.length, skipped, acqProspectIds: ids };
}

async function createProspectFromRow(
  userId: string, industry: IndustryConfig, batchId: string, kind: 'csv' | 'manual',
  r: { row: number; data: ImportRow; keys: IdentityKey[]; crmConflict: string | null; businessId: string; possibleDuplicate: boolean },
  actor: string,
): Promise<string | null> {
  const d = r.data;
  // Never modify an existing CRM prospect: reuse it if the id already exists.
  let prospect = await prisma.prospect.findFirst({ where: { userId, businessId: r.businessId }, select: { id: true } });
  if (prospect) {
    const taken = await prisma.acquisitionProspect.findFirst({ where: { prospectId: prospect.id }, select: { id: true } });
    if (taken) return null;
  } else {
    prospect = await prisma.prospect.create({
      data: {
        userId,
        businessId: r.businessId,
        businessName: d.business_name,
        // Only independently sourced fields from the import — never Places content.
        businessData: {
          id: r.businessId, name: d.business_name, address: d.address ?? '', phone: d.phone, email: d.email,
          website: d.website, hasWebsite: !!d.website, category: industry.displayName, source: kind,
        } as Prisma.InputJsonValue,
        stage: 'found',
        source: 'industry-acquisition',
      },
      select: { id: true },
    });
  }

  const acq = await prisma.acquisitionProspect.create({
    data: {
      userId, prospectId: prospect.id, industryKey: industry.id, state: 'discovered',
      area: d.area ?? null, orgDomain: siteDomain(d.website), crmConflict: r.crmConflict,
      importBatchId: batchId, lastVerifiedAt: new Date(),
    },
  });
  for (const k of r.keys) {
    try {
      await prisma.acquisitionIdentity.create({ data: { userId, acqProspectId: acq.id, kind: k.kind, value: k.value } });
    } catch (err) {
      if ((err as { code?: string }).code !== 'P2002') throw err; // weak key already held elsewhere: fine
    }
  }
  const source = await prisma.acquisitionSource.create({
    data: {
      userId, acqProspectId: acq.id, kind, url: d.source_url ?? null, method: kind === 'csv' ? 'csv_import' : 'manual_entry',
      contentHash: hashText(JSON.stringify({ ...d, contact_email: undefined, contact_phone: undefined, contact_name: undefined })),
    },
  });

  const via = kind === 'csv' ? 'csv' : 'manual';
  await recordSignal({ userId, acqProspectId: acq.id, code: 'website_present', value: !!d.website, basis: 'inferred', method: via, confidence: 'low', sourceId: source.id, sourceUrl: d.source_url, quote: d.website ? `website: ${d.website}` : 'no website in the import row' });
  await recordSignal({ userId, acqProspectId: acq.id, code: 'appointment_driven', value: true, basis: 'inferred', method: 'industry_config', confidence: 'medium', quote: `${industry.displayName} are appointment-driven (industry assumption, not an observation)` });

  if (d.email) await storeContact({ userId, acqProspectId: acq.id, kind: 'role_inbox', email: d.email, sourceId: source.id, sourceUrl: d.source_url, sourceNote: `${via}: ${d.source}`, confidence: 'medium' });
  if (d.phone) await storeContact({ userId, acqProspectId: acq.id, kind: 'business_phone', phone: d.phone, sourceId: source.id, sourceUrl: d.source_url, sourceNote: `${via}: ${d.source}`, confidence: 'medium' });
  if (d.contact_name) {
    await storeContact({
      userId, acqProspectId: acq.id, kind: 'manual_named', name: d.contact_name, role: d.contact_role,
      email: d.contact_email, phone: d.contact_phone, sourceId: source.id, sourceUrl: d.source_url,
      sourceNote: `${via}: ${d.source}`, confidence: 'medium', lawfulBasis: d.lawful_basis, retainDays: industry.retention.inactiveContactDays,
    });
  }

  await prisma.acquisitionPipelineEvent.create({
    data: {
      userId, acqProspectId: acq.id, fromState: 'none', toState: 'discovered', actor,
      reason: `Imported (${via}, row ${r.row}) from: ${d.source.slice(0, 200)}${r.crmConflict ? ` — CRM conflict: ${r.crmConflict}` : ''}${r.possibleDuplicate ? ' — possible duplicate (same name and area)' : ''}`,
    },
  });
  await enqueueAcqTask({ userId, type: 'acq.research_contacts', acqProspectId: acq.id, input: { industryKey: industry.id } });
  return acq.id;
}

/** Previews and immediately commits a single manually entered clinic. */
export async function addManualProspect(params: { userId: string; industryKey: string; row: Record<string, string>; attestedBy: string; attest: boolean }) {
  if (params.attest !== true) throw new ImportError('You must confirm the data was lawfully obtained and the source is accurate');
  const preview = await previewImport({ userId: params.userId, industryKey: params.industryKey, kind: 'manual', manualRow: params.row });
  if (preview.accepted !== 1) return { preview, committed: null };
  const committed = await commitImport({ userId: params.userId, batchId: preview.batchId, attestedBy: params.attestedBy, attest: true });
  return { preview, committed };
}

export async function purgeExpiredImports(now = new Date()): Promise<number> {
  const res = await prisma.acquisitionImportBatch.updateMany({
    where: { status: 'previewed', expiresAt: { lte: now } },
    data: { status: 'expired', rows: Prisma.DbNull },
  });
  return res.count;
}
