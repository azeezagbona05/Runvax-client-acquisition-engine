'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, AlertTriangle, Loader2 } from 'lucide-react';
import { INTEGRATIONS, PRIORITY_ORDER, type IntegrationDef, type Priority } from '@/lib/acqIntegrations';
import { Card } from '@/components/acq/ui';
import WhatsAppSetup from '@/components/acq/integrations/WhatsAppSetup';

const TONE: Record<Priority, { bg: string; ink: string }> = { Critical: { bg: '#fee2e2', ink: '#b91c1c' }, High: { bg: '#f3e8ff', ink: '#7e22ce' }, Medium: { bg: '#f1f5f9', ink: '#475569' } };

interface Status { id: string; state: 'connected' | 'not_connected' | 'error'; summary: string; detail?: string; lastCheckedAt?: string | null; lastSyncAt?: string | null; extra?: { url?: string; waTemplateStatus?: string; webhookUrl?: string; verifyToken?: string; repliesOn?: boolean } }
interface Reply { ok: boolean; message: string; redirect?: string; data?: { secret?: string; slots?: string[]; link?: string; meet?: string } }

function IntegrationCard({ def, status, reload }: { def: IntegrationDef; status?: Status; reload: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState('');
  const state: Status['state'] = status?.state ?? 'not_connected';
  const connected = state === 'connected';
  const errored = state === 'error';

  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action); setMsg(null);
    try {
      const res = await fetch(`/api/client-acquisition/integrations/${def.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
      const r = await res.json() as Reply;
      if (r.redirect) { window.location.href = r.redirect; return; }
      let text = r.message || (res.ok ? 'Done.' : 'Something went wrong.');
      if (r.data?.slots) text += r.data.slots.length ? ` ${r.data.slots.map((s) => new Date(s).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })).join(' · ')}` : '';
      setMsg({ ok: r.ok, text });
      if (r.data?.secret) setSecret(r.data.secret);
      if (r.ok && action === 'connect') { setOpen(false); setForm({}); }
      reload();
    } catch { setMsg({ ok: false, text: 'Could not reach the server.' }); }
    finally { setBusy(null); }
  };

  const connect = () => (def.oauth ? call('connect', { tz: Intl.DateTimeFormat().resolvedOptions().timeZone }) : def.fields ? setOpen((o) => !o) : null);
  const both = !!(def.oauth && def.fields);

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 15.5 }}>{def.name}</p>
          <p className="acq-sub" style={{ fontSize: 13, marginTop: 2 }}>{def.desc}</p>
        </div>
        {!status ? <span className="acq-pill acq-pill-gray"><Loader2 size={12} className="animate-spin" /></span>
          : connected ? <span className="acq-pill acq-pill-green" style={{ gap: 6 }}><Check size={12} strokeWidth={3} />Connected</span>
          : errored ? <span className="acq-pill acq-pill-red" style={{ gap: 6 }}><AlertTriangle size={12} />Needs attention</span>
          : <span className="acq-pill acq-pill-gray">Not connected</span>}
      </div>
      <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5, marginTop: 10 }}>{connected || state === 'error' ? status?.summary : def.uses}</p>
      {errored && status?.detail && <p style={{ fontSize: 12.5, color: '#b91c1c', marginTop: 6 }}>{status.detail}</p>}
      {connected && status?.lastSyncAt && <p className="acq-sub" style={{ fontSize: 11.5, marginTop: 4 }}>Last synced {new Date(status.lastSyncAt).toLocaleString()}</p>}

      {def.guided === 'whatsapp' && <WhatsAppSetup connected={connected} templateStatus={status?.extra?.waTemplateStatus ?? ''} extra={status?.extra} onChanged={reload} />}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {!def.guided && (!connected || errored) && (def.settingsHref && !def.fields
          ? <Link href={def.settingsHref} className="acq-btn acq-btn-sm acq-btn-primary">Connect</Link>
          : <button className="acq-btn acq-btn-sm acq-btn-primary" onClick={connect} disabled={!!busy}>{busy === 'connect' && <Loader2 size={13} className="animate-spin" />}{errored ? 'Reconnect' : both ? 'Sign in with Google' : 'Connect'}</button>)}
        {!def.guided && (!connected || errored) && both && <button className="acq-btn acq-btn-sm" onClick={() => setOpen((o) => !o)} disabled={!!busy}>Use an app password instead</button>}
        {(connected || errored) && <button className="acq-btn acq-btn-sm" onClick={() => call('test')} disabled={!!busy}>{busy === 'test' && <Loader2 size={13} className="animate-spin" />}Test connection</button>}
        {connected && def.actions?.map((a) => <button key={a.action} className="acq-btn acq-btn-sm" onClick={() => call(a.action)} disabled={!!busy}>{busy === a.action && <Loader2 size={13} className="animate-spin" />}{a.label}</button>)}
        {connected && def.settingsHref && <Link href={def.settingsHref} className="acq-btn acq-btn-sm">Manage</Link>}
        {!def.guided && connected && (def.fields || def.oauth) && <button className="acq-btn acq-btn-sm" onClick={() => { if (window.confirm(`Disconnect ${def.name}?`)) call('disconnect'); }} disabled={!!busy}>Disconnect</button>}
      </div>

      {open && def.fields && (
        <form onSubmit={(e) => { e.preventDefault(); call('connect', form); }} style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {def.fields.map((f) => (
            <label key={f.name} style={{ display: 'grid', gap: 3, fontSize: 12.5, fontWeight: 600 }}>{f.label}
              <input className="acq-input" type={f.type ?? 'text'} placeholder={f.placeholder} value={form[f.name] ?? ''} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} autoComplete="off" />
            </label>
          ))}
          {def.help && <p className="acq-sub" style={{ fontSize: 12 }}>{def.help}</p>}
          <div><button type="submit" className="acq-btn acq-btn-sm acq-btn-primary" disabled={!!busy}>{busy === 'connect' && <Loader2 size={13} className="animate-spin" />}Save and test</button></div>
        </form>
      )}
      {secret && <p style={{ fontSize: 12.5, marginTop: 10, wordBreak: 'break-all' }}><b>Signing secret (copy now):</b> <code>{secret}</code></p>}
      {msg && <p role="status" style={{ fontSize: 12.5, marginTop: 10, color: msg.ok ? '#15803d' : '#b91c1c' }}>{msg.text}</p>}
    </Card>
  );
}

/** Every tool Client Acquisition connects to, with its real connection state for this account. */
export default function IntegrationsPage() {
  const [statuses, setStatuses] = useState<Status[] | null>(null);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/client-acquisition/integrations', { cache: 'no-store' });
      const d = await r.json() as { integrations?: Status[]; error?: string };
      if (d.integrations) { setStatuses(d.integrations); setError(''); } else setError(d.error ?? 'Could not load integrations.');
    } catch { setError('Could not load integrations.'); }
  }, []);

  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search), g = q.get('gcal') ?? q.get('gmail'), what = q.get('gmail') ? 'Gmail' : 'Google Calendar';
    if (g) {
      setBanner(g === 'connected' ? { ok: true, text: `${what} connected.` } : g === 'cancelled' ? { ok: false, text: `${what} was not connected.` } : { ok: false, text: q.get('msg') || `${what} could not be connected.` });
      window.history.replaceState(null, '', '/client-acquisition/integrations');
    }
  }, [load]);

  const connectedCount = statuses?.filter((s) => s.state === 'connected').length ?? 0;
  return (
    <div className="acq-stack">
      <div style={{ paddingTop: 4 }}>
        <h1 className="acq-page-title">Integrations</h1>
        <p className="acq-sub" style={{ marginTop: 2 }}>Connect the tools your agents and campaigns use. {statuses ? `${connectedCount} of ${INTEGRATIONS.length} connected.` : ''}</p>
      </div>
      {banner && <p role="status" style={{ fontSize: 13.5, fontWeight: 600, color: banner.ok ? '#15803d' : '#b91c1c' }}>{banner.text}</p>}
      {error && <p style={{ fontSize: 13.5, color: '#b91c1c' }}>{error}</p>}
      {PRIORITY_ORDER.map((p) => (
        <section key={p} style={{ display: 'grid', gap: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="acq-pill" style={{ background: TONE[p].bg, color: TONE[p].ink }}>{p} priority</span>
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {INTEGRATIONS.filter((i) => i.priority === p).map((i) => <IntegrationCard key={i.id} def={i} status={statuses?.find((s) => s.id === i.id)} reload={load} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
