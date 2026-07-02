'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Loader2, RefreshCw, Printer, Copy, Check, MessageCircle } from 'lucide-react';
import { Business } from '@/types';
import { useHandleAIResponse } from '@/context/UpgradeContext';
import { estimatePrice } from '@/lib/scoring';

interface Props {
  business: Business;
  onClose: () => void;
}

export default function ProposalModal({ business, onClose }: Props) {
  const estimated = estimatePrice(business.category, business.categoryTypes);

  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState('');
  const [coverMessage, setCoverMessage] = useState('');
  const [error, setError] = useState('');
  const [yourName, setYourName] = useState('');
  const [yourPhone, setYourPhone] = useState('');
  const [yourWebsite, setYourWebsite] = useState('');
  const [priceFrom, setPriceFrom] = useState('₦' + estimated.min.toLocaleString('en-NG'));
  const [priceTo, setPriceTo] = useState('₦' + estimated.max.toLocaleString('en-NG'));
  const [timeline, setTimeline] = useState('7–8 business days');
  const [copied, setCopied] = useState(false);
  const [coverCopied, setCoverCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const handleAIResponse = useHandleAIResponse();

  // Pre-fill from saved profile settings
  useEffect(() => {
    fetch('/api/user/settings')
      .then((r) => r.json())
      .then((s: { businessName?: string; senderName?: string; whatsapp?: string; website?: string }) => {
        if (s.businessName || s.senderName) setYourName(s.businessName ?? s.senderName ?? '');
        if (s.whatsapp) setYourPhone(s.whatsapp);
        if (s.website) setYourWebsite(s.website);
      })
      .catch(() => {});
  }, []);

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business, yourName, yourPhone, yourWebsite, priceFrom, priceTo, timeline }),
      });
      const json = await res.json();
      if (handleAIResponse(res, json)) return;
      if (!res.ok) throw new Error(json.error || 'Failed');
      setProposal(json.proposal);
      setCoverMessage(json.coverMessage ?? '');
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
    win.document.write(`
      <html><head><title>Proposal — ${business.name}</title>
      <style>
        body { font-family: Georgia, serif; max-width: 760px; margin: 40px auto; color: #1a1a1a; line-height: 1.6; }
        h1 { color: #4f2d8a; font-size: 24px; border-bottom: 3px solid #f97316; padding-bottom: 10px; }
        h2 { color: #4f2d8a; font-size: 16px; margin-top: 24px; }
        h3 { font-size: 14px; color: #333; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th { background: #f3f0ff; color: #4f2d8a; padding: 8px 12px; text-align: left; }
        td { padding: 8px 12px; border-bottom: 1px solid #eee; }
        strong { color: #4f2d8a; }
        hr { border: none; border-top: 2px solid #f97316; margin: 20px 0; }
        ul, ol { margin: 8px 0; padding-left: 20px; }
        li { margin-bottom: 4px; }
        @media print { body { margin: 20px; } }
      </style></head>
      <body>${renderMarkdown(proposal)}</body></html>`);
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

              {/* Row 3: Price From + Price To */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1">Price From</label>
                  <input
                    type="text"
                    value={priceFrom}
                    onChange={(e) => setPriceFrom(e.target.value)}
                    placeholder="e.g. ₦150,000"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1">Price To</label>
                  <input
                    type="text"
                    value={priceTo}
                    onChange={(e) => setPriceTo(e.target.value)}
                    placeholder="e.g. ₦400,000"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              {/* Row 4: Timeline */}
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
          <div className="flex gap-2 p-5 border-t border-white/10 flex-shrink-0">
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
              <Printer className="w-4 h-4" /> Print / Save PDF
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
