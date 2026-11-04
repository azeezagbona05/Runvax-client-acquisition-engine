'use client';

import { useState } from 'react';
import { Loader2, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from './format';
import { listToCsv } from './pasteList';

interface RowResult { row: number; outcome: 'accepted' | 'duplicate' | 'rejected'; businessName?: string; reasons: string[]; flags: string[] }
interface Preview { batchId: string; status: string; rowCount: number; accepted: number; duplicates: number; rejected: number; results: RowResult[] }

const TEMPLATE = 'business_name,source,source_url,website,phone,email,address,area,city,place_id,contact_name,contact_role,contact_email,contact_phone,lawful_basis';

const OUTCOME_CLS: Record<string, string> = {
  accepted: 'text-emerald-300',
  duplicate: 'text-amber-300',
  rejected: 'text-red-300',
};

/**
 * CSV import: upload → preview (nothing created) → attest → commit.
 * Rows sourced from Google Maps / Places are rejected server-side.
 */
export default function ImportPanel({ industryKey, onCommitted }: { industryKey: string; onCommitted?: () => void }) {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [attest, setAttest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [pasted, setPasted] = useState('');
  const [pasteSource, setPasteSource] = useState('');
  const [pasteSourceUrl, setPasteSourceUrl] = useState('');
  const [pasteNote, setPasteNote] = useState('');

  const onFile = async (f: File | undefined) => {
    setError(''); setPreview(null); setDone(''); setAttest(false);
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { setError('File is larger than 2 MB'); return; }
    setFileName(f.name);
    setCsvText(await f.text());
  };

  const usePasted = () => {
    setError(''); setPreview(null); setDone(''); setAttest(false);
    const r = listToCsv(pasted, { source: pasteSource.trim(), sourceUrl: pasteSourceUrl.trim() || undefined });
    if (r.lines === 0) { setError('No usable lines found. Use one clinic per line: name, website, phone, area.'); return; }
    setCsvText(r.csv); setFileName('pasted list');
    setPasteNote(`${r.lines} line(s) ready${r.skipped.length ? `; ${r.skipped.length} skipped (no usable name)` : ''}. Press Preview to check them.`);
  };

  const runPreview = async () => {
    setBusy(true); setError(''); setDone('');
    try {
      setPreview(await api<Preview>('/api/acquisition/imports', { method: 'POST', body: JSON.stringify({ industryKey, label: fileName || undefined, csvText }) }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Preview failed'); } finally { setBusy(false); }
  };

  const commit = async () => {
    if (!preview || !attest) return;
    setBusy(true); setError('');
    try {
      const r = await api<{ created: number; skipped: number }>(`/api/acquisition/imports/${preview.batchId}/commit`, { method: 'POST', body: JSON.stringify({ attest: true }) });
      setDone(`Created ${r.created} prospect(s)${r.skipped ? `, skipped ${r.skipped}` : ''}. Research tasks are queued — run the queue from the Overview tab.`);
      setPreview({ ...preview, status: 'committed' });
      onCommitted?.();
    } catch (e) { setError(e instanceof Error ? e.message : 'Commit failed'); } finally { setBusy(false); }
  };

  return (
    <section className="border border-white/8 bg-white/[0.02] rounded-2xl p-5 space-y-4" aria-label="CSV import">
      <div>
        <h2 className="text-sm font-bold text-white">Import clinics (CSV)</h2>
        <p className="text-xs text-gray-400 mt-1">
          Columns: <code className="text-gray-300 break-all">{TEMPLATE}</code>. <b>business_name</b> and <b>source</b> are required.
          Do not import anything copied from Google Maps — those rows are rejected. Named contacts need a <b>lawful_basis</b>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 cursor-pointer">
          <Upload className="w-3.5 h-3.5" /> Choose CSV
          <input type="file" accept=".csv,text/csv" className="sr-only" aria-label="CSV file" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {fileName && <span className="text-xs text-gray-400">{fileName}</span>}
        <button onClick={runPreview} disabled={!csvText || busy} className="text-xs font-bold px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40">
          {busy && !preview ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : null} Preview
        </button>
      </div>

      <details className="text-xs text-gray-300">
        <summary className="cursor-pointer font-bold text-gray-200">Or paste a list</summary>
        <div className="mt-2 space-y-2">
          <p className="text-gray-400">One clinic per line: <code className="text-gray-300">name, website, phone, area</code> (website, phone and area are optional; tabs from a spreadsheet work too). Every line gets the source you name below. It must be a source other than Google Maps.</p>
          <textarea aria-label="Pasted list" rows={5} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={'Coral Smile Dental, coral-smile.ng, 0803 000 0000, Lekki\nBluecrest Dental, bluecrest.ng'} className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white placeholder-gray-600" />
          <div className="grid sm:grid-cols-2 gap-2">
            <input aria-label="List source" value={pasteSource} onChange={(e) => setPasteSource(e.target.value)} placeholder="Source of this list, e.g. Lagos Dental Association members 2026" className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600" />
            <input aria-label="List source URL" value={pasteSourceUrl} onChange={(e) => setPasteSourceUrl(e.target.value)} placeholder="Source URL (optional)" className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600" />
          </div>
          <button onClick={usePasted} disabled={!pasted.trim() || pasteSource.trim().length < 2} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 disabled:opacity-40">Use this list</button>
          {pasteNote && <span role="status" className="ml-3 text-gray-400">{pasteNote}</span>}
        </div>
      </details>

      {error && <p role="alert" className="flex items-center gap-2 text-xs text-red-300"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}

      {preview && (
        <div className="space-y-3">
          <p className="text-xs text-gray-300" data-testid="preview-summary">
            {preview.rowCount} row(s): <span className="text-emerald-300">{preview.accepted} accepted</span>, <span className="text-amber-300">{preview.duplicates} duplicate</span>, <span className="text-red-300">{preview.rejected} rejected</span>.{' '}
            {preview.status === 'committed'
              ? 'This exact file was already imported, so nothing was re-checked and nothing new was created. These are the results from that earlier import; change the file to check it again.'
              : 'Nothing has been created yet.'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-gray-500"><th className="py-1 pr-3">Row</th><th className="pr-3">Clinic</th><th className="pr-3">Outcome</th><th>Reasons / flags</th></tr></thead>
              <tbody>
                {preview.results.map((r) => (
                  <tr key={r.row} className="border-t border-white/5 align-top">
                    <td className="py-1 pr-3 text-gray-400">{r.row}</td>
                    <td className="pr-3 text-gray-200">{r.businessName ?? '—'}</td>
                    <td className={`pr-3 font-bold ${OUTCOME_CLS[r.outcome]}`}>{r.outcome}</td>
                    <td className="text-gray-400">{[...r.reasons, ...r.flags].join(' · ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.status === 'previewed' && preview.accepted > 0 && (
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-xs text-gray-300">
                <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} aria-label="Attest lawful source" className="mt-0.5" />
                I confirm this data was obtained lawfully from the sources stated, does not come from Google Maps, and that named contacts have the stated lawful basis.
              </label>
              <button onClick={commit} disabled={!attest || busy} className="text-xs font-bold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40">
                Create {preview.accepted} prospect(s)
              </button>
            </div>
          )}
          {done && <p className="flex items-center gap-2 text-xs text-emerald-300"><CheckCircle2 className="w-3.5 h-3.5" />{done}</p>}
        </div>
      )}
    </section>
  );
}
