/**
 * Guards migration 2: every statement must target an Acquisition* table. Only
 * Phase 1 acquisition tables (not yet deployed anywhere) may be altered, and
 * only additively plus one index swap on AcquisitionSuppression. No existing
 * RUNVAX table is touched and no data is changed.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(__dirname, '../../prisma/migrations/2_acquisition_intelligence');
const statements = (file: string) =>
  fs.readFileSync(path.join(dir, file), 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
    .split(';').map((s) => s.trim()).filter(Boolean);

const PHASE1 = [
  'AcquisitionProspect', 'AcquisitionSource', 'AcquisitionDecisionMaker', 'AcquisitionFinding',
  'AcquisitionRecommendation', 'AcquisitionDraft', 'AcquisitionApproval', 'AcquisitionSuppression',
  'AcquisitionTask', 'AcquisitionAgentRun', 'AcquisitionPipelineEvent',
];
const PHASE2 = [
  'AcquisitionCandidate', 'AcquisitionImportBatch', 'AcquisitionIdentity', 'AcquisitionSignal',
  'AcquisitionScore', 'AcquisitionPageCache', 'AcquisitionProviderUsage',
];
const target = (s: string) => s.match(/^(?:CREATE TABLE|ALTER TABLE|DROP TABLE|DROP INDEX `\w+` ON|CREATE (?:UNIQUE )?INDEX `\w+` ON) `(\w+)`/)?.[1];
const strip = (s: string) => s.replace(/\bON (DELETE|UPDATE) (CASCADE|RESTRICT|SET NULL|NO ACTION)\b/g, '');

describe('2_acquisition_intelligence/migration.sql', () => {
  const stmts = statements('migration.sql');

  it('creates exactly the 7 new Phase 2 tables', () => {
    const created = stmts.map((s) => s.match(/^CREATE TABLE `(\w+)`/)?.[1]).filter(Boolean);
    expect([...created].sort()).toEqual([...PHASE2].sort());
  });

  it('targets only Acquisition* tables', () => {
    for (const s of stmts) {
      const t = target(s);
      expect(t, s).toBeDefined();
      expect([...PHASE1, ...PHASE2], s).toContain(t);
    }
  });

  it('never drops a table and never changes data', () => {
    for (const s of stmts.map(strip)) {
      expect(s).not.toMatch(/\bDROP TABLE\b|\bTRUNCATE\b|\bDELETE\b|\bUPDATE\b|\bINSERT\b|\bRENAME\b/i);
    }
  });

  it('alters Phase 1 tables only additively (plus the AcquisitionSuppression index swap)', () => {
    for (const s of stmts.filter((x) => /^ALTER TABLE/.test(x))) {
      const t = target(s)!;
      if (PHASE2.includes(t)) {
        expect(s).toMatch(/ADD CONSTRAINT `\w+` FOREIGN KEY/);
        continue;
      }
      expect(PHASE1).toContain(t);
      expect(strip(s)).not.toMatch(/\bDROP\b/i);
      if (/\bMODIFY\b/.test(s)) {
        // The only allowed MODIFY: AcquisitionSuppression.value becomes nullable.
        expect(t).toBe('AcquisitionSuppression');
        expect(s).toMatch(/MODIFY `value` VARCHAR\(191\) NULL/);
      }
    }
    const dropped = stmts.filter((x) => /^DROP INDEX/.test(x));
    expect(dropped).toEqual(['DROP INDEX `AcquisitionSuppression_userId_kind_value_key` ON `AcquisitionSuppression`']);
  });

  it('only references User and Prospect among existing tables', () => {
    const parents = stmts.flatMap((s) => Array.from(s.matchAll(/REFERENCES `(\w+)`/g), (m) => m[1]));
    const existing = Array.from(new Set(parents.filter((p) => ![...PHASE1, ...PHASE2].includes(p)))).sort();
    expect(existing).toEqual(['User']);
  });
});

describe('2_acquisition_intelligence/down.sql', () => {
  it('touches only Acquisition* tables and drops only Phase 2 tables', () => {
    const stmts = statements('down.sql');
    for (const s of stmts) {
      const t = target(s);
      expect([...PHASE1, ...PHASE2], s).toContain(t);
      if (/^DROP TABLE/.test(s)) expect(PHASE2).toContain(t);
    }
    expect(stmts.filter((s) => /^DROP TABLE/.test(s)).length).toBe(PHASE2.length);
  });
});
