'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, RefreshCw, XCircle } from 'lucide-react';
import type { Check } from '@/lib/preflight';

const ICON = {
  block: <XCircle size={16} color="#b42318" style={{ flex: 'none', marginTop: 2 }} />,
  warn: <AlertTriangle size={16} color="#b45309" style={{ flex: 'none', marginTop: 2 }} />,
  info: <Info size={16} color="#64748b" style={{ flex: 'none', marginTop: 2 }} />,
  ok: <CheckCircle2 size={16} color="#16a34a" style={{ flex: 'none', marginTop: 2 }} />,
};

/** "Ready to send?": the problems that would stop the campaign or send it to spam, found before the first email goes out. */
export default function CampaignPreflight({ id, refreshKey }: { id: string; refreshKey: string }) {
  const [data, setData] = useState<{ ready: boolean; checks: Check[] } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showOk, setShowOk] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/outreach-campaigns/${id}/preflight`);
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? 'Could not run the check.'); return; }
      setData(j); setError('');
    } catch { setError('Could not run the check.'); } finally { setBusy(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  if (error) return <div className="acq-warn" role="alert">{error}</div>;
  if (!data) return null;
  const problems = data.checks.filter((c) => c.level === 'block' || c.level === 'warn');
  const rest = data.checks.filter((c) => c.level === 'info' || c.level === 'ok');
  const shown = showOk ? data.checks : problems;
  return (
    <section className="acq-card acq-card-pad" aria-label="Ready to send?" style={{ borderColor: !data.ready ? '#fda29b' : problems.length ? '#fcd9a6' : '#abefc6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="acq-title" style={{ margin: 0 }}>{!data.ready ? 'Not ready to send' : problems.length ? `Ready, with ${problems.length} thing${problems.length === 1 ? '' : 's'} to improve` : 'Ready to send'}</h2>
        <span style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="acq-link" onClick={() => setShowOk((v) => !v)}>{showOk ? 'Show problems only' : `Show all checks (${data.checks.length})`}</button>
          <button type="button" className="acq-link" onClick={() => void load()} disabled={busy} aria-label="Check again"><RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Check again</button>
        </span>
      </div>
      <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gap: 8 }}>
        {shown.map((c) => (
          <li key={c.id} style={{ display: 'flex', gap: 10, fontSize: 13.5 }}>
            {ICON[c.level]}<span><b style={{ fontWeight: 600 }}>{c.title}</b>{c.detail && <span className="acq-sub" style={{ display: 'block', fontSize: 12.5 }}>{c.detail}</span>}</span>
          </li>
        ))}
        {!showOk && problems.length === 0 && <li className="acq-sub" style={{ fontSize: 13 }}>{rest.filter((c) => c.level === 'ok').length} checks passed.</li>}
      </ul>
    </section>
  );
}
