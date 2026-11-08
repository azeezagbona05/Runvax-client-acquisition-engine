'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { useAcq } from '@/components/acq/AcqProvider';
import AcqActions from '@/components/acq/AcqActions';
import StatCards from '@/components/acq/StatCards';
import PerformanceChart from '@/components/acq/PerformanceChart';
import AgentsPanel from '@/components/acq/AgentsPanel';
import CampaignList from '@/components/acq/CampaignList';
import TopLeads from '@/components/acq/TopLeads';
import RecentActivity from '@/components/acq/RecentActivity';
import { Card, EmptyState, Skeleton } from '@/components/acq/ui';

export default function CampaignOverview() {
  const { data, error, days, setDays, reload } = useAcq();
  const [notice, setNotice] = useState('');

  const open = data?.campaigns.filter((c) => c.status !== 'completed') ?? [];

  return (
    <div className="acq-stack">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingTop: 4 }}>
        <div>
          <h1 className="acq-page-title">Client Acquisition</h1>
          <p className="acq-sub" style={{ marginTop: 2 }}>Upload leads, let AI research, personalise and send emails to get you more clients.</p>
        </div>
        <AcqActions onNotice={setNotice} />
      </div>

      {notice && (
        <div className="acq-notice" role="status" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{notice}</span><button className="acq-link" style={{ color: '#64748b' }} onClick={() => setNotice('')}>Dismiss</button>
        </div>
      )}
      {error && !data && (
        <div className="acq-warn" role="alert" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{error}</span><button className="acq-link" onClick={() => void reload()}>Try again</button>
        </div>
      )}
      {data && !data.mailboxReady && (
        <div className="acq-warn" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertTriangle size={17} style={{ marginTop: 2, flex: 'none' }} />
          <span>Connect your own email before you run a campaign. It sends from your mailbox so replies come to you. <Link href="/client-acquisition/settings?tab=email" style={{ textDecoration: 'underline', fontWeight: 600 }}>Open Settings</Link></span>
        </div>
      )}

      <StatCards cards={data?.cards ?? null} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.38fr)_minmax(0,1fr)]">
        <PerformanceChart series={data?.series ?? null} days={days} onDays={setDays} />
        <AgentsPanel />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Card title="Active Campaigns" right={<Link href="/client-acquisition/campaigns" className="acq-link">View all campaigns <ArrowRight size={13} /></Link>}>
          {!data ? (
            <div style={{ display: 'grid', gap: 18 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={52} />)}</div>
          ) : open.length === 0 ? (
            <EmptyState title="No active campaigns" body="Create a campaign, upload your leads and press Run. Your results show up here."
              action={<AcqActions onNotice={setNotice} />} />
          ) : (
            <CampaignList rows={open} limit={3} onChanged={() => void reload()} />
          )}
        </Card>
        {data ? <TopLeads leads={data.topLeads} /> : <Card title="Top Leads by Engagement"><div style={{ display: 'grid', gap: 14 }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={30} />)}</div></Card>}
      </div>

      {data ? <RecentActivity events={data.activity} /> : <Card title="Recent Activity"><div style={{ display: 'grid', gap: 12 }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={22} />)}</div></Card>}
    </div>
  );
}
