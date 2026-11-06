'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAcq } from '@/components/acq/AcqProvider';
import ProspectFinder from '@/components/acq/ProspectFinder';
import IndustryDiscover from '@/components/acq/SnovDiscover';
import SignupPrompt from '@/components/acq/SignupPrompt';

/** The default page: find businesses, find their decision-makers, and add the verified ones to a campaign. */
export default function FindProspectsPage() {
  const { gate, guest } = useAcq();
  const [prompt, setPrompt] = useState(false);
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<'maps' | 'people'>('maps');

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
        <p className="acq-sub" style={{ marginTop: 2 }}>Find businesses, identify who runs them, verify their email, then add them to a campaign. {guest ? 'Try a free search below, no account needed.' : <><Link href="/client-acquisition/leads" style={{ textDecoration: 'underline' }}>See your lead lists</Link>.</>}</p>
      </div>
      {prompt && <SignupPrompt reason="Discovering people by industry and seniority needs an account." onClose={() => setPrompt(false)} />}
      {gateNote && <div className="acq-notice" role="status">{gateNote}</div>}
      {notice && <div className="acq-notice" role="status">{notice}</div>}
      <div role="tablist" aria-label="How to find prospects" style={{ display: 'flex', gap: 8 }}>
        <button role="tab" aria-selected={mode === 'maps'} className={`acq-btn${mode === 'maps' ? ' acq-btn-primary' : ''}`} onClick={() => setMode('maps')}>Search by location</button>
        <button role="tab" aria-selected={mode === 'people'} className={`acq-btn${mode === 'people' ? ' acq-btn-primary' : ''}`} onClick={() => { if (guest) { setPrompt(true); return; } setMode('people'); }}>Discover by industry</button>
      </div>
      {mode === 'maps' ? <ProspectFinder onAdded={(m) => setNotice(m)} /> : <IndustryDiscover onAdded={(m) => setNotice(m)} />}
    </div>
  );
}
