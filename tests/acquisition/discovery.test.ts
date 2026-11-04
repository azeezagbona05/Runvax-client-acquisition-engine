import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rows, seed } from '../helpers/fakePrisma';
import { parseCsv, looksLikeFormula, CsvError } from '@/lib/acquisition/imports/csv';
import { previewImport, commitImport, addManualProspect, purgeExpiredImports, ImportError } from '@/lib/acquisition/imports/service';
import { addSuppression } from '@/lib/acquisition/suppression';
import { eraseContacts } from '@/lib/acquisition/contacts';
import { identityKeys } from '@/lib/acquisition/identity';
import { searchPlaces, ingestPlacesResults, placesActivation, PLACES_FIELD_MASK, buildTextSearchRequest } from '@/lib/acquisition/places/adapter';
import { acqHandlers } from '@/lib/acquisition/tasks/handlers';
import { drainAcqTasks, enqueueAcqTask } from '@/lib/acquisition/tasks/queue';
import { ActivationError } from '@/lib/acquisition/activation';
import { dental } from '@/lib/acquisition/config/industries/dental';

const HEADER = 'business_name,source,source_url,website,phone,email,address,area,city,place_id,contact_name,contact_role,contact_email,contact_phone,lawful_basis';
const row = (o: Partial<Record<string, string>>) =>
  HEADER.split(',').map((h) => {
    const v = o[h] ?? '';
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(',');
const csv = (...r: string[]) => [HEADER, ...r].join('\r\n');
const SRC = 'Lagos Dental Expo 2026 exhibitor list';

describe('CSV parser', () => {
  it('handles BOM, CRLF, quotes, escaped quotes and embedded newlines', () => {
    const p = parseCsv('﻿Name,Note\r\n"Smile, Ltd","He said ""hi""\nthere"\r\nPlain,x\r\n', { maxBytes: 10_000, maxRows: 10 });
    expect(p.header).toEqual(['name', 'note']);
    expect(p.rows).toEqual([{ name: 'Smile, Ltd', note: 'He said "hi"\nthere' }, { name: 'Plain', note: 'x' }]);
  });
  it.each([
    ['too big', 'a\n' + 'x'.repeat(200), { maxBytes: 100, maxRows: 10 }, /bytes/],
    ['too many rows', 'a\n1\n2\n3', { maxBytes: 1000, maxRows: 2 }, /rows/],
    ['ragged row', 'a,b\n1', { maxBytes: 1000, maxRows: 10 }, /fields/],
    ['unterminated quote', 'a\n"x', { maxBytes: 1000, maxRows: 10 }, /Unterminated/],
    ['duplicate columns', 'a,A\n1,2', { maxBytes: 1000, maxRows: 10 }, /Duplicate/],
    ['binary', 'a\n\u0000', { maxBytes: 1000, maxRows: 10 }, /NUL/],
  ])('rejects %s', (_n, text, limits, re) => {
    expect(() => parseCsv(text, limits)).toThrow(CsvError);
    expect(() => parseCsv(text, limits)).toThrow(re);
  });
  it('flags spreadsheet formulas but not phone numbers', () => {
    for (const v of ['=HYPERLINK("x")', '@SUM(A1)', '+cmd|calc', '-2+3']) expect(looksLikeFormula(v)).toBe(true);
    for (const v of ['+234 803 123 4567', '-', '0803-123-4567', 'Smile Dental']) expect(looksLikeFormula(v)).toBe(false);
  });
});

describe('identity keys', () => {
  it('uses the registrable domain, the normalised phone and a weak name+area key', () => {
    expect(identityKeys({ website: 'https://www.smile.com.ng/contact', phone: '0803 123 4567', name: 'Smile Dental Clinic', area: 'Lekki' })).toEqual([
      { kind: 'domain', value: 'smile.com.ng' },
      { kind: 'phone', value: '2348031234567' },
      { kind: 'name_area', value: 'smiledentalc|lekki' },
    ]);
    expect(identityKeys({ website: 'https://instagram.com/smile' }).find((k) => k.kind === 'domain')).toBeUndefined();
  });
});

describe('CSV import: preview then commit', () => {
  it('previews without creating prospects, then commits with attestation', async () => {
    const p = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: csv(row({ business_name: 'Smile Dental', source: SRC, website: 'smiledental.ng', phone: '08031234567', email: 'info@smiledental.ng', area: 'Lekki', city: 'Lagos' })) });
    expect(p).toMatchObject({ rowCount: 1, accepted: 1, rejected: 0 });
    expect(rows('prospect')).toHaveLength(0);
    expect(rows('acquisitionProspect')).toHaveLength(0);

    await expect(commitImport({ userId: 'u1', batchId: p.batchId, attestedBy: 'admin@h.test', attest: false })).rejects.toThrow(ImportError);
    const c = await commitImport({ userId: 'u1', batchId: p.batchId, attestedBy: 'admin@h.test', attest: true });
    expect(c.created).toBe(1);

    expect(rows('prospect')[0]).toMatchObject({ businessName: 'Smile Dental', source: 'industry-acquisition', stage: 'found' });
    expect(rows('acquisitionProspect')[0]).toMatchObject({ industryKey: 'dental', state: 'discovered', area: 'Lekki', orgDomain: 'smiledental.ng', crmConflict: null });
    expect(rows('acquisitionSource')[0]).toMatchObject({ kind: 'csv', method: 'csv_import' });
    expect(rows('acquisitionIdentity').map((i) => i.kind).sort()).toEqual(['domain', 'name_area', 'phone']);
    expect(rows('acquisitionDecisionMaker').map((d) => d.kind).sort()).toEqual(['business_phone', 'role_inbox']);
    expect(rows('acquisitionDecisionMaker').every((d) => d.name === null)).toBe(true);
    expect(rows('acquisitionSignal').map((s) => `${s.code}:${s.basis}`).sort()).toEqual(['appointment_driven:inferred', 'website_present:inferred']);
    expect(rows('acquisitionTask')[0]).toMatchObject({ type: 'acq.research_contacts', status: 'pending' });
    // Parsed rows are cleared once committed (data minimisation).
    expect(rows('acquisitionImportBatch')[0]).toMatchObject({ status: 'committed', rows: null, attestedBy: 'admin@h.test' });
  });

  it('S17: re-uploading the same file, or committing twice, creates nothing new', async () => {
    const text = csv(row({ business_name: 'Smile Dental', source: SRC, website: 'smiledental.ng' }));
    const p1 = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: text });
    await commitImport({ userId: 'u1', batchId: p1.batchId, attestedBy: 'a', attest: true });
    const before = JSON.stringify([rows('prospect').length, rows('acquisitionProspect').length, rows('acquisitionTask').length, rows('acquisitionSignal').length]);
    const p2 = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: text });
    expect(p2.batchId).toBe(p1.batchId);
    expect((await commitImport({ userId: 'u1', batchId: p1.batchId, attestedBy: 'a', attest: true })).created).toBe(0);
    expect(JSON.stringify([rows('prospect').length, rows('acquisitionProspect').length, rows('acquisitionTask').length, rows('acquisitionSignal').length])).toBe(before);
  });

  it('S7: the same clinic arriving twice (CSV, then manual entry with the same domain) stays one prospect', async () => {
    const p = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: csv(row({ business_name: 'Smile Dental', source: SRC, website: 'https://smiledental.ng' })) });
    await commitImport({ userId: 'u1', batchId: p.batchId, attestedBy: 'a', attest: true });
    const m = await addManualProspect({ userId: 'u1', industryKey: 'dental', attestedBy: 'a', attest: true, row: { business_name: 'Smile Dental Clinic Ltd', source: 'Business card from clinic visit', website: 'www.smiledental.ng/about' } });
    expect(m.preview.results[0]).toMatchObject({ outcome: 'duplicate' });
    expect(m.committed).toBeNull();
    expect(rows('acquisitionProspect')).toHaveLength(1);
  });

  it('S7/S8: within one file, a repeated clinic is a duplicate but a second branch (different place ID) is kept and linked', async () => {
    const p = await previewImport({
      userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: csv(
        row({ business_name: 'Smile Dental Lekki', source: SRC, website: 'smiledental.ng', place_id: 'ChIJAAAAAAAAAAAAAAAAAAA1', email: 'info@smiledental.ng' }),
        row({ business_name: 'Smile Dental Ikeja', source: SRC, website: 'smiledental.ng', place_id: 'ChIJAAAAAAAAAAAAAAAAAAA2', email: 'info@smiledental.ng' }),
        row({ business_name: 'Smile Dental', source: SRC, website: 'smiledental.ng' }),
      ),
    });
    expect(p.results.map((r) => r.outcome)).toEqual(['accepted', 'accepted', 'duplicate']);
    expect(p.results[1].flags).toContain('branch_of:row 2');
    await commitImport({ userId: 'u1', batchId: p.batchId, attestedBy: 'a', attest: true });
    const acq = rows('acquisitionProspect');
    expect(acq).toHaveLength(2);
    expect(acq.every((a) => a.orgDomain === 'smiledental.ng')).toBe(true);
    // The shared role inbox: stored on both, but the second is flagged as a duplicate holder.
    const inboxes = rows('acquisitionDecisionMaker').filter((d) => d.email === 'info@smiledental.ng');
    expect(inboxes).toHaveLength(2);
    expect(inboxes[1].flags).toEqual({ duplicateOf: acq[0].id });
    // The domain identity has one holder; both place IDs are recorded.
    expect(rows('acquisitionIdentity').filter((i) => i.kind === 'domain')).toHaveLength(1);
    expect(rows('acquisitionIdentity').filter((i) => i.kind === 'place_id')).toHaveLength(2);
  });

  it('S9: a suppressed domain is never imported', async () => {
    await addSuppression({ userId: 'u1', kind: 'domain', value: 'smiledental.ng', reason: 'objection', source: 'email' });
    const p = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: csv(row({ business_name: 'Smile Dental', source: SRC, website: 'smiledental.ng', email: 'info@smiledental.ng' })) });
    expect(p.results[0]).toMatchObject({ outcome: 'rejected' });
    expect(p.results[0].reasons.join()).toMatch(/suppressed or erased/);
    expect(rows('acquisitionDecisionMaker')).toHaveLength(0);
  });

  it('S10: an erased contact re-imported later is rejected and not stored again', async () => {
    const first = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: csv(row({ business_name: 'Bright Smiles', source: SRC, website: 'brightsmiles.ng', contact_name: 'Dr Ada Obi', contact_role: 'Principal Dentist', contact_email: 'ada@brightsmiles.ng', lawful_basis: 'legitimate_interest_b2b' })) });
    await commitImport({ userId: 'u1', batchId: first.batchId, attestedBy: 'a', attest: true });
    const acqId = rows('acquisitionProspect')[0].id as string;
    expect(rows('acquisitionDecisionMaker')).toHaveLength(1);

    await eraseContacts({ userId: 'u1', acqProspectId: acqId, reason: 'erasure', actor: 'admin@h.test', domain: 'brightsmiles.ng' });
    expect(rows('acquisitionDecisionMaker')).toHaveLength(0);
    expect(JSON.stringify(rows('acquisitionSuppression'))).not.toContain('ada@');
    expect(rows('acquisitionPipelineEvent').at(-1)?.reason).not.toMatch(/ada|Obi/i);

    const again = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: csv(row({ business_name: 'Bright Smiles Dental', source: 'another list', website: 'brightsmiles2.ng', contact_name: 'Ada Obi', contact_email: 'ADA@brightsmiles.ng', lawful_basis: 'legitimate_interest_b2b' })) });
    expect(again.results[0]).toMatchObject({ outcome: 'rejected' });
    expect(again.results[0].reasons.join()).toMatch(/suppressed or erased/);
    expect(JSON.stringify(rows('acquisitionImportBatch'))).not.toContain('ADA@brightsmiles.ng');
  });

  it('S11: Google-sourced rows are rejected, formula cells flagged, and contact rules enforced', async () => {
    const p = await previewImport({
      userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: csv(
        row({ business_name: 'Copied Clinic', source: 'Google Maps listing', website: 'copied.ng' }),
        row({ business_name: 'Linked Clinic', source: 'research', source_url: 'https://maps.google.com/?cid=1', website: 'linked.ng' }),
        row({ business_name: '=HYPERLINK("http://evil")', source: SRC, website: 'formula.ng' }),
        row({ business_name: 'No Basis Clinic', source: SRC, website: 'nobasis.ng', contact_name: 'Dr X', contact_email: 'x@nobasis.ng' }),
        row({ business_name: 'Named Inbox Clinic', source: SRC, website: 'named.ng', email: 'dr.ade@named.ng' }),
        row({ business_name: 'X', source: SRC }),
      ),
    });
    expect(p.results.map((r) => r.outcome)).toEqual(['rejected', 'rejected', 'accepted', 'rejected', 'rejected', 'rejected']);
    expect(p.results[0].reasons.join()).toMatch(/Google Maps/);
    expect(p.results[1].reasons.join()).toMatch(/Google Maps/);
    expect(p.results[2].flags.join()).toMatch(/formula_like_cells:business_name/);
    expect(p.results[3].reasons.join()).toMatch(/lawful_basis/);
    expect(p.results[4].reasons.join()).toMatch(/role inboxes/);
    expect(p.results[5].reasons.join()).toMatch(/business_name/);
  });

  it('S11: file and row limits', async () => {
    const big = csv(row({ business_name: 'Big', source: SRC, address: 'x'.repeat(300) })) + '\r\n' + 'x'.repeat(2 * 1024 * 1024);
    await expect(previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: big })).rejects.toThrow(/bytes/);
    const many = csv(...Array.from({ length: 1001 }, (_, i) => row({ business_name: `Clinic ${i}`, source: SRC })));
    await expect(previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: many })).rejects.toThrow(/1000/);
  });

  it('S12: a clinic already contacted in the existing CRM is flagged', async () => {
    seed('prospect', { id: 'crm1', userId: 'u1', businessId: 'ChIJxyzxyzxyzxyzxyz12', businessName: 'Pearl Dental', businessData: { website: 'https://pearldental.ng', phone: '0802 000 0000' }, outreachSentAt: new Date(), source: 'campaign' });
    const p = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: csv(row({ business_name: 'Pearl Dental Clinic', source: SRC, website: 'pearldental.ng' })) });
    expect(p.results[0].flags).toContain('crm_conflict:already_contacted_in_crm');
    await commitImport({ userId: 'u1', batchId: p.batchId, attestedBy: 'a', attest: true });
    expect(rows('acquisitionProspect')[0].crmConflict).toBe('already_contacted_in_crm');
    // The existing CRM record is untouched.
    expect(rows('prospect').find((x) => x.id === 'crm1')).toMatchObject({ businessName: 'Pearl Dental', source: 'campaign' });
  });

  it('reuses (never modifies) an existing CRM prospect with the same place ID', async () => {
    seed('prospect', { id: 'crm2', userId: 'u1', businessId: 'ChIJsamesamesamesame12', businessName: 'Existing Name', businessData: {}, source: 'manual' });
    const p = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: csv(row({ business_name: 'Other Name', source: SRC, place_id: 'ChIJsamesamesamesame12' })) });
    await commitImport({ userId: 'u1', batchId: p.batchId, attestedBy: 'a', attest: true });
    expect(rows('prospect')).toHaveLength(1);
    expect(rows('prospect')[0]).toMatchObject({ businessName: 'Existing Name', source: 'manual' });
    expect(rows('acquisitionProspect')[0]).toMatchObject({ prospectId: 'crm2', crmConflict: 'already_in_crm' });
  });

  it('named contacts need a lawful basis and get a provisional retention date', async () => {
    const m = await addManualProspect({ userId: 'u1', industryKey: 'dental', attestedBy: 'a', attest: true, row: { business_name: 'Coral Dental', source: 'Met at LASUTH CPD event', contact_name: 'Dr Tunde Bello', contact_role: 'Practice Manager', contact_email: 'tunde@coraldental.ng', lawful_basis: 'legitimate_interest_b2b' } });
    expect(m.committed?.created).toBe(1);
    const dm = rows('acquisitionDecisionMaker')[0];
    expect(dm).toMatchObject({ kind: 'manual_named', name: 'Dr Tunde Bello', role: 'Practice Manager', lawfulBasis: 'legitimate_interest_b2b' });
    const days = ((dm.retainUntil as Date).getTime() - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(180);
  });

  it('expired previews are cleared', async () => {
    const p = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: csv(row({ business_name: 'Smile Dental', source: SRC })) });
    expect(await purgeExpiredImports(new Date(Date.now() + 25 * 3_600_000))).toBe(1);
    expect(rows('acquisitionImportBatch')[0]).toMatchObject({ id: p.batchId, status: 'expired', rows: null });
    await expect(commitImport({ userId: 'u1', batchId: p.batchId, attestedBy: 'a', attest: true })).rejects.toThrow(/expired/);
  });
});

const SEARCH = { userId: 'u1', industry: dental, area: 'Lekki', queryIndex: 0 };

describe('Google Places stays disabled', () => {
  it('searchPlaces throws before any budget reservation or request', async () => {
    await expect(searchPlaces(SEARCH)).rejects.toBeInstanceOf(ActivationError);
    expect(rows('acquisitionProviderUsage')).toHaveLength(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('even with IA_PLACES_ENABLED=true it is still disabled', async () => {
    process.env.IA_PLACES_ENABLED = 'true';
    expect(placesActivation().allowed).toBe(false);
    await expect(searchPlaces(SEARCH)).rejects.toThrow(/googlePlaces is not activated/);
    delete process.env.IA_PLACES_ENABLED;
  });

  it('the acq.discover task is skipped (not failed, so never retried) and reserves nothing', async () => {
    process.env.INDUSTRY_ACQUISITION_ENABLED = 'true';
    await enqueueAcqTask({ userId: 'u1', type: 'acq.discover', input: { industryKey: 'dental', area: 'Lekki', queryIndex: 0 } });
    const r = await drainAcqTasks();
    expect(r).toMatchObject({ claimed: 1, skipped: 1, retried: 0, dead: 0 });
    expect(rows('acquisitionTask')[0]).toMatchObject({ status: 'skipped', attempts: 1 });
    expect((rows('acquisitionTask')[0].output as { reason: string }).reason).toBe('places_disabled');
    expect(rows('acquisitionProviderUsage').filter((u) => u.provider === 'google_places')).toHaveLength(0);
    delete process.env.INDUSTRY_ACQUISITION_ENABLED;
    void acqHandlers;
  });

  it('the future request asks for no coordinates, contact, rating or review fields', () => {
    expect(PLACES_FIELD_MASK).not.toMatch(/location|phone|website|rating|review|photo|address|hours/i);
    expect(buildTextSearchRequest(dental, 'Lekki', 0).textQuery).toBe('dental clinic in Lekki, Lagos');
  });

  it('S6: ingestion stores only place_id plus our own metadata — no other Places value anywhere', async () => {
    const fixture = [
      { id: 'ChIJplacesfixture000001', displayName: { text: 'Fixture Smile Dental Lekki' }, types: ['dentist'], businessStatus: 'OPERATIONAL' },
      { id: 'ChIJplacesfixture000002', displayName: { text: 'Fixture Dental Supplies Depot' }, types: ['dentist'], businessStatus: 'OPERATIONAL' },
      { id: 'ChIJplacesfixture000003', displayName: { text: 'Fixture Closed Clinic' }, types: ['dentist'], businessStatus: 'CLOSED_PERMANENTLY' },
    ];
    const r = await ingestPlacesResults({ userId: 'u1', industry: dental, area: 'Lekki', queryIndex: 0, results: fixture });
    expect(r).toEqual({ kept: 1, excluded: 2 });
    expect(rows('acquisitionCandidate').map((c) => c.status)).toEqual(['no_independent_source', 'excluded', 'excluded']);
    expect(rows('prospect')).toHaveLength(0);
    // Scan every stored value in every table for any fixture Places string other than the IDs.
    const everything = JSON.stringify(Object.fromEntries(['acquisitionCandidate', 'prospect', 'acquisitionProspect', 'acquisitionSignal', 'acquisitionSource', 'acquisitionIdentity', 'acquisitionDecisionMaker'].map((t) => [t, rows(t)])));
    for (const leaked of ['Fixture', 'Smile Dental Lekki', 'Supplies', 'OPERATIONAL', 'CLOSED_PERMANENTLY', 'dentist']) {
      expect(everything).not.toContain(leaked);
    }
    expect(everything).toContain('ChIJplacesfixture000001');
    void vi;
  });
});
