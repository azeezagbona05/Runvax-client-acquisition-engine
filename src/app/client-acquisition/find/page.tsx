'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAcq } from '@/components/acq/AcqProvider';
import ProspectFinder from '@/components/acq/ProspectFinder';

/** The default page: find businesses on Google Maps, find their decision-makers, and add the verified ones to a campaign. */
export default function FindProspectsPage() {
  const { gate } = useAcq();
  const [notice, setNotice] = useState('');

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
      <ProspectFinder onAdded={(m) => setNotice(m)} />
    </div>
  );
}
