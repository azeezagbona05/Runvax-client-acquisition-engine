'use client';

import { Loader2 } from 'lucide-react';
import { campaignReady, statusOf, type ContactRecord } from '@/lib/acqContact';

/** The email of one contact with two separate badges: how it was found, and whether it was verified. Used by both discovery routes. */
export default function ContactEmail({ rec, onVerify, verifying, compact, detail }: { rec: ContactRecord; onVerify?: () => void; verifying?: boolean; compact?: boolean; detail?: string }) {
  const s = statusOf(rec);
  const tone = (t: string) => `acq-pill acq-pill-${t}`;
  // Compact: one outcome pill (Ready to send / Check first / Don't use). The detail sits in its tooltip.
  const outcome = !rec.email ? null
    : rec.verification === 'invalid' ? { label: "Don't use", tone: 'red' }
    : verifying ? { label: 'Checking…', tone: 'gray' }
    : campaignReady(rec) ? { label: 'Ready to send', tone: 'green' }
    : { label: 'Check first', tone: 'amber' };
  const why = [s.found.hint, s.verified?.hint, detail].filter(Boolean).join(' ');
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {rec.email
        ? <span style={{ fontSize: 12.5, ...(rec.verification === 'invalid' ? { textDecoration: 'line-through', color: '#94a3b8' } : {}) }}>{rec.email}</span>
        : <span className="acq-faint" style={{ fontSize: 12.5 }}>No email found</span>}
      {compact
        ? outcome && <span className={tone(outcome.tone)} title={why}>{outcome.label}</span>
        : <>
            <span className={tone(s.found.tone)} title={s.found.hint}>{s.found.label}</span>
            {s.verified && <span className={tone(s.verified.tone)} title={s.verified.hint}>{verifying ? 'Checking…' : s.verified.label}</span>}
          </>}
      {onVerify && rec.email && rec.verification === 'unverified' && (
        <button type="button" className="acq-btn acq-btn-sm" disabled={verifying} onClick={onVerify}>{verifying ? <Loader2 size={13} className="animate-spin" /> : null} Verify</button>
      )}
    </span>
  );
}
