'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BedDouble, FileText, Home, Loader2, Pencil, Search, Stethoscope, Trash2, UtensilsCrossed, Wand2, type LucideIcon } from 'lucide-react';
import { useHandleAIResponse } from '@/context/UpgradeContext';
import { INDUSTRIES, OFFICIAL_TEMPLATES, filterTemplates, type TemplateConfig } from '@/lib/templateLibrary';
import { OBJECTIVES } from '@/lib/campaignBrief';
import { useAcq } from '@/components/acq/AcqProvider';
import CampaignFormModal from '@/components/acq/CampaignFormModal';
import TemplatePreview from '@/components/acq/TemplatePreview';
import { Card, EmptyState } from '@/components/acq/ui';

type Tab = 'official' | 'mine' | 'scratch';
const ICON: Record<TemplateConfig['art']['icon'], LucideIcon> = { dental: Stethoscope, restaurant: UtensilsCrossed, hotel: BedDouble, property: Home, custom: FileText };

function TemplateCard({ t, onPreview, onUse, onDelete, onRename }: { t: TemplateConfig; onPreview: () => void; onUse: () => void; onDelete?: () => void; onRename?: () => void }) {
  const Icon = ICON[t.art.icon];
  const objective = OBJECTIVES.find((o) => o.id === t.primaryObjective)?.label ?? '';
  return (
    <section className="acq-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div aria-hidden style={{ height: 96, background: `linear-gradient(135deg, ${t.art.from}, ${t.art.to})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}><Icon size={42} strokeWidth={1.5} /></div>
      <div style={{ padding: 16, display: 'grid', gap: 6, flex: 1, alignContent: 'start' }}>
        <p className="acq-sub" style={{ fontSize: 12.5 }}>{t.industry} · {t.category}</p>
        <h2 className="acq-title" style={{ fontSize: 15.5, fontWeight: 700 }}>{t.name}</h2>
        <p className="acq-sub" style={{ fontSize: 13 }}>{t.description}</p>
        <p style={{ fontSize: 12.5, marginTop: 4 }}><span className="acq-sub">Primary objective: </span><b>{objective}</b></p>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px', flexWrap: 'wrap' }}>
        <button className="acq-btn acq-btn-sm" onClick={onPreview}>Preview</button>
        <button className="acq-btn acq-btn-primary acq-btn-sm" onClick={onUse}>Use Template</button>
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
  const [industry, setIndustry] = useState('');
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

  const official = useMemo(() => filterTemplates(OFFICIAL_TEMPLATES, q, industry), [q, industry]);
  const myList = useMemo(() => filterTemplates(mine ?? [], q, ''), [mine, q]);
  const TABS: Array<{ id: Tab; label: string }> = [{ id: 'official', label: 'Official Templates' }, { id: 'mine', label: `My Templates${mine ? ` (${mine.length})` : ''}` }, { id: 'scratch', label: 'Start from Scratch' }];

  return (
    <div className="acq-stack">
      <div style={{ paddingTop: 4 }}>
        <h1 className="acq-page-title">New campaign</h1>
        <p className="acq-sub" style={{ marginTop: 2, maxWidth: 720 }}>Start from an industry template: it brings the audience, messaging, follow-up sequence and stages. You add your own offer and audience, review everything and approve before anything is sent.</p>
      </div>
      {note && <div className="acq-notice" role="status" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{note}</span><button className="acq-link" onClick={() => setNote('')}>Dismiss</button></div>}

      <Card>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {TABS.map((t) => <button key={t.id} className={`acq-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>
        {tab !== 'scratch' && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 420 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 14, color: '#94a3b8' }} />
              <input className="acq-input" style={{ paddingLeft: 34 }} placeholder="Search templates" aria-label="Search templates" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {tab === 'official' && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Industry">
                {['', ...INDUSTRIES].map((i) => <button key={i || 'all'} className={`acq-chip${industry === i ? ' on' : ''}`} aria-pressed={industry === i} onClick={() => setIndustry(i)}>{i || 'All industries'}</button>)}
              </div>
            )}
          </div>
        )}
      </Card>

      {tab === 'official' && (official.length === 0
        ? <Card><EmptyState title="No templates match" body="Try a different word or pick All industries." /></Card>
        : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{official.map((t) => <TemplateCard key={t.id} t={t} onPreview={() => setPreview(t)} onUse={() => use(t)} />)}</div>)}

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
