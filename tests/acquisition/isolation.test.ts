/**
 * Guards that keep Industry Acquisition clinics out of existing outreach
 * automation. The behavioural proof (Rex, Atlas, task handlers on real SQL) is
 * tests/integration/isolation.test.ts; these are the fast structural checks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { rows } from '../helpers/fakePrisma';
import { ACQUISITION_SOURCE, notAcquisition, isAcquisitionProspect } from '@/lib/acquisition/isolation';
import { previewImport, commitImport, addManualProspect } from '@/lib/acquisition/imports/service';

const ROOT = path.resolve(__dirname, '../..');
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}
const rel = (p: string) => path.relative(ROOT, p);

beforeEach(() => { process.env.INDUSTRY_ACQUISITION_ENABLED = 'true'; });
afterEach(() => { delete process.env.INDUSTRY_ACQUISITION_ENABLED; });

describe('the exclusion fragment', () => {
  it('keeps ordinary prospects: it has an explicit NULL branch, because a bare "not" drops NULL source in SQL', () => {
    expect(notAcquisition.OR).toEqual([{ source: null }, { source: { not: ACQUISITION_SOURCE } }]);
    expect(ACQUISITION_SOURCE).toBe('industry-acquisition');
  });

  it('classifies a prospect row by its source only', () => {
    expect(isAcquisitionProspect({ source: 'industry-acquisition' })).toBe(true);
    for (const source of [null, undefined, 'manual', 'campaign', 'auto-prospect', 'Industry-Acquisition ']) expect(isAcquisitionProspect({ source })).toBe(false);
  });

  it('imports nothing, so existing RUNVAX code can use it without pulling in the acquisition module', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/lib/acquisition/isolation.ts'), 'utf8');
    expect(src.match(/^import .*$/gm) ?? []).toEqual([]);
  });
});

describe('the engine marks every clinic it creates', () => {
  it('CSV import and manual add both create Prospect rows with source = ACQUISITION_SOURCE', async () => {
    const p = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: 'business_name,source,website\nCoral Clinic,Synthetic list,https://coral-iso.ng' });
    await commitImport({ userId: 'u1', batchId: p.batchId, attestedBy: 'a@h.test', attest: true });
    await addManualProspect({ userId: 'u1', industryKey: 'dental', attestedBy: 'a@h.test', attest: true, row: { business_name: 'Bluecrest Clinic', source: 'Synthetic list', website: 'https://bluecrest-iso.ng' } });
    const sources = rows('prospect').map((r) => r.source);
    expect(sources).toHaveLength(2);
    expect(sources.every((s) => s === ACQUISITION_SOURCE)).toBe(true);
  });
});

describe('tripwire for future automation', () => {
  const nonAcq = walk(path.join(ROOT, 'src')).filter((f) => !rel(f).startsWith('src/lib/acquisition/') && !rel(f).startsWith('src/app/api/acquisition/') && !rel(f).startsWith('src/app/acquisition/'));

  it('every existing file that creates outreach drafts also applies the isolation rule', () => {
    const creators = nonAcq.filter((f) => /outreachDraft\.create/.test(fs.readFileSync(f, 'utf8')));
    expect(creators.map(rel).sort()).toEqual(['src/lib/atlas.ts', 'src/lib/tasks/handlers.ts']); // a new creator must be reviewed and added here
    for (const f of creators) expect(fs.readFileSync(f, 'utf8'), rel(f)).toMatch(/acquisition\/isolation/);
  });

  it('Rex and Atlas select prospects through the exclusion', () => {
    const rex = fs.readFileSync(path.join(ROOT, 'src/app/api/cron/prepare-drafts/route.ts'), 'utf8');
    expect(rex).toMatch(/AND:\s*\[notAcquisition\]/);
    const atlas = fs.readFileSync(path.join(ROOT, 'src/lib/atlas.ts'), 'utf8');
    expect(atlas.match(/AND:\s*\[notAcquisition\]/g)).toHaveLength(2); // cold leads and stale interested
  });

  it('the existing task handlers skip engine clinics before doing any work', () => {
    const h = fs.readFileSync(path.join(ROOT, 'src/lib/tasks/handlers.ts'), 'utf8');
    expect(h.match(/isAcquisitionProspect\(prospect\)\) return \{ status: 'skipped', output: \{ reason: 'acquisition_prospect' \} \}/g)).toHaveLength(2);
  });
});
