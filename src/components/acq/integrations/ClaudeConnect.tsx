'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { Card } from '../ui';

interface Status { connected: boolean; createdAt: string | null; lastUsedAt: string | null; endpoint: string }
const READS = ['Your campaigns and their results', 'Replies from prospects, and how each was classified', 'Your AI agents and their activity', 'Leads your chat assistants collected', 'Articles your visibility agents wrote'];
const PLACEHOLDER = 'PASTE_YOUR_TOKEN_HERE';
const ASK = ['List my RUNVAX campaigns and tell me which one is doing best.', 'Show the replies from this week that still need an answer.', 'Which leads did my chat assistant collect this week?', 'Do any of my agents have articles waiting for my approval?'];

function Copy1({ label, text }: { label: string; text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <span className="acq-label">{label}</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <pre style={{ flex: 1, margin: 0, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{text}</pre>
        <button className="acq-btn" aria-label={`Copy ${label}`} onClick={() => { void navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1600); }}>{ok ? <Check size={15} /> : <Copy size={15} />}</button>
      </div>
    </div>
  );
}

/** Connect RUNVAX to Claude over MCP: make a personal token, then the steps for Claude Code and Claude Desktop, always on the page. */
export default function ClaudeConnect() {
  const [st, setSt] = useState<Status | null>(null); const [token, setToken] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [app, setApp] = useState<'code' | 'desktop'>('code');
  const load = useCallback(() => { fetch('/api/client-acquisition/mcp-token', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject())).then(setSt).catch(() => setErr('Could not load the Claude connection.')); }, []);
  useEffect(() => { load(); }, [load]);

  async function make() {
    if (st?.connected && !window.confirm('This replaces your current token. Anything using the old one stops working. Continue?')) return;
    setBusy(true); setErr('');
    const r = await fetch('/api/client-acquisition/mcp-token', { method: 'POST' }); const j = await r.json().catch(() => ({}));
    setBusy(false); if (!r.ok) { setErr(j.error || 'Could not make a token.'); return; }
    setToken(j.token); load();
  }
  async function disconnect() {
    if (!window.confirm('Disconnect Claude? The token stops working at once.')) return;
    setBusy(true); await fetch('/api/client-acquisition/mcp-token', { method: 'DELETE' }); setBusy(false); setToken(''); load();
  }
  const url = st?.endpoint ?? '';
  const t = token || PLACEHOLDER;
  const command = `claude mcp add --transport http --scope user runvax ${url} --header "Authorization: Bearer ${t}"`;
  const desktop = JSON.stringify({ mcpServers: { runvax: { command: 'npx', args: ['-y', 'mcp-remote', url, '--header', 'Authorization:${AUTH_HEADER}'], env: { AUTH_HEADER: `Bearer ${t}` } } } }, null, 2);
  const ready = !!st && (!st.connected || !st.lastUsedAt); // open the steps until Claude has actually been used once

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 15.5 }}>Claude (MCP)</p>
          <p className="acq-sub" style={{ fontSize: 13, marginTop: 2 }}>Connect RUNVAX to Claude, then ask it about your campaigns, replies, agents and leads in plain English.</p>
        </div>
        {!st ? <span className="acq-pill acq-pill-gray"><Loader2 size={12} className="animate-spin" /></span> : st.connected ? <span className="acq-pill acq-pill-green" style={{ gap: 6 }}><Check size={12} strokeWidth={3} />Connected</span> : <span className="acq-pill acq-pill-gray">Not connected</span>}
      </div>
      <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5, marginTop: 10 }}>Claude can read: {READS.join(' · ')}. It is read-only: it cannot send emails, change a campaign or touch your settings.</p>
      {st?.connected && <p className="acq-sub" style={{ fontSize: 11.5, marginTop: 4 }}>Token made {st.createdAt ? new Date(st.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : ''} · {st.lastUsedAt ? `last used ${new Date(st.lastUsedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : 'not used yet'}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <button className="acq-btn acq-btn-sm acq-btn-primary" onClick={() => void make()} disabled={busy || !st}>{busy && <Loader2 size={13} className="animate-spin" />}{st?.connected ? 'Make a new token' : 'Connect Claude'}</button>
        {st?.connected && <button className="acq-btn acq-btn-sm" onClick={() => void disconnect()} disabled={busy}>Disconnect</button>}
      </div>
      {err && <p role="alert" style={{ fontSize: 12.5, marginTop: 10, color: '#b91c1c' }}>{err}</p>}

      {token && (
        <div style={{ display: 'grid', gap: 10, marginTop: 14, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
          <p className="acq-notice" style={{ fontSize: 13 }}><b>Copy your token now.</b> RUNVAX shows it only once and keeps just a fingerprint. Treat it like a password: anyone who has it can read this account&apos;s data through Claude. The commands below already have it filled in.</p>
          <Copy1 label="Your token" text={token} />
        </div>
      )}

      {st && (
        <details open={ready} style={{ marginTop: 14, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>How to connect Claude to RUNVAX</summary>
          <ol style={{ margin: '12px 0 0', paddingLeft: 22, display: 'grid', gap: 14, fontSize: 13.5, lineHeight: 1.5, listStyleType: 'decimal' }}>
            <li><b>Make your token.</b> Press <b>{st.connected ? 'Make a new token' : 'Connect Claude'}</b> above and copy the token. It is shown once. {st.connected && !token && 'The commands below show a placeholder until you make a new token, because RUNVAX never keeps the original.'}</li>
            <li><div style={{ display: 'grid', gap: 10 }}>
              <span><b>Add RUNVAX to Claude.</b> Choose the Claude you use:</span>
              <div className="acq-seg" role="tablist" aria-label="Which Claude" style={{ justifySelf: 'start' }}>
                <button role="tab" aria-selected={app === 'code'} className={app === 'code' ? 'on' : ''} onClick={() => setApp('code')}>Claude Code</button>
                <button role="tab" aria-selected={app === 'desktop'} className={app === 'desktop' ? 'on' : ''} onClick={() => setApp('desktop')}>Claude Desktop</button>
              </div>
              {app === 'code' ? <>
                <Copy1 label="Run this in your terminal" text={command} />
                <span className="acq-faint" style={{ fontSize: 12.5 }}>Then check it: run <code>claude mcp list</code>. You should see <code>runvax</code> connected. Start a new Claude Code session to use it.</span>
              </> : <>
                <span className="acq-faint" style={{ fontSize: 12.5 }}>Needs <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="acq-link">Node.js</a>. In Claude Desktop open <b>Settings → Developer → Edit Config</b> and add this to <code>claude_desktop_config.json</code> (if it already has <code>mcpServers</code>, add only the <code>runvax</code> part inside it). Save, then quit and reopen Claude Desktop.</span>
                <Copy1 label="claude_desktop_config.json" text={desktop} />
                <span className="acq-faint" style={{ fontSize: 12.5 }}>Then check it: open a new chat, click the tools icon under the message box, and look for <b>runvax</b>.</span>
              </>}
            </div></li>
            <li><div style={{ display: 'grid', gap: 6 }}>
              <span><b>Ask Claude about your account.</b> For example:</span>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 2, listStyleType: 'disc' }}>{ASK.map((q) => <li key={q}>“{q}”</li>)}</ul>
            </div></li>
          </ol>
          <div className="acq-faint" style={{ fontSize: 12.5, marginTop: 12, display: 'grid', gap: 4 }}>
            <span><b>The claude.ai website</b> is not supported yet: its &quot;custom connector&quot; asks for a sign-in flow (OAuth) that RUNVAX does not offer. Use Claude Code or Claude Desktop for now.</span>
            <span><b>Claude says unauthorized?</b> The token is wrong, was replaced by a newer one, or the account was disconnected. Make a new token and update the command.</span>
            <span><b>Done with it?</b> Press Disconnect. The token stops working at once.</span>
          </div>
        </details>
      )}
    </Card>
  );
}
