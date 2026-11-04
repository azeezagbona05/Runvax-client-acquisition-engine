/**
 * A small RFC 4180 CSV parser for prospect imports. Deliberately not `xlsx`
 * (high-severity parsing advisories, no fix on npm) and no new dependency.
 * Handles quoted fields, escaped quotes, CRLF/LF, a UTF-8 BOM and embedded
 * newlines in quoted fields. Enforces byte and row limits before parsing.
 */

export class CsvError extends Error {}

export interface ParsedCsv {
  header: string[];
  rows: Array<Record<string, string>>;
}

export function parseCsv(text: string, limits: { maxBytes: number; maxRows: number }): ParsedCsv {
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > limits.maxBytes) throw new CsvError(`File is ${bytes} bytes; the limit is ${limits.maxBytes}`);
  if (text.includes('\u0000')) throw new CsvError('File contains NUL bytes — not a text CSV');
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  const pushField = () => { record.push(field); field = ''; };
  const pushRecord = () => {
    pushField();
    if (!(record.length === 1 && record[0] === '')) records.push(record);
    record = [];
    if (records.length > limits.maxRows + 1) throw new CsvError(`More than ${limits.maxRows} data rows`);
  };

  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') {
      if (field !== '') throw new CsvError(`Unexpected quote in an unquoted field (record ${records.length + 1})`);
      inQuotes = true; i++; continue;
    }
    if (c === ',') { pushField(); i++; continue; }
    if (c === '\r') { if (src[i + 1] === '\n') i++; pushRecord(); i++; continue; }
    if (c === '\n') { pushRecord(); i++; continue; }
    field += c; i++;
  }
  if (inQuotes) throw new CsvError('Unterminated quoted field');
  if (field !== '' || record.length > 0) pushRecord();

  if (records.length === 0) throw new CsvError('Empty file');
  const header = records[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  if (new Set(header).size !== header.length) throw new CsvError('Duplicate column names');
  const rows = records.slice(1).map((r, idx) => {
    if (r.length !== header.length) throw new CsvError(`Row ${idx + 2} has ${r.length} fields; the header has ${header.length}`);
    return Object.fromEntries(header.map((h, j) => [h, r[j].trim()]));
  });
  if (rows.length > limits.maxRows) throw new CsvError(`More than ${limits.maxRows} data rows`);
  return { header, rows };
}

/** Spreadsheet formula injection: cells a spreadsheet would execute if exported. */
export function looksLikeFormula(value: string): boolean {
  if (!value) return false;
  if (/^[=@\t\r]/.test(value)) return true;
  // "+234 803…" / "-5" are ordinary values; "+cmd|…" / "-2+3" are not.
  return /^[+-]/.test(value) && !/^[+-]?[\d\s().-]+$/.test(value);
}
