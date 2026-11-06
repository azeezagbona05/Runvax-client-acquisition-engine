'use client';

import Link from 'next/link';
import { Check, Clock } from 'lucide-react';
import { INTEGRATION_ROADMAP, PRIORITY_ORDER, type Priority } from '@/lib/acqIntegrations';
import { Card } from '@/components/acq/ui';

const TONE: Record<Priority, { bg: string; ink: string }> = { Critical: { bg: '#fee2e2', ink: '#b91c1c' }, High: { bg: '#f3e8ff', ink: '#7e22ce' }, Medium: { bg: '#f1f5f9', ink: '#475569' } };

/** The integrations RUNVAX is working toward, in priority order, and which ones really exist today. */
export default function IntegrationsPage() {
  const available = INTEGRATION_ROADMAP.filter((i) => i.status === 'available').length;
  return (
    <div className="acq-stack">
      <div style={{ paddingTop: 4 }}>
        <h1 className="acq-page-title">Integrations</h1>
        <p className="acq-sub" style={{ marginTop: 2 }}>The tools your agents and campaigns connect to, in the order we are building them. {available} of {INTEGRATION_ROADMAP.length} work today.</p>
      </div>
      {PRIORITY_ORDER.map((p) => (
        <section key={p} style={{ display: 'grid', gap: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="acq-pill" style={{ background: TONE[p].bg, color: TONE[p].ink }}>{p} priority</span>
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {INTEGRATION_ROADMAP.filter((i) => i.priority === p).map((i) => (
              <Card key={i.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 15.5 }}>{i.name}</p>
                    <p className="acq-sub" style={{ fontSize: 13, marginTop: 2 }}>{i.desc}</p>
                  </div>
                  {i.status === 'available'
                    ? <span className="acq-pill acq-pill-green" style={{ gap: 6 }}><Check size={12} strokeWidth={3} />Available</span>
                    : <span className="acq-pill acq-pill-gray" style={{ gap: 6 }}><Clock size={12} />Planned</span>}
                </div>
                <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5, marginTop: 10 }}>{i.note}</p>
                {(i.id === 'smtp' || i.id === 'gmail') && <Link href="/client-acquisition/settings?tab=email" className="acq-btn acq-btn-sm" style={{ marginTop: 12 }}>Open Email settings</Link>}
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
