'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useHandleAIResponse } from '@/context/UpgradeContext';
import type { LeadInput } from '@/lib/outreachCampaign';
import LeadPicker from './LeadPicker';
import { describeAdded, type AddedSummary } from './CampaignFormModal';

interface Props {
  campaigns: Array<{ id: string; name: string }>;
  /** Pre-select a campaign (when importing from inside one). */
  campaignId?: string;
  onClose: () => void;
  onImported: (message: string) => void;
  /** The person wants a brand-new campaign for these leads instead. */
  onNewCampaign: (leads: LeadInput[]) => void;
}

export default function ImportLeadsModal({ campaigns, campaignId, onClose, onImported, onNewCampaign }: Props) {
  const handleGate = useHandleAIResponse();
  const [target, setTarget] = useState(campaignId ?? campaigns[0]?.id ?? '');
  const [leads, setLeads] = useState<LeadInput[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/outreach-campaigns/${target}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leads }) });
      const json = await res.json() as AddedSummary & { error?: string; code?: string };
      if (handleGate(res, json) === true) return;
      if (!res.ok) { setError(json.error ?? 'Could not add those leads.'); return; }
      onImported(`${describeAdded(json)}${json.added ? `. They're queued in "${campaigns.find((c) => c.id === target)?.name ?? 'the campaign'}".` : ''}`);
    } catch { setError('Could not add those leads. Check your connection and try again.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="acq-modal-scrim" onMouseDown={onClose}>
      <div className="acq-modal" role="dialog" aria-modal="true" aria-label="Import leads" onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid #eef2f8' }}>
          <h2 className="acq-title" style={{ fontSize: 18 }}>Import leads</h2>
          <button className="acq-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div style={{ padding: 22, display: 'grid', gap: 18 }}>
          {campaigns.length > 0 && (
            <div>
              <label className="acq-label" htmlFor="acq-target">Add to campaign</label>
              <select id="acq-target" className="acq-select" value={target} onChange={(e) => setTarget(e.target.value)}>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <LeadPicker leads={leads} onChange={setLeads} />
          {error && <p role="alert" style={{ color: '#b91c1c', fontSize: 13.5 }}>{error}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 22px', borderTop: '1px solid #eef2f8' }}>
          <button className="acq-btn" disabled={leads.length === 0} onClick={() => onNewCampaign(leads)}>Start a new campaign with these</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="acq-btn" onClick={onClose}>Cancel</button>
            <button className="acq-btn acq-btn-primary" disabled={busy || leads.length === 0 || !target} onClick={() => void submit()}>
              {busy && <Loader2 size={16} className="animate-spin" />} Add {leads.length || ''} lead{leads.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
