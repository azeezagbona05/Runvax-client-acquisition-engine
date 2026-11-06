'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, FileText, Plus, Upload } from 'lucide-react';
import { useHandleAIResponse } from '@/context/UpgradeContext';
import type { LeadInput } from '@/lib/outreachCampaign';
import { useAcq } from './AcqProvider';
import CampaignFormModal, { describeAdded, type AddedSummary, type CampaignPreset } from './CampaignFormModal';
import ImportLeadsModal from './ImportLeadsModal';

/** "New Campaign" (with its menu) and "Import Leads", plus the dialogs they open. */
export default function AcqActions({ onNotice, preset, openNew, hideNew }: { onNotice?: (msg: string) => void; preset?: CampaignPreset | null; openNew?: boolean; hideNew?: boolean }) {
  const router = useRouter();
  const handleGate = useHandleAIResponse();
  const { data, reload } = useAcq();
  const [menu, setMenu] = useState(false);
  const [form, setForm] = useState<{ leads?: LeadInput[]; preset?: CampaignPreset } | null>(openNew ? { preset: preset ?? undefined } : null);
  const [importing, setImporting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menu]);

  const campaigns = (data?.campaigns ?? []).map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {!hideNew && <div ref={ref} style={{ position: 'relative' }}>
          <div className="acq-btn acq-btn-primary acq-btn-split" style={{ padding: 0, height: 44 }}>
            <button onClick={() => router.push('/client-acquisition/templates')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: '100%', padding: '0 6px 0 18px', background: 'transparent', border: 0, color: '#fff', font: 'inherit', fontWeight: 600 }}><Plus size={18} /> New Campaign</button>
            <button className="acq-split-chev" onClick={() => setMenu((v) => !v)} aria-label="More ways to start a campaign" aria-haspopup="menu" aria-expanded={menu} style={{ background: 'transparent', color: '#fff', border: 0, borderLeft: '1px solid rgba(255,255,255,.28)' }}><ChevronDown size={16} /></button>
          </div>
          {menu && (
            <div className="acq-dropdown" role="menu" style={{ top: 50, right: 0, minWidth: 220, padding: 6 }}>
              <button role="menuitem" className="acq-nav-item" style={{ height: 38, width: '100%', border: 0, background: 'transparent', textAlign: 'left' }} onClick={() => { setMenu(false); setForm({}); }}><Plus size={16} /> Quick form (write the emails yourself)</button>
              <button role="menuitem" className="acq-nav-item" style={{ height: 38, width: '100%', border: 0, background: 'transparent', textAlign: 'left' }} onClick={() => { setMenu(false); router.push('/client-acquisition/templates'); }}><FileText size={16} /> From a template</button>
            </div>
          )}
        </div>}
        <button className="acq-btn" style={{ height: 44, padding: '0 20px' }} onClick={() => (campaigns.length ? setImporting(true) : setForm({}))}><Upload size={17} /> Import Leads</button>
      </div>

      {form && (
        <CampaignFormModal
          preset={form.preset} initialLeads={form.leads} onGate={handleGate} onClose={() => setForm(null)}
          onSaved={(id, added: AddedSummary | null | undefined) => {
            setForm(null);
            if (added) onNotice?.(`Campaign created: ${describeAdded(added)}. Send yourself a test, then press Run.`);
            void reload();
            router.push(`/client-acquisition/campaigns/${id}`);
          }}
        />
      )}
      {importing && (
        <ImportLeadsModal
          campaigns={campaigns} onClose={() => setImporting(false)}
          onNewCampaign={(leads) => { setImporting(false); setForm({ leads }); }}
          onImported={(msg) => { setImporting(false); onNotice?.(msg); void reload(); }}
        />
      )}
    </>
  );
}
