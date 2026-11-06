'use client';

import { useState } from 'react';
import { Loader2, Wifi, Send, RotateCcw, CheckCircle } from 'lucide-react';
import { TEMPLATE_BODY } from '@/lib/whatsapp-constants';

interface Phone { id: string; number: string; name: string; quality: string; status: string; wabaId: string }
const TEMPLATE_PREVIEW = TEMPLATE_BODY.replace('{{1}}', '[Business Name]');

/** The V1 WhatsApp Business setup (token → pick number → outreach template), shown on the Integrations card. */
export interface WaExtra { webhookUrl?: string; verifyToken?: string; repliesOn?: boolean }

export default function WhatsAppSetup({ connected, templateStatus, extra, onChanged }: { connected: boolean; templateStatus: string; extra?: WaExtra; onChanged: () => void }) {
  const [appSecret, setAppSecret] = useState('');
  const [token, setToken] = useState('');
  const [phones, setPhones] = useState<Phone[]>([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setErr('');
    try { await fn(); } catch { setErr('Could not reach the server.'); } finally { setBusy(''); }
  };

  const detect = () => run('detect', async () => {
    const res = await fetch('/api/whatsapp/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    const d = await res.json() as { phones?: Phone[]; error?: string };
    if (!res.ok || d.error) { setErr(d.error ?? 'Connection failed'); return; }
    setPhones(d.phones ?? []); setToken('');
  });

  const select = (p: Phone) => run('select', async () => {
    const res = await fetch('/api/client-acquisition/integrations/wa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'select', id: p.id, number: p.number, wabaId: p.wabaId }) });
    const d = await res.json() as { ok: boolean; message: string };
    if (!d.ok) { setErr(d.message); return; }
    setPhones([]); onChanged();
  });

  const createTemplate = () => run('template', async () => {
    const res = await fetch('/api/whatsapp/create-template', { method: 'POST' });
    const d = await res.json() as { error?: string };
    if (!res.ok || d.error) { setErr(d.error ?? 'Could not create the template.'); return; }
    onChanged();
  });

  const refresh = () => run('refresh', async () => {
    await fetch('/api/whatsapp/template-status');
    onChanged();
  });

  const saveSecret = () => run('secret', async () => {
    const res = await fetch('/api/client-acquisition/integrations/wa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'webhook', appSecret }) });
    const d = await res.json() as { ok: boolean; message: string };
    if (!d.ok) { setErr(d.message); return; }
    setAppSecret(''); onChanged();
  });

  const disconnect = () => run('disconnect', async () => {
    if (!window.confirm('Disconnect WhatsApp? Sending from your number will stop.')) return;
    await fetch('/api/client-acquisition/integrations/wa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }) });
    onChanged();
  });

  const Err = () => (err ? <p role="alert" style={{ fontSize: 12.5, color: '#b91c1c', marginTop: 8 }}>{err}</p> : null);
  const Spin = ({ k }: { k: string }) => (busy === k ? <Loader2 size={13} className="animate-spin" /> : null);

  // Step 1: no number chosen yet.
  if (!connected) {
    return (
      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        {phones.length === 0 ? (
          <>
            <label style={{ display: 'grid', gap: 3, fontSize: 12.5, fontWeight: 600 }}>Access token (from your Meta Developer app)
              <input className="acq-input" type="password" autoComplete="off" placeholder="EAAB…" value={token} onChange={(e) => { setToken(e.target.value); setErr(''); }} />
            </label>
            <details style={{ fontSize: 12 }}>
              <summary style={{ cursor: 'pointer', color: '#7e22ce' }}>Where do I get my access token?</summary>
              <div style={{ marginTop: 6, display: 'grid', gap: 4, color: '#475569' }}>
                <p>1. Go to developers.facebook.com/apps and open your WhatsApp app.</p>
                <p>2. WhatsApp → Getting Started → copy the temporary access token.</p>
                <p style={{ color: '#c2410c' }}>Temporary tokens expire in 24 hours. For a permanent one: Business Settings → System Users → Generate Token, with whatsapp_business_messaging and whatsapp_business_management.</p>
              </div>
            </details>
            <div><button className="acq-btn acq-btn-sm acq-btn-primary" onClick={detect} disabled={!token.trim() || !!busy}><Spin k="detect" /><Wifi size={13} />Detect my WhatsApp numbers</button></div>
          </>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>Pick your number</p>
            {phones.map((p) => (
              <button key={p.id} onClick={() => select(p)} disabled={!!busy} className="acq-btn" style={{ justifyContent: 'space-between', textAlign: 'left' }}>
                <span><b>{p.number}</b><br /><span className="acq-sub" style={{ fontSize: 12 }}>{p.name} · {p.status}</span></span>
                <span style={{ color: '#15803d', fontWeight: 700 }}><Spin k="select" />Select →</span>
              </button>
            ))}
          </div>
        )}
        <Err />
      </div>
    );
  }

  // Step 2: number chosen, outreach template not approved yet.
  if (templateStatus !== 'APPROVED') {
    return (
      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 700 }}>Set up your outreach template</p>
        <p className="acq-sub" style={{ fontSize: 12.5 }}>WhatsApp needs a pre-approved template for first messages. We create it and submit it to Meta for you.</p>
        <p style={{ fontSize: 12.5, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, lineHeight: 1.5 }}>{TEMPLATE_PREVIEW}</p>
        {templateStatus === 'PENDING' && <p style={{ fontSize: 12.5, color: '#b45309' }}>Waiting for Meta review (usually 1–24 hours).</p>}
        {templateStatus === 'REJECTED' && <p style={{ fontSize: 12.5, color: '#b91c1c' }}>Meta rejected the template. Contact support and we will help resubmit it with a revised message.</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!templateStatus && <button className="acq-btn acq-btn-sm acq-btn-primary" onClick={createTemplate} disabled={!!busy}><Spin k="template" /><Send size={13} />Create and submit template</button>}
          {templateStatus === 'PENDING' && <button className="acq-btn acq-btn-sm" onClick={refresh} disabled={!!busy}><Spin k="refresh" /><RotateCcw size={13} />Check status now</button>}
          <button className="acq-btn acq-btn-sm" onClick={disconnect} disabled={!!busy}>Change number</button>
        </div>
        <Err />
      </div>
    );
  }

  // Step 3: ready.
  return (
    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5, color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCircle size={14} />Template approved. The API Send button is active on prospects with a phone number.</span>
      <button className="acq-btn acq-btn-sm" onClick={disconnect} disabled={!!busy}>Disconnect</button>
      <div style={{ flexBasis: '100%', display: 'grid', gap: 6, marginTop: 6 }}>
        <p style={{ fontSize: 13, fontWeight: 700 }}>Receive replies in your Inbox {extra?.repliesOn && <span style={{ color: '#15803d', fontWeight: 600 }}>· on</span>}</p>
        <details style={{ fontSize: 12 }}>
          <summary style={{ cursor: 'pointer', color: '#7e22ce' }}>{extra?.repliesOn ? 'Webhook details' : 'Set up reply forwarding (optional)'}</summary>
          <div style={{ marginTop: 6, display: 'grid', gap: 4, color: '#475569', wordBreak: 'break-all' }}>
            <p>In your Meta app → WhatsApp → Configuration → Webhook, set:</p>
            <p><b>Callback URL:</b> <code>{extra?.webhookUrl}</code></p>
            <p><b>Verify token:</b> <code>{extra?.verifyToken}</code></p>
            <p>Subscribe to the <b>messages</b> field. Then paste your <b>App secret</b> (App settings → Basic) below so we can confirm messages really come from Meta.</p>
          </div>
        </details>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="acq-input" style={{ flex: '1 1 220px' }} type="password" autoComplete="off" placeholder={extra?.repliesOn ? 'App secret saved. Paste a new one to replace it' : 'Meta app secret'} value={appSecret} onChange={(e) => { setAppSecret(e.target.value); setErr(''); }} />
          <button className="acq-btn acq-btn-sm acq-btn-primary" onClick={saveSecret} disabled={!appSecret.trim() || !!busy}><Spin k="secret" />Save</button>
        </div>
      </div>
      <Err />
    </div>
  );
}
