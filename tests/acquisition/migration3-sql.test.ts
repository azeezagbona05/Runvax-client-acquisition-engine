/**
 * Guards migration 3 (sales workflow): purely additive. Nullable columns on
 * two acquisition tables plus one new table; no existing RUNVAX table, no
 * data change, nothing dropped. down.sql reverses exactly what up adds.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(__dirname, '../../prisma/migrations/3_sales_workflow');
const statements = (file: string) =>
  fs.readFileSync(path.join(dir, file), 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
    .split(';').map((s) => s.trim()).filter(Boolean);
const target = (s: string) => s.match(/^(?:CREATE TABLE|ALTER TABLE|DROP TABLE) `(\w+)`/)?.[1];
const strip = (s: string) => s.replace(/\bON (DELETE|UPDATE) (CASCADE|RESTRICT|SET NULL|NO ACTION)\b/g, '');
const addedColumns = (stmts: string[]) => stmts.flatMap((s) => Array.from(s.matchAll(/ADD COLUMN `(\w+)` ([^,]+)/g), (m) => [target(s), m[1], m[2].trim()]));

describe('3_sales_workflow/migration.sql', () => {
  const up = statements('migration.sql');

  it('touches only AcquisitionDraft, AcquisitionApproval and the new AcquisitionOutcome', () => {
    expect(Array.from(new Set(up.map(target))).sort()).toEqual(['AcquisitionApproval', 'AcquisitionDraft', 'AcquisitionOutcome']);
    expect(up.filter((s) => /^CREATE TABLE/.test(s)).map(target)).toEqual(['AcquisitionOutcome']);
  });

  it('only adds: no DROP, MODIFY, RENAME or data change', () => {
    for (const s of up.map(strip)) expect(s).not.toMatch(/\bDROP\b|\bMODIFY\b|\bRENAME\b|\bTRUNCATE\b|\bDELETE\b|\bUPDATE\b|\bINSERT\b/i);
  });

  it('every added column on an existing table is nullable (no rewrite of existing rows, no default needed)', () => {
    const cols = addedColumns(up);
    expect(cols).toHaveLength(9);
    for (const [, , def] of cols) expect(def).toMatch(/\bNULL$/);
    for (const [, , def] of cols) expect(def).not.toMatch(/NOT NULL/);
  });

  it('the outcome table references only User and AcquisitionProspect', () => {
    const fks = up.filter((s) => /FOREIGN KEY/.test(s)).map((s) => s.match(/REFERENCES `(\w+)`/)?.[1]);
    expect(fks.sort()).toEqual(['AcquisitionProspect', 'User']);
  });
});

describe('3_sales_workflow/down.sql (manual rollback)', () => {
  const up = statements('migration.sql');
  const down = statements('down.sql');

  it('drops exactly the columns and table that up adds', () => {
    const dropped = down.flatMap((s) => Array.from(s.matchAll(/DROP COLUMN `(\w+)`/g), (m) => [target(s), m[1]]));
    expect(dropped.map((d) => d.join('.')).sort()).toEqual(addedColumns(up).map(([t, c]) => `${t}.${c}`).sort());
    expect(down.filter((s) => /^DROP TABLE/.test(s)).map(target)).toEqual(['AcquisitionOutcome']);
  });

  it('touches no other table and is documented as manual-only', () => {
    for (const s of down) expect(['AcquisitionApproval', 'AcquisitionDraft', 'AcquisitionOutcome']).toContain(target(s));
    expect(fs.readFileSync(path.join(dir, 'down.sql'), 'utf8')).toMatch(/MANUAL ROLLBACK[\s\S]*_prisma_migrations/);
  });
});
