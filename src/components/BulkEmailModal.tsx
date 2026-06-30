'use client';

import { useState, useMemo, useRef } from 'react';
import { X, Mail, Send, Loader2, Check, AlertCircle, StopCircle, Search } from 'lucide-react';
import { Business } from '@/types';
import { useProspects } from '@/context/ProspectsContext';

interface Props {
  businesses: Business[];
  onClose: () => void;
}

type SendStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';
type EmailSource = 'manual' | 'facebook' | 'instagram' | 'website' | 'google_search' | 'web_search' | 'directory' | 'nairaland' | 'jiji' | 'vconnect' | 'businesslist' | null;

interface Row {
  business: Business;
  email: string;
  emailSource: EmailSource;
  findStatus: 'idle' | 'searching' | 'found' | 'not_found';
  status: SendStatus;
  error?: string;
}

const DEFAULT_SUBJECT = 'A digital front door for {{name}}';

const DEFAULT_BODY = `Hi {{name}} team,

I came across {{name}} on Google{{reviewClause}}. People are clearly already trusting your brand — but when they search for you or ask an AI assistant for the best {{category}} in {{area}}, there's no digital home to send them to. That trust quietly slips away to a competitor who has one.

I build digital front doors — not just websites. The complete experience a customer has *before* walking in (finding you, seeing reviews, deciding to trust you), *during* (answering questions, taking bookings 24/7), and *after* (bringing them back and generating referrals).

Built for 2026: found on Google, recommended by AI assistants like ChatGPT, working for you while you sleep.

Could I share a quick example of what this could look like for {{name}}?

Warm regards,
A digital growth partner`;

function mergeField(template: string, b: Business): string {
  const reviewClause = b.reviewCount
    ? ` — where you've earned ${b.reviewCount} reviews (${b.rating ?? ''}★)`
    : '';
  const area = (b.address || 'your area').split(',').slice(-2, -1)[0]?.trim() || 'your area';
  return template
    .replace(/\{\{name\}\}/g, b.name)
    .replace(/\{\{category\}\}/g, b.category)
    .replace(/\{\{reviews\}\}/g, String(b.reviewCount ?? ''))
    .replace(/\{\{rating\}\}/g, String(b.rating ?? ''))
    .replace(/\{\{reviewClause\}\}/g, reviewClause)
    .replace(/\{\{area\}\}/g, area);
}

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SOURCE_BADGE: Record<NonNullable<EmailSource>, { label: string; color: string }> = {
  facebook:      { label: '📘 Facebook',      color: 'text-blue-400' },
  instagram:     { label: '📸 Instagram',     color: 'text-pink-400' },
  website:       { label: '🌐 Website',       color: 'text-green-400' },
  google_search: { label: '🔍 Google',        color: 'text-yellow-400' },
  web_search:    { label: '🌍 Web Search',    color: 'text-yellow-400' },
  directory:     { label: '📋 Directory',     color: 'text-purple-400' },
  nairaland:     { label: '🟢 Nairaland',     color: 'text-green-500' },
  jiji:          { label: '🛒 Jiji',          color: 'text-orange-400' },
  vconnect:      { label: '📞 VConnect',      color: 'text-cyan-400' },
  businesslist:  { label: '📋 BusinessList',  color: 'text-purple-400' },
  manual:        { label: '✏️ Manual',        color: 'text-gray-400' },
};

export default function BulkEmailModal({ businesses, onClose }: Props) {
  const { save, isSaved, markOutreachSent, updateStage, incrementToday } = useProspects();

  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [rows, setRows] = useState<Row[]>(() =>
    businesses.map((b) => ({
      business: b,
      email: b.email ?? '',
      emailSource: b.email ? 'manual' : null,
      findStatus: 'idle',
      status: 'pending' as SendStatus,
    }))
  );
  const [finding, setFinding] = useState(false);
  const [findProgress, setFindProgress] = useState(0);
  const [sending, setSending] = useState(false);
  const [throttle, setThrottle] = useState(2);
  const stopRef = useRef(false);
  const stopFindRef = useRef(false);

  const validRows = useMemo(() => rows.filter((r) => EMAIL_OK.test(r.email.trim())), [rows]);
  const sentCount = rows.filter((r) => r.status === 'sent').length;
  const failedCount = rows.filter((r) => r.status === 'failed').length;
  const foundCount = rows.filter((r) => r.findStatus === 'found').length;
  const notFoundCount = rows.filter((r) => r.findStatus === 'not_found').length;

  const setRow = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.business.id === id ? { ...r, ...patch } : r)));

  // ── Auto-discover emails using all strategies ──
  const findAllEmails = async () => {
    stopFindRef.current = false;
    setFinding(true);
    setFindProgress(0);
    const targets = rows.filter((r) => !EMAIL_OK.test(r.email.trim()));

    for (let i = 0; i < targets.length; i++) {
      if (stopFindRef.current) break;
      const r = targets[i];
      setRow(r.business.id, { findStatus: 'searching' });

      try {
        const res = await fetch('/api/enrich-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            website: r.business.website,
            name: r.business.name,
            location: r.business.address,
            phone: r.business.phone,
          }),
        });
        const json = await res.json();

        if (json.email) {
          setRow(r.business.id, {
            email: json.email,
            emailSource: json.source ?? 'manual',
            findStatus: 'found',
          });
        } else {
          setRow(r.business.id, { findStatus: 'not_found' });
        }
      } catch {
        setRow(r.business.id, { findStatus: 'not_found' });
      }

      setFindProgress(Math.round(((i + 1) / targets.length) * 100));
      await sleep(300); // small pause between requests
    }

    setFinding(false);
  };

  // ── Find email for a single row ──
  const findOne = async (r: Row) => {
    setRow(r.business.id, { findStatus: 'searching' });
    try {
      const res = await fetch('/api/enrich-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: r.business.website,
          name: r.business.name,
          location: r.business.address,
          phone: r.business.phone,
        }),
      });
      const json = await res.json();
      if (json.email) {
        setRow(r.business.id, { email: json.email, emailSource: json.source ?? 'manual', findStatus: 'found' });
      } else {
        setRow(r.business.id, { findStatus: 'not_found' });
      }
    } catch {
      setRow(r.business.id, { findStatus: 'not_found' });
    }
  };

  // ── Send campaign ──
  const sendAll = async () => {
    stopRef.current = false;
    setSending(true);
    for (const r of rows) {
      if (stopRef.current) break;
      const email = r.email.trim();
      if (!EMAIL_OK.test(email)) { setRow(r.business.id, { status: 'skipped' }); continue; }

      setRow(r.business.id, { status: 'sending' });
      try {
        const res = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            subject: mergeField(subject, r.business),
            body: mergeField(body, r.business),
            bulk: true,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed');

        setRow(r.business.id, { status: 'sent' });
        if (!isSaved(r.business.id)) save(r.business);
        markOutreachSent(r.business.id, mergeField(body, r.business), 'email');
        updateStage(r.business.id, 'contacted');
        incrementToday();
      } catch (e: unknown) {
        setRow(r.business.id, { status: 'failed', error: e instanceof Error ? e.message : 'Failed' });
      }
      await sleep(throttle * 1000);
    }
    setSending(false);
  };

  const stop = () => { stopRef.current = true; };
  const stopFind = () => { stopFindRef.current = true; setFinding(false); };

  const rowIcon = (r: Row) => {
    if (r.status === 'sent') return <Check className="w-4 h-4 text-green-400 flex-shrink-0" />;
    if (r.status === 'sending') return <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />;
    if (r.status === 'failed') return <span title={r.error}><AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" /></span>;
    if (r.status === 'skipped') return <span className="text-[10px] text-gray-600 w-4">–</span>;
    if (r.findStatus === 'searching') return <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin flex-shrink-0" />;
    if (r.findStatus === 'not_found') return <span className="text-[10px] text-red-500/70 flex-shrink-0">✗</span>;
    if (r.findStatus === 'found') return <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />;
    return <span className="w-2 h-2 rounded-full bg-gray-700 flex-shrink-0 mt-1" />;
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="font-black text-white text-lg flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-400" /> Email Blast
            </h2>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-sm text-gray-500">{rows.length} no-website businesses</span>
              {foundCount > 0 && <span className="text-xs text-green-400 font-semibold">{foundCount} emails found</span>}
              {notFoundCount > 0 && <span className="text-xs text-gray-600">{notFoundCount} not found</span>}
              {sentCount > 0 && <span className="text-xs text-blue-400 font-semibold">{sentCount} sent</span>}
              {failedCount > 0 && <span className="text-xs text-red-400">{failedCount} failed</span>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Template editor */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Message template</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9}
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-gray-200 text-sm leading-relaxed focus:outline-none focus:border-blue-500 resize-none" />
              <p className="text-[11px] text-gray-600 mt-1.5">
                Auto-filled per business:{' '}
                <code className="text-purple-400">{'{{name}}'}</code>{' '}
                <code className="text-purple-400">{'{{category}}'}</code>{' '}
                <code className="text-purple-400">{'{{area}}'}</code>{' '}
                <code className="text-purple-400">{'{{reviewClause}}'}</code>
              </p>
            </div>
          </div>

          {/* Email discovery */}
          <div className="bg-gray-800/60 border border-white/8 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-bold text-white">Auto-Discover Emails</p>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  Best results for businesses with Facebook/Instagram pages. Pure offline businesses may have no email online.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {finding ? (
                  <button onClick={stopFind}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl text-sm font-semibold transition-colors">
                    <StopCircle className="w-4 h-4" /> Stop
                  </button>
                ) : (
                  <button onClick={findAllEmails} disabled={sending}
                    className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-colors">
                    <Search className="w-4 h-4" /> Find All Emails
                  </button>
                )}
              </div>
            </div>
            {finding && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Searching…</span><span>{findProgress}%</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${findProgress}%` }} />
                </div>
              </div>
            )}
            <div className="flex items-center gap-4 text-[11px] text-gray-500 flex-wrap">
              <span className="flex items-center gap-1"><span className="text-blue-400">📘</span> Facebook About</span>
              <span className="flex items-center gap-1"><span className="text-pink-400">📸</span> Instagram bio</span>
              <span className="flex items-center gap-1"><span className="text-yellow-400">🔍</span> Google Search</span>
              <span className="flex items-center gap-1"><span className="text-purple-400">📋</span> VConnect / BusinessList</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>Delay between sends</span>
              <select value={throttle} onChange={(e) => setThrottle(Number(e.target.value))}
                className="bg-gray-800 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm">
                <option value={1}>1s (fast)</option>
                <option value={2}>2s (safe)</option>
                <option value={4}>4s (gentle)</option>
                <option value={8}>8s (very gentle)</option>
              </select>
              <span className="text-gray-600 text-xs">avoids spam flags</span>
            </div>
          </div>

          {/* Recipients table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                Recipients · {validRows.length} with email
              </p>
            </div>
            <div className="border border-white/10 rounded-xl divide-y divide-white/5 max-h-72 overflow-y-auto">
              {rows.map((r) => (
                <div key={r.business.id} className="flex items-center gap-2.5 px-3 py-2">
                  <div className="w-5 flex justify-center flex-shrink-0">{rowIcon(r)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-200 truncate font-medium leading-tight">{r.business.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-gray-600 truncate">{r.business.category}</span>
                      {r.emailSource && r.emailSource !== 'manual' && (
                        <span className={`text-[10px] font-semibold ${SOURCE_BADGE[r.emailSource].color}`}>
                          · {SOURCE_BADGE[r.emailSource].label}
                        </span>
                      )}
                      {r.business.website && (
                        <span className="text-[10px] text-blue-500/60">
                          · {r.business.website.includes('facebook') ? '📘' : r.business.website.includes('instagram') ? '📸' : '🌐'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <input
                      value={r.email}
                      onChange={(e) => setRow(r.business.id, { email: e.target.value, emailSource: 'manual', status: 'pending', findStatus: 'idle' })}
                      placeholder="email@gmail.com"
                      disabled={r.status === 'sent'}
                      className={`w-44 bg-gray-800/80 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-40 ${
                        r.email && !EMAIL_OK.test(r.email)
                          ? 'border-red-500/40 text-red-300'
                          : r.findStatus === 'found'
                          ? 'border-green-500/40 text-gray-200'
                          : 'border-white/10 text-gray-200'
                      }`}
                    />
                    {r.findStatus !== 'searching' && !EMAIL_OK.test(r.email.trim()) && (
                      <button onClick={() => findOne(r)} title="Find email for this business"
                        className="w-7 h-7 bg-white/8 hover:bg-purple-600/30 rounded-lg flex items-center justify-center transition-colors text-gray-500 hover:text-purple-400">
                        <Search className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex items-center gap-3 flex-shrink-0">
          <div className="text-sm text-gray-500">
            {sending
              ? <span className="text-blue-400 font-semibold">Sending… {sentCount}/{validRows.length}</span>
              : <span><strong className="text-white">{validRows.length}</strong> ready · <span className="text-gray-600">{rows.length - validRows.length} missing email</span></span>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {sending ? (
              <button onClick={stop}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition-colors">
                <StopCircle className="w-4 h-4" /> Stop
              </button>
            ) : (
              <button onClick={sendAll} disabled={validRows.length === 0 || finding}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-colors">
                <Send className="w-4 h-4" /> Send {validRows.length} Emails
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
