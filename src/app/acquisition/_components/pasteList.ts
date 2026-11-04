/**
 * "Paste a list" for the import screen: one clinic per line, "name, website, phone, area"
 * (commas, tabs or semicolons; website, phone and area optional). Turned into the same CSV the
 * file upload uses, so the server's checks, duplicate detection and attestation are unchanged.
 * Names that themselves contain commas should be pasted from a spreadsheet (tab-separated).
 */
const HEADER = ['business_name', 'source', 'source_url', 'website', 'phone', 'area', 'city'];

const q = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function listToCsv(text: string, opts: { source: string; sourceUrl?: string; city?: string }): { csv: string; lines: number; skipped: string[] } {
  const skipped: string[] = [];
  const out: string[] = [HEADER.join(',')];
  let n = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = (line.includes('\t') ? line.split('\t') : line.includes(';') && !line.includes(',') ? line.split(';') : line.split(',')).map((p) => p.trim());
    const [name, website = '', phone = '', area = ''] = parts;
    if (!name || name.length < 2) { skipped.push(line.slice(0, 60)); continue; }
    if (name.length > 200 || /^[=+\-@]/.test(name)) { skipped.push(line.slice(0, 60)); continue; } // spreadsheet-formula guard, same spirit as the server's
    n++;
    out.push([name, opts.source, opts.sourceUrl ?? '', website, phone, area, opts.city ?? ''].map(q).join(','));
  }
  return { csv: out.join('\r\n'), lines: n, skipped };
}
