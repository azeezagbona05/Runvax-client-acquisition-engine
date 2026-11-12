'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, ExternalLink, Loader2, Pause, Play, Trash2 } from 'lucide-react';
import { configIssues, type AgentConfig, type AssistantConfig, type VisibilityConfig } from '@/lib/agents/kinds';
import type { presentAgent } from '@/lib/agents/present';
import { Pill } from '../ui';
import AgentForm from './AgentForm';
import AgentPreview from './AgentPreview';
import { TEMPLATES } from '@/lib/agents/templates';

type Agent = ReturnType<typeof presentAgent>;
interface Post { id: string; title: string; summary: string; body: string; status: string; source: string; pushed: Array<{ dest: string; ok: boolean; detail: string }> | null; publishedAt: string | null; createdAt: string }
interface Chat { id: string; channel: string; visitor: { name?: string; email?: string; phone?: string; company?: string; need?: string; order?: string } | null; status: string; messages: Array<{ r: 'v' | 'a'; t: string }>; updatedAt: string }
const STATUS_PILL: Record<string, string> = { active: 'Running', paused: 'Paused', draft: 'Not started' };
const api = (path: string, method: string, body?: unknown) => fetch(`/api/client-acquisition/agents${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) as Record<string, any> })); // eslint-disable-line @typescript-eslint/no-explicit-any

function CopyBox({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <span className="acq-label">{label}</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <pre style={{ flex: 1, margin: 0, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12.5, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{text}</pre>
        <button className="acq-btn" aria-label={`Copy ${label}`} onClick={() => { void navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1600); }}>{ok ? <Check size={15} /> : <Copy size={15} />}</button>
      </div>
    </div>
  );
}

export default function AgentManage({ id }: { id: string }) {
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null); const [posts, setPosts] = useState<Post[]>([]); const [chats, setChats] = useState<Chat[]>([]);
  const [missing, setMissing] = useState(false); const [tab, setTab] = useState<'work' | 'try' | 'settings' | 'deploy'>('work');
  const [cfg, setCfg] = useState<AgentConfig | null>(null); const [name, setName] = useState(''); const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pw, setPw] = useState(''); const [tg, setTg] = useState(''); const [count, setCount] = useState(1);
  const [open, setOpen] = useState<string | null>(null); const [edit, setEdit] = useState<{ id: string; title: string; summary: string; body: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/client-acquisition/agents/${id}`); if (r.status === 404) { setMissing(true); return; }
    const j = await r.json(); setAgent(j.agent); setPosts(j.posts ?? []); setChats(j.chats ?? []);
    setCfg((c) => c ?? j.agent.config); setName((n) => n || j.agent.name);
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  // Deep links from the Studio (Deployments, Conversations) open the right tab: ?tab=deploy | try | settings | work.
  useEffect(() => { try { const t = new URLSearchParams(window.location.search).get('tab'); if (t === 'work' || t === 'try' || t === 'settings' || t === 'deploy') setTab(t); } catch { /* default tab */ } }, []);

  if (missing) return <p className="acq-sub">That agent was not found. <Link className="acq-link" href="/client-acquisition/agents">Back to agents</Link></p>;
  if (!agent || !cfg) return <p className="acq-sub"><Loader2 size={16} className="animate-spin" style={{ display: 'inline' }} /> Loading…</p>;
  const vis = agent.kind === 'visibility'; const tplInfo = vis ? TEMPLATES.visibility : TEMPLATES[(agent.config as AssistantConfig).template];
  const flash = (ok: boolean, t: string) => setMsg({ ok, t });

  async function save(extra: Record<string, unknown> = {}) {
    setBusy('save'); setMsg(null);
    const { ok, j } = await api(`/${id}`, 'PATCH', { name, config: cfg, ...extra });
    setBusy(''); if (!ok) { flash(false, j.error || 'Could not save.'); return false; }
    setAgent(j.agent); setDirty(false); setPw(''); setTg(''); flash(true, 'Saved.'); return true;
  }
  async function setStatus(status: 'active' | 'paused') {
    if (dirty && !(await save())) return;
    setBusy('status'); const { ok, j } = await api(`/${id}`, 'PATCH', { status }); setBusy('');
    if (!ok) { flash(false, j.error || 'Could not change the status.'); setTab('settings'); return; }
    setAgent(j.agent); flash(true, status === 'active' ? 'Your agent is running.' : 'Paused.');
  }
  async function runNow() {
    setBusy('run'); setMsg(null); const { ok, j } = await api(`/${id}/run`, 'POST', { count }); setBusy('');
    if (!ok) { flash(false, j.error || 'Could not write articles.'); return; }
    flash(true, `${j.created.length} article${j.created.length === 1 ? '' : 's'} written${j.notice ? `. ${j.notice}` : '.'}`); await load();
  }
  async function postAction(p: Post, action: string, extra: Record<string, unknown> = {}) {
    setBusy(p.id); const { ok, j } = await api(`/${id}/posts/${p.id}`, 'PATCH', { action, ...extra }); setBusy('');
    if (!ok) { flash(false, j.error || 'That did not work.'); return; }
    if (action === 'publish') { const bad = (j.pushed ?? []).filter((x: { ok: boolean }) => !x.ok); flash(bad.length === 0, bad.length ? `Published here, but: ${bad.map((x: { dest: string; detail: string }) => `${x.dest}: ${x.detail}`).join('; ')}` : 'Published.'); }
    setEdit(null); await load();
  }
  async function test(dest: 'wordpress' | 'webhook' | 'crm') {
    if (dirty && !(await save(pw ? { secrets: { wpPassword: pw } } : {}))) return;
    setBusy('t' + dest); const { j } = await api(`/${id}/test`, 'POST', { dest }); setBusy(''); flash(!!j.ok, j.detail || j.error || 'No answer.');
  }
  async function telegram(action: 'connect' | 'disconnect') {
    if (!(await save(tg ? { secrets: { telegramToken: tg } } : {}))) return;
    setBusy('tg'); const { j } = await api(`/${id}/telegram`, 'POST', { action }); setBusy(''); flash(!!j.ok, j.detail || j.error || 'No answer.'); await load();
  }
  async function remove() { if (!confirm(`Delete "${agent!.name}"? Its articles and conversations are deleted too.`)) return; await api(`/${id}`, 'DELETE'); router.push('/client-acquisition/agents'); }

  const v = cfg as VisibilityConfig, a = cfg as AssistantConfig;
  const setDest = (p: Partial<VisibilityConfig['destinations']>) => { setCfg({ ...v, destinations: { ...v.destinations, ...p } }); setDirty(true); };
  const issues = configIssues(agent.kind, cfg);
  const tabs: Array<['work' | 'try' | 'settings' | 'deploy', string]> = [['work', vis ? `Articles (${agent.counts.posts ?? 0} live, ${agent.counts.drafts ?? 0} waiting)` : `Conversations (${agent.counts.chats ?? 0}, ${agent.counts.leads ?? 0} leads${agent.counts.handoffs ? `, ${agent.counts.handoffs} need a person` : ''})`], ['try', 'Try it'], ['settings', 'Settings'], ['deploy', 'Deploy']];

  return (
    <div className="acq-stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', paddingTop: 4 }}>
        <div style={{ minWidth: 0 }}>
          <Link className="acq-link" href="/client-acquisition/agents">← AI Agents</Link>
          <h1 className="acq-page-title" style={{ marginTop: 4 }}>{agent.name} <Pill label={STATUS_PILL[agent.status] ?? agent.status} /></h1>
          <p className="acq-sub" style={{ marginTop: 2 }}>{tplInfo.label} · {tplInfo.tagline}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {agent.status === 'active'
            ? <button className="acq-btn" disabled={!!busy} onClick={() => void setStatus('paused')}><Pause size={15} /> Pause</button>
            : <button className="acq-btn acq-btn-primary" disabled={!!busy} onClick={() => void setStatus('active')}>{busy === 'status' ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Switch on</button>}
          <button className="acq-btn" onClick={() => void remove()} aria-label="Delete agent"><Trash2 size={15} /></button>
        </div>
      </div>
      {agent.status !== 'active' && issues.length > 0 && <p className="acq-notice" style={{ fontSize: 13.5 }}>Before you switch it on: {issues[0]}</p>}
      {msg && <p role="status" className="acq-notice" style={{ fontSize: 13.5, color: msg.ok ? '#166534' : '#b91c1c' }}>{msg.t}</p>}

      <div className="acq-seg" role="tablist" aria-label="Agent sections" style={{ justifySelf: 'start', flexWrap: 'wrap' }}>
        {tabs.map(([t, l]) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{l}</button>)}
      </div>

      {tab === 'work' && vis && (
        <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="acq-select" aria-label="How many articles" style={{ width: 'auto', height: 40 }} value={count} onChange={(e) => setCount(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n} article{n > 1 ? 's' : ''}</option>)}</select>
            <button className="acq-btn acq-btn-primary" style={{ height: 40 }} disabled={!!busy} onClick={() => void runNow()}>{busy === 'run' ? <Loader2 size={15} className="animate-spin" /> : null} Write articles now</button>
            <span className="acq-faint" style={{ fontSize: 12.5 }}>{agent.status === 'active' && agent.nextRunAt ? `Next automatic run: ${new Date(agent.nextRunAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}` : 'Switch the agent on to write on a schedule.'}</span>
          </div>
          {posts.length === 0 && <p className="acq-sub">No articles yet. Write the first ones now.</p>}
          <div style={{ display: 'grid', gap: 10 }}>
            {posts.map((p) => (
              <article key={p.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 15 }}>{p.title}</b>
                  <span style={{ display: 'flex', gap: 6 }}><Pill label={p.status === 'published' ? 'Active' : 'Needs follow-up'} tone={p.status === 'published' ? undefined : 'acq-pill-amber'} /><span className="acq-faint" style={{ fontSize: 12, alignSelf: 'center' }}>{p.status === 'published' ? 'Published' : 'Waiting for you'}</span></span>
                </div>
                <p className="acq-sub" style={{ fontSize: 13.5 }}>{p.summary}</p>
                <p className="acq-faint" style={{ fontSize: 12 }}>{p.source === 'ai' ? 'Written by AI' : p.source === 'manual' ? 'Edited by you' : 'Written from the built-in template: read and edit it before publishing'}</p>
                {p.pushed?.map((x, i) => <p key={i} style={{ fontSize: 12.5, color: x.ok ? '#166534' : '#b91c1c' }}>{x.dest === 'wordpress' ? 'WordPress' : 'Webhook'}: {x.detail}</p>)}
                {open === p.id && !edit && <div className="rvx-preview" style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, fontSize: 14.5, lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: p.body }} />}
                {edit?.id === p.id && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <input className="acq-input" aria-label="Article title" value={edit.title} maxLength={190} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                    <textarea className="acq-textarea" aria-label="Article summary" rows={2} value={edit.summary} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} />
                    <textarea className="acq-textarea" aria-label="Article text (HTML)" rows={12} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
                    <div style={{ display: 'flex', gap: 8 }}><button className="acq-btn acq-btn-primary" disabled={busy === p.id} onClick={() => void postAction(p, 'edit', { title: edit.title, summary: edit.summary, body: edit.body })}>Save changes</button><button className="acq-btn" onClick={() => setEdit(null)}>Cancel</button></div>
                  </div>
                )}
                {edit?.id !== p.id && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="acq-btn acq-btn-sm" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? 'Hide' : 'Read'}</button>
                    <button className="acq-btn acq-btn-sm" onClick={() => { setOpen(p.id); setEdit({ id: p.id, title: p.title, summary: p.summary, body: p.body }); }}>Edit</button>
                    {p.status !== 'published' ? <button className="acq-btn acq-btn-sm acq-btn-primary" disabled={busy === p.id} onClick={() => void postAction(p, 'publish')}>Publish</button> : <button className="acq-btn acq-btn-sm" disabled={busy === p.id} onClick={() => void postAction(p, 'unpublish')}>Take down</button>}
                    {p.status !== 'published' && <button className="acq-btn acq-btn-sm" disabled={busy === p.id} onClick={() => void postAction(p, 'reject')}>Discard</button>}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'work' && !vis && (
        <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 12 }}>
          {chats.length === 0 && <p className="acq-sub">No conversations yet. Once the assistant is switched on and deployed, visitors who chat appear here, and leads are emailed to you.</p>}
          {chats.map((c) => (
            <article key={c.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <b>{c.visitor?.name || c.visitor?.email || c.visitor?.phone || 'Anonymous visitor'}{c.visitor?.company ? ` · ${c.visitor.company}` : ''}</b>
                <span style={{ display: 'flex', gap: 6 }}><Pill label={c.status === 'handoff' ? 'Needs a person' : c.status === 'lead' ? 'Interested' : 'Idle'} tone={c.status === 'handoff' ? 'acq-pill-amber' : undefined} /><span className="acq-faint" style={{ fontSize: 12 }}>{c.channel === 'telegram' ? 'Telegram' : 'Website'} · {new Date(c.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span></span>
              </div>
              {(c.visitor?.email || c.visitor?.phone) && <p style={{ fontSize: 13.5 }}>{[c.visitor.email, c.visitor.phone].filter(Boolean).join(' · ')}</p>}
              {c.visitor?.need && <p className="acq-sub" style={{ fontSize: 13.5 }}>Looking for: {c.visitor.need}</p>}
              {c.visitor?.order && <p className="acq-sub" style={{ fontSize: 13.5 }}>Order number: {c.visitor.order}</p>}
              <button className="acq-link" style={{ justifySelf: 'start' }} onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Hide' : 'Read'} the conversation</button>
              {open === c.id && <div style={{ display: 'grid', gap: 4, fontSize: 13.5 }}>{c.messages.slice(-30).map((m, i) => <p key={i}><b>{m.r === 'v' ? 'Visitor' : 'Assistant'}:</b> {m.t}</p>)}</div>}
            </article>
          ))}
        </section>
      )}

      {tab === 'try' && <div style={{ maxWidth: 860 }}><AgentPreview kind={agent.kind} cfg={cfg} />{dirty && <p className="acq-faint" style={{ fontSize: 12.5, marginTop: 8 }}>You have unsaved changes in Settings. This preview uses them.</p>}</div>}

      {tab === 'settings' && (
        <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 16, maxWidth: 860 }}>
          <div><label className="acq-label" htmlFor="am-name">Agent name</label><input id="am-name" className="acq-input" maxLength={120} value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} /></div>
          <AgentForm kind={agent.kind} cfg={cfg} onChange={(c) => { setCfg(c); setDirty(true); }} />
          <div><button className="acq-btn acq-btn-primary" disabled={!dirty || !!busy} onClick={() => void save()}>{busy === 'save' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save settings</button></div>
        </section>
      )}

      {tab === 'deploy' && vis && (
        <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 20, maxWidth: 860 }}>
          <p className="acq-notice" style={{ fontSize: 13.5 }}>Articles reach the places below only once they are published. {agent.status !== 'active' && <b>Switch the agent on first: public links stay off while it is paused.</b>}</p>
          <div style={{ display: 'grid', gap: 10 }}>
            <h3 className="acq-title">Your own website (any platform)</h3>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={v.destinations.embed} onChange={(e) => setDest({ embed: e.target.checked })} /> Allow the website embed</label>
            <CopyBox label="Paste this where the articles should appear" text={agent.deploy.embed} />
            <p className="acq-faint" style={{ fontSize: 12.5 }}>Works on Wix, Squarespace, Shopify, Webflow, Framer and plain HTML: use an &quot;Embed / Custom code / HTML&quot; block. The articles appear on your page for visitors and search engines that run scripts. For the strongest search benefit, publish them as real pages on your own site with WordPress or the RSS feed below.</p>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <h3 className="acq-title">Hosted page and RSS</h3>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={v.destinations.hosted} onChange={(e) => setDest({ hosted: e.target.checked })} /> A page on RUNVAX with all your articles</label>
            {v.destinations.hosted && <CopyBox label="Hosted page" text={agent.deploy.hosted} />}
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={v.destinations.rss} onChange={(e) => setDest({ rss: e.target.checked })} /> RSS feed (full text)</label>
            {v.destinations.rss && <CopyBox label="RSS feed" text={agent.deploy.rss ?? ""} />}
            <p className="acq-faint" style={{ fontSize: 12.5 }}>Zapier, Make, Webflow CMS, Mailchimp and most newsletter and CMS tools can read an RSS feed and turn each article into a post.</p>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <h3 className="acq-title">WordPress</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div><label className="acq-label" htmlFor="wp-site">Site address</label><input id="wp-site" className="acq-input" placeholder="https://yourblog.com" value={v.destinations.wordpress?.siteUrl ?? ''} onChange={(e) => setDest({ wordpress: { siteUrl: e.target.value, username: v.destinations.wordpress?.username ?? '', status: v.destinations.wordpress?.status ?? 'draft' } })} /></div>
              <div><label className="acq-label" htmlFor="wp-user">WordPress username</label><input id="wp-user" className="acq-input" autoComplete="off" value={v.destinations.wordpress?.username ?? ''} onChange={(e) => setDest({ wordpress: { siteUrl: v.destinations.wordpress?.siteUrl ?? '', username: e.target.value, status: v.destinations.wordpress?.status ?? 'draft' } })} /></div>
              <div><label className="acq-label" htmlFor="wp-pw">Application password {agent.secrets.wpPassword && <span className="acq-faint">(saved; type to replace)</span>}</label><input id="wp-pw" className="acq-input" type="password" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setDirty(true); }} /></div>
              <div><label className="acq-label" htmlFor="wp-st">Send articles as</label><select id="wp-st" className="acq-select" value={v.destinations.wordpress?.status ?? 'draft'} onChange={(e) => setDest({ wordpress: { siteUrl: v.destinations.wordpress?.siteUrl ?? '', username: v.destinations.wordpress?.username ?? '', status: e.target.value as 'draft' | 'publish' } })}><option value="draft">WordPress drafts (you press publish there)</option><option value="publish">Published posts</option></select></div>
            </div>
            <p className="acq-faint" style={{ fontSize: 12.5 }}>In WordPress: Users → Profile → Application Passwords → add one named RUNVAX. Use that, never your login password.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="acq-btn" disabled={!!busy} onClick={() => void save(pw ? { secrets: { wpPassword: pw } } : {})}>Save</button>
              <button className="acq-btn" disabled={!!busy} onClick={() => void test('wordpress')}>{busy === 'twordpress' ? <Loader2 size={15} className="animate-spin" /> : null} Test connection</button>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <h3 className="acq-title">Any other platform: webhook</h3>
            <div><label className="acq-label" htmlFor="wh">Send each published article to this address</label><input id="wh" className="acq-input" placeholder="https://hooks.zapier.com/..." value={v.destinations.webhookUrl} onChange={(e) => setDest({ webhookUrl: e.target.value })} /></div>
            <p className="acq-faint" style={{ fontSize: 12.5 }}>We POST JSON ({'{ event, agent, post }'}) signed with an <code>X-Runvax-Signature: sha256=…</code> header (HMAC of the body with your signing secret). Zapier, Make, n8n or your own server can verify it. {agent.secrets.webhookSecret ? 'A signing secret is set.' : ''}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="acq-btn" disabled={!!busy} onClick={() => void save()}>Save</button>
              <button className="acq-btn" disabled={!!busy} onClick={() => void test('webhook')}>{busy === 'twebhook' ? <Loader2 size={15} className="animate-spin" /> : null} Send a test</button>
            </div>
          </div>
        </section>
      )}

      {tab === 'deploy' && !vis && (
        <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 20, maxWidth: 860 }}>
          <p className="acq-notice" style={{ fontSize: 13.5 }}>The agent only answers once it is switched on. {agent.status !== 'active' && <b>It is not on yet.</b>}</p>
          <div style={{ display: 'grid', gap: 10 }}>
            <h3 className="acq-title">Website chat</h3>
            <CopyBox label="Paste before the closing </body> tag of your site" text={agent.deploy.embed} />
            <CopyBox label="Or share this page" text={agent.deploy.hosted} />
            <p className="acq-faint" style={{ fontSize: 12.5 }}>Change the colour with <code>data-color=&quot;#0ea5e9&quot;</code>, or put it on the left with <code>data-position=&quot;left&quot;</code>.</p>
            {a.accessCode && <p className="acq-notice" style={{ fontSize: 13 }}>Staff only: people must type your access code before they can chat. Put the widget on your intranet or share the page link with your team.</p>}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <h3 className="acq-title">WordPress</h3>
            <ol className="acq-sub" style={{ fontSize: 13.5, paddingLeft: 18, display: 'grid', gap: 2 }}><li>Install a header/footer code plugin (for example WPCode), or use your theme&apos;s &quot;footer scripts&quot; setting.</li><li>Paste the code above into the footer and save.</li><li>Open your site: the chat bubble appears bottom right.</li></ol>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <h3 className="acq-title">Shopify</h3>
            <ol className="acq-sub" style={{ fontSize: 13.5, paddingLeft: 18, display: 'grid', gap: 2 }}><li>Online Store → Themes → ⋯ → Edit code.</li><li>Open <code>layout/theme.liquid</code> and paste the code just before <code>&lt;/body&gt;</code>.</li><li>Save, then open your store to see the chat bubble.</li></ol>
          </div>
          <p className="acq-faint" style={{ fontSize: 12.5 }}>Wix, Squarespace, Webflow and plain HTML: use the &quot;custom code&quot; or footer-script setting and paste the same code.</p>
          {a.skills.includes('crm') && (
            <div style={{ display: 'grid', gap: 10 }}>
              <h3 className="acq-title">CRM webhook</h3>
              <p className="acq-sub" style={{ fontSize: 13.5 }}>{a.crmWebhookUrl ? <>New leads go to <code>{a.crmWebhookUrl}</code>, signed with an <code>X-Runvax-Signature: sha256=…</code> header.</> : 'Add the webhook address in Settings → Skills and tools.'}</p>
              <div><button className="acq-btn" disabled={!!busy || !a.crmWebhookUrl} onClick={() => void test('crm')}>{busy === 'tcrm' ? <Loader2 size={15} className="animate-spin" /> : null} Send a test lead</button></div>
            </div>
          )}
          {!a.accessCode && <div style={{ display: 'grid', gap: 10 }}>
            <h3 className="acq-title">Telegram bot</h3>
            <ol className="acq-sub" style={{ fontSize: 13.5, paddingLeft: 18, display: 'grid', gap: 2 }}><li>In Telegram, open <b>@BotFather</b> and send <code>/newbot</code>.</li><li>Choose a name, then copy the token it gives you.</li><li>Paste it below and press Connect.</li></ol>
            <div><label className="acq-label" htmlFor="tg-token">Bot token {agent.secrets.telegramToken && <span className="acq-faint">(saved; type to replace)</span>}</label><input id="tg-token" className="acq-input" type="password" autoComplete="new-password" placeholder="123456789:ABC..." value={tg} onChange={(e) => { setTg(e.target.value); setDirty(true); }} /></div>
            {a.channels.telegram && a.channels.telegramBot && <p style={{ fontSize: 13.5, color: '#166534' }}>Connected: <a href={`https://t.me/${a.channels.telegramBot}`} target="_blank" rel="noopener noreferrer" className="acq-link">@{a.channels.telegramBot} <ExternalLink size={12} /></a></p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="acq-btn acq-btn-primary" disabled={!!busy || (!tg && !agent.secrets.telegramToken)} onClick={() => void telegram('connect')}>{busy === 'tg' ? <Loader2 size={15} className="animate-spin" /> : null} Connect</button>
              {a.channels.telegram && <button className="acq-btn" disabled={!!busy} onClick={() => void telegram('disconnect')}>Disconnect</button>}
            </div>
          </div>}
        </section>
      )}
    </div>
  );
}
