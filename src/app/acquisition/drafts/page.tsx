'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';
import { api, dateTime, OFFER_NAMES } from '../_components/format';

/* eslint-disable @typescript-eslint/no-explicit-any */
const FILTERS = ['', 'pending_approval', 'approved', 'ready', 'stale', 'rejected', 'blocked', 'sent', 'superseded'];

// The human review queue. Validity is re-checked against current evidence on every load.
export default function AcquisitionDraftsPage() {
  const [status, setStatus] = useState('pending_approval');
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setItems(null);
    api<{ items: any[] }>(`/api/acquisition/drafts${status ? `?status=${status}` : ''}`).then((r) => setItems(r.items)).catch((e) => setError(e.message));
  }, [status]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-4">
      <Link href="/acquisition" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white"><ArrowLeft className="w-3.5 h-3.5" /> Industry Acquisition</Link>
      <h1 className="text-2xl font-black text-white">Pitch review queue</h1>
      <p className="text-sm text-gray-400">Deterministic drafts awaiting a human decision. Nothing here is delivered.</p>
      <label className="text-xs text-gray-300 flex items-center gap-2">Status
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-black/40 border border-white/10 rounded px-2 py-1">
          {FILTERS.map((f) => <option key={f} value={f}>{f || 'all'}</option>)}
        </select>
      </label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {!items && !error && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
      {items && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-500"><th className="py-1 pr-3">Clinic</th><th className="pr-3">Offer</th><th className="pr-3">Status</th><th className="pr-3">Version</th><th className="pr-3">Still valid?</th><th>Updated</th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={6} className="py-2 text-gray-500">No drafts.</td></tr>}
              {items.map((d) => (
                <tr key={d.id} className="border-t border-white/5">
                  <td className="py-1 pr-3"><Link className="text-purple-300 hover:text-white" href={`/acquisition/drafts/${d.id}`}>{d.prospectName}</Link></td>
                  <td className="pr-3 text-gray-300">{OFFER_NAMES[d.offerId] ?? d.offerId}</td>
                  <td className="pr-3 text-gray-300">{d.status}</td>
                  <td className="pr-3 text-gray-400">v{d.version}</td>
                  <td className="pr-3">{d.valid === null ? '—' : d.valid ? <span className="text-emerald-300">yes</span> : <span className="text-red-300" title={d.invalidReasons.map((r: any) => r.detail).join('; ')}>no: {d.invalidReasons.map((r: any) => r.code).join(', ')}</span>}</td>
                  <td className="text-gray-400">{dateTime(d.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
