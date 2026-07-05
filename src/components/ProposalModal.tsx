'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Loader2, RefreshCw, Printer, Copy, Check, MessageCircle, Send } from 'lucide-react';
import { Business } from '@/types';
import { useHandleAIResponse } from '@/context/UpgradeContext';
import { useProspects } from '@/context/ProspectsContext';
import { estimatePrice, } from '@/lib/scoring';
import { formatPrice } from '@/lib/rateCard';
import type { WebsitePackage } from '@/lib/rateCard';

interface Props {
  business: Business;
  onClose: () => void;
}

export default function ProposalModal({ business, onClose }: Props) {
  const estimated = estimatePrice(business.category, business.categoryTypes);

  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState('');
  const [coverMessage, setCoverMessage] = useState('');
  const [agentMeta, setAgentMeta] = useState<{ name: string; phone: string; email: string; website: string; tagline: string; city: string } | null>(null);
  const [error, setError] = useState('');
  const [yourName, setYourName] = useState('');
  const [yourPhone, setYourPhone] = useState('');
  const [yourWebsite, setYourWebsite] = useState('');
  const [priceFrom, setPriceFrom] = useState('₦' + estimated.min.toLocaleString('en-NG'));
  const [priceTo, setPriceTo] = useState('₦' + estimated.max.toLocaleString('en-NG'));
  const [timeline, setTimeline] = useState('7–8 business days');
  const [copied, setCopied] = useState(false);
  const [coverCopied, setCoverCopied] = useState(false);
  const [prospectEmail, setProspectEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [packages, setPackages] = useState<WebsitePackage[]>([]);
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const handleAIResponse = useHandleAIResponse();
  const { addConversationEntry } = useProspects();

  // Pre-fill from saved profile settings + load rate card packages
  useEffect(() => {
    fetch('/api/user/settings')
      .then((r) => r.json())
      .then((s: { businessName?: string; senderName?: string; whatsapp?: string; website?: string; rateCard?: { packages?: WebsitePackage[] } }) => {
        if (s.businessName || s.senderName) setYourName(s.businessName ?? s.senderName ?? '');
        if (s.whatsapp) setYourPhone(s.whatsapp);
        if (s.website) setYourWebsite(s.website);
        if (s.rateCard?.packages?.length) setPackages(s.rateCard.packages);
      })
      .catch(() => {});
  }, []);

  const selectPackage = (pkg: WebsitePackage) => {
    setSelectedPkgId(pkg.id);
    setPriceFrom(formatPrice(pkg.priceMin, pkg.currency));
    setPriceTo(formatPrice(pkg.priceMax, pkg.currency));
    setTimeline(pkg.timeline);
  };

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business, yourName, yourPhone, yourWebsite, priceFrom, priceTo, timeline, prospectEmail: prospectEmail.trim() || undefined }),
      });
      const json = await res.json();
      if (handleAIResponse(res, json)) return;
      if (!res.ok) throw new Error(json.error || 'Failed');
      setProposal(json.proposal);
      setCoverMessage(json.coverMessage ?? '');
      if (json.agentMeta) setAgentMeta(json.agentMeta);
      void addConversationEntry(business.id, {
        type: 'ai_response',
        channel: 'note',
        framework: 'proposal',
        content: JSON.stringify({
          proposal: json.proposal,
          coverMessage: json.coverMessage ?? '',
          priceFrom,
          priceTo,
          timeline,
        }),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(proposal); }
    catch {
      const el = document.createElement('textarea');
      el.value = proposal;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const agent = agentMeta;
    const today = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Proposal — ${business.name}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1a1a2e; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* ── TOP HEADER ── */
  .top-bar { background: linear-gradient(135deg, #4c1d95 0%, #7c3aed 60%, #f97316 100%); padding: 36px 48px 28px; color: #fff; }
  .top-bar .doc-type { font-size: 10px; letter-spacing: 4px; text-transform: uppercase; opacity: .75; margin-bottom: 8px; }
  .top-bar .client-name { font-size: 30px; font-weight: 800; line-height: 1.1; margin-bottom: 14px; }
  .top-bar .meta-row { display: flex; gap: 28px; font-size: 12px; opacity: .85; flex-wrap: wrap; }
  .top-bar .meta-row span::before { content: ''; margin-right: 6px; opacity: .6; }

  /* ── BODY ── */
  .body { max-width: 760px; margin: 0 auto; padding: 36px 48px 20px; }

  h1 { color: #4c1d95; font-size: 18px; font-weight: 800; margin-top: 28px; margin-bottom: 10px; padding-bottom: 7px; border-bottom: 2.5px solid #f97316; }
  h2 { color: #4c1d95; font-size: 15px; font-weight: 700; margin-top: 22px; margin-bottom: 8px; }
  h3 { font-size: 13px; font-weight: 700; color: #333; margin-top: 14px; margin-bottom: 6px; }
  p { font-size: 13.5px; line-height: 1.75; color: #444; margin-bottom: 10px; }
  ul, ol { padding-left: 20px; margin: 8px 0 14px; }
  li { font-size: 13.5px; line-height: 1.65; color: #444; margin-bottom: 5px; }
  strong { color: #1a1a2e; }
  em { color: #666; }
  hr { border: none; border-top: 1.5px solid #ede9fe; margin: 22px 0; }
  a { color: #7c3aed; text-decoration: none; }

  /* ── TABLES ── */
  table { width: 100%; border-collapse: collapse; margin: 14px 0 20px; font-size: 13px; border-radius: 8px; overflow: hidden; }
  thead tr { background: #4c1d95; color: #fff; }
  thead td, thead th { padding: 11px 14px; font-weight: 700; text-align: left; }
  tbody tr:nth-child(even) { background: #f5f3ff; }
  tbody tr:hover { background: #ede9fe; }
  tbody td { padding: 10px 14px; border-bottom: 1px solid #ede9fe; color: #333; }

  /* ── PRICE BADGE ── */
  .price-badge { display: inline-block; background: linear-gradient(135deg, #4c1d95, #7c3aed); color: #fff; padding: 10px 22px; border-radius: 50px; font-size: 15px; font-weight: 800; margin: 12px 0; letter-spacing: .3px; }

  /* ── GUARANTEE BOX ── */
  .guarantee { background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 0 8px 8px 0; padding: 14px 18px; margin: 18px 0; font-size: 13px; color: #166534; }
  .guarantee strong { color: #166534; }

  /* ── FOOTER ── */
  .footer { background: #1a1a2e; color: #fff; padding: 24px 48px; display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-top: 32px; }
  .footer-left .agency { font-weight: 800; font-size: 15px; margin-bottom: 6px; }
  .footer-left .contacts { font-size: 12px; line-height: 1.9; opacity: .85; }
  .footer-right { text-align: right; }
  .footer-right .tagline { font-size: 11px; opacity: .55; max-width: 180px; line-height: 1.5; }
  .footer-right .date { font-size: 11px; opacity: .4; margin-top: 6px; }

  @media print {
    body { font-size: 12px; }
    .top-bar { -webkit-print-color-adjust: exact; }
    .footer { -webkit-print-color-adjust: exact; }
    thead tr { -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>

<div class="top-bar">
  <div class="doc-type">Website Development Proposal</div>
  <div class="client-name">${business.name}</div>
  <div class="meta-row">
    <span>Prepared by ${agent?.name || yourName || ''}</span>
    <span>${today}</span>
    <span>${business.address || business.category || ''}</span>
  </div>
</div>

<div class="body">
  ${renderMarkdown(proposal)}
</div>

<div class="footer">
  <div class="footer-left">
    <div class="agency">${agent?.name || yourName || ''}</div>
    <div class="contacts">
      ${agent?.phone || yourPhone ? `📱 ${agent?.phone || yourPhone}<br>` : ''}
      ${agent?.email ? `✉️ ${agent.email}<br>` : ''}
      ${agent?.website || yourWebsite ? `🌐 ${agent?.website || yourWebsite}` : ''}
    </div>
  </div>
  <div class="footer-right">
    <div class="tagline">${agent?.tagline || ''}</div>
    <div class="date">Generated ${today}</div>
  </div>
</div>

</body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">

        <div className="flex items-center justify-between p-5 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="font-black text-white text-lg">Proposal Generator</h2>
            <p className="text-sm text-gray-500">{business.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!proposal && !loading && (
            <div className="space-y-3">

              {/* Row 1: Name + Phone */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1">Your Name / Agency</label>
                  <input
                    type="text"
                    value={yourName}
                    onChange={(e) => setYourName(e.target.value)}
                    placeholder="e.g. ProWeb Nigeria"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1">Your WhatsApp / Phone</label>
                  <input
                    type="text"
                    value={yourPhone}
                    onChange={(e) => setYourPhone(e.target.value)}
                    placeholder="e.g. +234 801 234 5678"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              {/* Row 2: Website */}
              <div>
                <label className="text-[11px] text-gray-500 font-semibold block mb-1">Your Website (optional)</label>
                <input
                  type="text"
                  value={yourWebsite}
                  onChange={(e) => setYourWebsite(e.target.value)}
                  placeholder="e.g. www.prowebnigeria.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              {/* Row 3: Package selector */}
              {packages.length > 0 && (
                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5">Select Package</label>
                  <div className={`grid gap-2 ${packages.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {packages.map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => selectPackage(pkg)}
                        className={`text-left p-2.5 rounded-xl border transition-all ${
                          selectedPkgId === pkg.id
                            ? 'border-purple-500 bg-purple-500/15 ring-1 ring-purple-500/30'
                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                        }`}
                      >
                        <div className="text-[11px] font-bold text-white leading-tight">{pkg.name}</div>
                        <div className="text-[10px] text-purple-300 mt-1">{formatPrice(pkg.priceMin, pkg.currency)} – {formatPrice(pkg.priceMax, pkg.currency)}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{pkg.timeline} · {pkg.pages}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1.5">Price and timeline auto-fill from the selected package — edit below if needed.</p>
                </div>
              )}

              {/* Row 4: Price From + Price To */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1">Price From</label>
                  <input
                    type="text"
                    value={priceFrom}
                    onChange={(e) => { setPriceFrom(e.target.value); setSelectedPkgId(null); }}
                    placeholder="e.g. ₦150,000"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1">Price To</label>
                  <input
                    type="text"
                    value={priceTo}
                    onChange={(e) => { setPriceTo(e.target.value); setSelectedPkgId(null); }}
                    placeholder="e.g. ₦400,000"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              {/* Row 5: Timeline */}
              <div>
                <label className="text-[11px] text-gray-500 font-semibold block mb-1">Delivery Timeline</label>
                <input
                  type="text"
                  value={timeline}
                  onChange={(e) => setTimeline(e.target.value)}
                  placeholder="e.g. 7–8 business days"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              {/* Prospect email — optional, sends proposal direct to client */}
              <div>
                <label className="text-[11px] text-gray-500 font-semibold block mb-1">
                  Prospect&apos;s Email <span className="text-gray-600 font-normal">(optional — sends proposal directly to client)</span>
                </label>
                <input
                  type="email"
                  value={prospectEmail}
                  onChange={(e) => setProspectEmail(e.target.value)}
                  placeholder="e.g. info@businessname.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                onClick={generate}
                className="w-full bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 text-white font-bold py-3 rounded-xl transition-all"
              >
                Generate Proposal
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <p className="text-gray-400 text-sm">Writing your proposal…</p>
            </div>
          )}

          {proposal && (
            <div className="space-y-4">
              {/* Cover message — send this first on WhatsApp */}
              {coverMessage && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" /> Send this on WhatsApp first
                  </p>
                  <div className="bg-green-950/30 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {coverMessage}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(coverMessage).catch(() => {});
                      setCoverCopied(true);
                      setTimeout(() => setCoverCopied(false), 2500);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                      coverCopied ? 'bg-green-600 text-white' : 'bg-green-600/20 hover:bg-green-600/35 text-green-400 border border-green-500/30'
                    }`}
                  >
                    {coverCopied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Cover Message</>}
                  </button>
                </div>
              )}

              {/* Full proposal */}
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Full Proposal</p>
              <div ref={contentRef} className="prose prose-invert prose-sm max-w-none">
                <div
                  className="bg-white/[0.03] border border-white/8 rounded-xl p-5 text-gray-300 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(proposal) }}
                />
              </div>
            </div>
          )}
        </div>

        {proposal && (
          <div className="border-t border-white/10 flex-shrink-0">
            {/* Send via email row */}
            <div className="flex gap-2 px-5 pt-4 pb-2">
              <div className="flex-1 flex gap-2">
                <input
                  type="email"
                  value={prospectEmail}
                  onChange={(e) => { setProspectEmail(e.target.value); setEmailSent(false); setEmailError(''); }}
                  placeholder="Prospect's email to send proposal…"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 min-w-0"
                />
                <button
                  disabled={!prospectEmail.trim() || sendingEmail || emailSent}
                  onClick={async () => {
                    if (!prospectEmail.trim()) return;
                    setSendingEmail(true); setEmailError('');
                    try {
                      const res = await fetch('/api/proposal/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          prospectEmail: prospectEmail.trim(),
                          proposal,
                          agencyName: agentMeta?.name || yourName,
                          agencyPhone: agentMeta?.phone || yourPhone,
                          agencyEmail: agentMeta?.email,
                          agencyWebsite: agentMeta?.website || yourWebsite,
                        }),
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error || 'Failed');
                      setEmailSent(true);
                      setTimeout(() => setEmailSent(false), 4000);
                    } catch (e) { setEmailError(e instanceof Error ? e.message : 'Could not send — check SMTP settings'); }
                    finally { setSendingEmail(false); }
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex-shrink-0 ${
                    emailSent ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40'
                  }`}
                >
                  {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : emailSent ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  {emailSent ? 'Sent!' : 'Send'}
                </button>
              </div>
            </div>
            {emailError && <p className="px-5 pb-2 text-red-400 text-xs">{emailError}</p>}

            {/* Main action bar */}
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={handleCopy}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                  copied ? 'bg-green-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-bold transition-colors"
              >
                <Printer className="w-4 h-4" /> Print / PDF
              </button>
              <button
                onClick={generate}
                disabled={loading}
                className="ml-auto flex items-center gap-2 px-4 py-3 bg-white/8 hover:bg-white/15 text-gray-400 rounded-xl text-sm font-semibold transition-colors border border-white/10"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Redo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function renderMarkdown(text: string): string {
  return text
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^\| (.+) \|$/gm, (line) => {
      const cells = line.split('|').filter(Boolean).map((c) => c.trim());
      return '<tr>' + cells.map((c) => `<td>${c}</td>`).join('') + '</tr>';
    })
    .replace(/(<tr>[\s\S]*?<\/tr>\n?)+/gm, (block) => `<table>${block}</table>`)
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/gm, (block) => `<ul>${block}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hpultrd])(.+)$/gm, '<p>$1</p>');
}
