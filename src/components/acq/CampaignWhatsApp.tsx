'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, MessageCircle } from 'lucide-react';
import { Card } from './ui';

interface State { blocker: string | null; withPhone: number; waiting: number; sent: number; sentToday: number; cap: number; failed: number }

/** WhatsApp for this campaign: sends the approved template to contacts who have a phone number, within a warm-up daily limit. */
export default function CampaignWhatsApp({ campaignId, running, onSent }: { campaignId: string; running: boolean; onSent: () => void }) {
  const [st, setSt] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const stop = useRef(false);

  const load = useCallback(async () => {
    try { setSt(await (await fetch(`/api/outreach-campaigns/${campaignId}/whatsapp`, { cache: 'no-store' })).json() as State); } catch { /* card stays hidden */ }
  }, [campaignId]);
  useEffect(() => { void load(); }, [load]);

  const send = async () => {
    setBusy(true); setMsg(''); stop.current = false;
    let sent = 0, failed = 0;
    try {
      for (let i = 0; i < 40 && !stop.current; i++) {
        const res = await fetch(`/api/outreach-campaigns/${campaignId}/whatsapp`, { method: 'POST' });
        const j = await res.json() as { sent?: number; failed?: number; blocked?: number; remainingToday?: number; message?: string; error?: string };
        if (!res.ok) { setMsg(j.error ?? 'Could not send.'); break; }
        sent += j.sent ?? 0; failed += (j.failed ?? 0) + (j.blocked ?? 0);
        setMsg(`Sent ${sent} so far…`);
        if (!j.sent && !j.failed && !j.blocked) { setMsg(`${sent ? `Sent ${sent}. ` : ''}${j.message ?? 'Nobody else is waiting.'}`); break; }
        if (j.remainingToday === 0) { setMsg(`Sent ${sent}. Today's WhatsApp limit is reached; the rest can go tomorrow.`); break; }
      }
      if (failed) setMsg((m) => `${m} ${failed} could not be sent (see Activity).`);
    } catch { setMsg('Could not reach the server.'); }
    finally { setBusy(false); await load(); onSent(); }
  };

  if (!st || (st.withPhone === 0 && st.blocker)) return null;
  const disabled = busy || !!st.blocker || !running || st.waiting === 0;
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 8 }}><MessageCircle size={16} color="#16a34a" /> WhatsApp</p>
          <p className="acq-sub" style={{ fontSize: 13, marginTop: 2 }}>
            {st.withPhone === 0 ? 'None of this campaign’s contacts has a phone number. Add a "phone" column when you import leads.'
              : `${st.withPhone} contact${st.withPhone === 1 ? '' : 's'} with a phone · ${st.waiting} waiting · ${st.sent} sent · ${st.sentToday}/${st.cap} today${st.failed ? ` · ${st.failed} failed` : ''}`}
          </p>
          {st.blocker && <p style={{ fontSize: 12.5, color: '#b45309', marginTop: 4 }}>{st.blocker} <Link href="/client-acquisition/integrations" style={{ textDecoration: 'underline', fontWeight: 600 }}>Open Integrations</Link></p>}
          {!st.blocker && !running && st.waiting > 0 && <p className="acq-sub" style={{ fontSize: 12.5, marginTop: 4 }}>Run the campaign first; WhatsApp messages go out only while it is running.</p>}
        </div>
        {busy
          ? <button className="acq-btn acq-btn-danger" onClick={() => { stop.current = true; }}><Loader2 size={15} className="animate-spin" /> Stop</button>
          : <button className="acq-btn" onClick={() => void send()} disabled={disabled}><MessageCircle size={15} /> Send on WhatsApp{st.waiting > 0 ? ` (${st.waiting})` : ''}</button>}
      </div>
      {msg && <p role="status" className="acq-sub" style={{ fontSize: 12.5, marginTop: 8 }}>{msg}</p>}
    </Card>
  );
}
