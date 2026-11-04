import { describe, it, expect, beforeEach } from 'vitest';
import { rows, seed } from '../helpers/fakePrisma';
import { listToCsv } from '@/app/acquisition/_components/pasteList';
import { previewImport } from '@/lib/acquisition/imports/service';

beforeEach(() => { seed('user', { id: 'u1', isSuspended: false }); });

describe('a pasted list goes through the normal importer rules', () => {
  const list = 'Coral Smile Dental, coral-paste.ng, 0803 111 2222, Lekki\nBluecrest Dental, bluecrest-paste.ng\nCoral Smile Dental, coral-paste.ng';
  it('accepts clean lines, flags the in-list duplicate, and creates nothing at preview', async () => {
    const { csv } = listToCsv(list, { source: 'Association members list 2026' });
    const p = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: csv });
    expect(p).toMatchObject({ accepted: 2, duplicates: 1, rejected: 0 });
    expect(rows('acquisitionProspect')).toHaveLength(0);
  });
  it('a Google Maps source is still refused, however the list was entered', async () => {
    const { csv } = listToCsv('Coral Smile Dental, coral-paste.ng', { source: 'Google Maps' });
    const p = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: csv });
    expect(p).toMatchObject({ accepted: 0, rejected: 1 });
  });
  it('no source, no import', async () => {
    const { csv } = listToCsv('Coral Smile Dental, coral-paste.ng', { source: '' });
    expect((await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: csv })).accepted).toBe(0);
  });
});
