'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, Pencil, Search, Trash2, Wand2 } from 'lucide-react';
import { useHandleAIResponse } from '@/context/UpgradeContext';
import { filterTemplates, type TemplateConfig } from '@/lib/templateLibrary';
import TemplateWizard from '@/components/acq/TemplateWizard';
import { TEMPLATE_ICON } from '@/components/acq/templateIcons';
import { useAcq } from '@/components/acq/AcqProvider';
import CampaignFormModal from '@/components/acq/CampaignFormModal';
import TemplatePreview from '@/components/acq/TemplatePreview';
import { Card, EmptyState } from '@/components/acq/ui';

type Tab = 'official' | 'mine' | 'scratch';

function TemplateCard({ t, onPreview, onUse, onDelete, onRename }: { t: TemplateConfig; onPreview: () => void; onUse: () => void; onDelete?: () => void; onRename?: () => void }) {
  const Icon = TEMPLATE_ICON[t.art.icon];
  return (
    <section className="acq-card" style={{ padding: 16, display: 'grid', gap: 10, alignContent: 'space-between' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <span aria-hidden style={{ width: 40, height: 40, borderRadius: 12, background: '#f3e8ff', color: '#9333ea', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon size={20} /></span>
        <div><h2 className="acq-title" style={{ fontSize: 15.5, fontWeight: 700 }}>{t.name}</h2><p className="acq-sub" style={{ fontSize: 13.5, marginTop: 2 }}>{t.description}</p></div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="acq-btn acq-btn-primary" onClick={onUse}>Use this</button>
        <button className="acq-link" onClick={onPreview}>See the emails</button>
        {onRename && <button className="acq-icon-btn" aria-label={`Rename ${t.name}`} onClick={onRename}><Pencil size={15} /></button>}
        {onDelete && <button className="acq-icon-btn" aria-label={`Delete ${t.name}`} onClick={onDelete}><Trash2 size={15} /></button>}
      </div>
    </section>
  );
}

export default function TemplatesPage() {
  const router = useRouter();
  const handleGate = useHandleAIResponse();
  const { reload } = useAcq();
  const [tab, setTab] = useState<Tab>('official');
  const [q, setQ] = useState('');
  const [mine, setMine] = useState<TemplateConfig[] | null>(null);
  const [ready, setReady] = useState(true);
  const [preview, setPreview] = useState<TemplateConfig | null>(null);
  const [quick, setQuick] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/client-acquisition/templates');
      const j = await res.json() as { mine?: TemplateConfig[]; ready?: boolean };
      setMine(res.ok ? j.mine ?? [] : []); setReady(j.ready !== false);
    } catch { setMine([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const use = (t: TemplateConfig) => router.push(`/client-acquisition/automation?${t.source === 'user' ? 'mine' : 'template'}=${encodeURIComponent(t.id)}`);
  const remove = async (t: TemplateConfig) => {
    if (!window.confirm(`Delete "${t.name}"? Campaigns made from it are not affected.`)) return;
    const res = await fetch(`/api/client-acquisition/templates/${t.id}`, { method: 'DELETE' });
    setNote(res.ok ? 'Template deleted.' : 'Could not delete it.'); await load();
  };
  const rename = async (t: TemplateConfig) => {
    const name = window.prompt('Template name', t.name)?.trim();
    if (!name || name === t.name) return;
    const res = await fetch(`/api/client-acquisition/templates/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    setNote(res.ok ? 'Renamed.' : 'Could not rename it.'); await load();
  };

  const myList = useMemo(() => filterTemplates(mine ?? [], q, ''), [mine, q]);
  const TABS: Array<{ id: Tab; label: string }> = [{ id: 'official', label: 'Templates' }, { id: 'mine', label: `My templates${mine ? ` (${mine.length})` : ''}` }, { id: 'scratch', label: 'From scratch' }];

  return (
    <div className="acq-stack">
      <div style={{ paddingTop: 4 }}>
        <h1 className="acq-page-title">New campaign</h1>
        <p className="acq-sub" style={{ marginTop: 2, maxWidth: 560 }}>Pick an industry, pick a campaign, and you are ready to start.</p>
      </div>
      {note && <div className="acq-notice" role="status" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{note}</span><button className="acq-link" onClick={() => setNote('')}>Dismiss</button></div>}

      <Card>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {TABS.map((t) => <button key={t.id} className={`acq-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>
        {tab === 'mine' && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 420 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 14, color: '#94a3b8' }} />
              <input className="acq-input" style={{ paddingLeft: 34 }} placeholder="Search templates" aria-label="Search templates" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
        )}
      </Card>


      {tab === 'official' && <Card><TemplateWizard onUse={use} onPreview={setPreview} /></Card>}

      {tab === 'mine' && (mine === null ? <Card><Loader2 className="animate-spin" size={18} /></Card>
        : !ready ? <Card><EmptyState title="Saved templates need one database update" body="Official templates work now. Ask an administrator to apply migration 7 to turn on My Templates." /></Card>
        : myList.length === 0 ? <Card><EmptyState title="No saved templates yet" body="Open a campaign that worked and press Save as template. Its emails and settings are kept; its contacts and results are not." /></Card>
        : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{myList.map((t) => <TemplateCard key={t.id} t={t} onPreview={() => setPreview(t)} onUse={() => use(t)} onDelete={() => void remove(t)} onRename={() => void rename(t)} />)}</div>)}

      {tab === 'scratch' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card><div style={{ display: 'grid', gap: 10 }}><span className="acq-stat-icon" style={{ background: '#f3e8ff', color: '#9333ea' }}><Wand2 size={20} /></span><h2 className="acq-title">Describe it to the AI</h2><p className="acq-sub" style={{ fontSize: 13.5 }}>Type your goal or fill in the campaign setup, and the builder writes the whole sequence.</p><div><button className="acq-btn acq-btn-primary" onClick={() => router.push('/client-acquisition/automation')}>Open the builder</button></div></div></Card>
          <Card><div style={{ display: 'grid', gap: 10 }}><span className="acq-stat-icon" style={{ background: '#f3e8ff', color: '#9333ea' }}><FileText size={20} /></span><h2 className="acq-title">Write the emails yourself</h2><p className="acq-sub" style={{ fontSize: 13.5 }}>A plain form for one email and an optional follow-up.</p><div><button className="acq-btn" onClick={() => setQuick(true)}>Quick form</button></div></div></Card>
        </div>
      )}

      {preview && <TemplatePreview t={preview} onClose={() => setPreview(null)} onUse={() => use(preview)} />}
      {quick && <CampaignFormModal onGate={handleGate} onClose={() => setQuick(false)} onSaved={(id) => { setQuick(false); void reload(); router.push(`/client-acquisition/campaigns/${id}`); }} />}
    </div>
  );
}
