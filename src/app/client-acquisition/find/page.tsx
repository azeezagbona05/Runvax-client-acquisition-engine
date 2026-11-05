'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAcq } from '@/components/acq/AcqProvider';
import ProspectFinder from '@/components/acq/ProspectFinder';
import SnovDiscover from '@/components/acq/SnovDiscover';

/** The default page: find businesses on Google Maps, find their decision-makers, and add the verified ones to a campaign. */
export default function FindProspectsPage() {
  const { gate } = useAcq();
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<'maps' | 'snov'>('maps');

  const gateNote = gate === 'locked'
    ? 'Searching is available on your plan. Adding prospects to a campaign is part of Email Blast (Pro and Agency).'
    : gate === 'unverified'
      ? 'Verify your email to add prospects to campaigns. Searching works now.'
      : gate === 'setup'
        ? 'Campaigns are not set up yet, so you can search but not add prospects to a campaign.'
        : '';

  return (
    <div className="acq-stack">
      <div style={{ paddingTop: 4 }}>
        <h1 className="acq-page-title">Find Prospects</h1>
        <p className="acq-sub" style={{ marginTop: 2 }}>Find businesses on Google Maps, identify who runs them, verify their email, then add them to a campaign. <Link href="/client-acquisition/leads" style={{ textDecoration: 'underline' }}>See your lead lists</Link>.</p>
      </div>
      {gateNote && <div className="acq-notice" role="status">{gateNote}</div>}
      {notice && <div className="acq-notice" role="status">{notice}</div>}
      <div role="tablist" aria-label="How to find prospects" style={{ display: 'flex', gap: 8 }}>
        <button role="tab" aria-selected={mode === 'maps'} className={`acq-btn${mode === 'maps' ? ' acq-btn-primary' : ''}`} onClick={() => setMode('maps')}>Search Google Maps</button>
        <button role="tab" aria-selected={mode === 'snov'} className={`acq-btn${mode === 'snov' ? ' acq-btn-primary' : ''}`} onClick={() => setMode('snov')}>Discover with Snov</button>
      </div>
      {mode === 'maps' ? <ProspectFinder onAdded={(m) => setNotice(m)} /> : <SnovDiscover onAdded={(m) => setNotice(m)} />}
    </div>
  );
}
