/**
 * Guards the acquisition migration: it may only create the new Acquisition*
 * tables, their indexes, and foreign keys declared on them. Any statement that
 * alters, drops or rewrites an existing table fails this test.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(__dirname, '../../prisma/migrations/1_industry_acquisition');
const statements = (file: string) =>
  fs.readFileSync(path.join(dir, file), 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
    .split(';').map((s) => s.trim()).filter(Boolean);

const NEW_TABLES = [
  'AcquisitionProspect', 'AcquisitionSource', 'AcquisitionDecisionMaker', 'AcquisitionFinding',
  'AcquisitionRecommendation', 'AcquisitionDraft', 'AcquisitionApproval', 'AcquisitionSuppression',
  'AcquisitionTask', 'AcquisitionAgentRun', 'AcquisitionPipelineEvent',
];

describe('1_industry_acquisition/migration.sql', () => {
  const stmts = statements('migration.sql');

  it('creates exactly the 11 new tables', () => {
    const created = stmts.map((s) => s.match(/^CREATE TABLE `(\w+)`/)?.[1]).filter(Boolean);
    expect([...created].sort()).toEqual([...NEW_TABLES].sort());
  });

  it('only ever alters a new Acquisition* table', () => {
    for (const s of stmts.filter((x) => /^ALTER TABLE/i.test(x))) {
      const target = s.match(/^ALTER TABLE `(\w+)`/i)?.[1];
      expect(NEW_TABLES, s).toContain(target);
      expect(s, s).toMatch(/^ALTER TABLE `\w+` ADD CONSTRAINT `\w+` FOREIGN KEY/);
    }
  });

  it('contains no destructive or data-changing statements', () => {
    for (const s of stmts) {
      // Referential actions on the new foreign keys are not data changes.
      const body = s.replace(/\bON (DELETE|UPDATE) (CASCADE|RESTRICT|SET NULL|NO ACTION)\b/g, '');
      expect(body).not.toMatch(/\b(DROP|TRUNCATE|DELETE|UPDATE|RENAME|MODIFY|CHANGE)\b/i);
      expect(s).toMatch(/^(CREATE TABLE|ALTER TABLE)/);
    }
  });

  it('only references existing tables as foreign-key parents (User, Prospect)', () => {
    const parents = stmts.flatMap((s) => Array.from(s.matchAll(/REFERENCES `(\w+)`/g), (m) => m[1]));
    const existing = parents.filter((p) => !NEW_TABLES.includes(p));
    expect(Array.from(new Set(existing)).sort()).toEqual(['Prospect', 'User']);
  });
});

describe('1_industry_acquisition/down.sql', () => {
  it('drops only the new tables', () => {
    for (const s of statements('down.sql')) {
      const t = s.match(/^DROP TABLE IF EXISTS `(\w+)`$/)?.[1];
      expect(NEW_TABLES, s).toContain(t);
    }
    expect(statements('down.sql')).toHaveLength(NEW_TABLES.length);
  });
});
