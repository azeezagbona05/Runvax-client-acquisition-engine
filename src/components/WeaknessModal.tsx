'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, RefreshCw, AlertTriangle, TrendingUp, Gauge, CheckCircle2, Circle } from 'lucide-react';
import { Business, PsiDetails } from '@/types';
import { useHandleAIResponse } from '@/context/UpgradeContext';

interface Props {
  business: Business;
  psiDetails?: PsiDetails | null;
  psiScreenshot?: string | null;
  onClose: () => void;
}

interface WeaknessData {
  weaknesses: string;
  pitch: string;
  revenueImpact: string;
  metrics: Record<string, boolean> | null;
}

const SCAN_STEPS = [
  { icon: '🌐', label: 'Connecting to website' },
  { icon: '📱', label: 'Checking mobile compatibility' },
  { icon: '⚡', label: 'Measuring load speed' },
  { icon: '🔍', label: 'Scanning SEO signals' },
  { icon: '🔗', label: 'Checking contact elements' },
  { icon: '📊', label: 'Processing PageSpeed data' },
  { icon: '✍️', label: 'Writing weakness report' },
];

function MetricRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-xs py-1 ${ok ? 'text-green-400' : 'text-red-400'}`}>
      <span>{ok ? '✅' : '❌'}</span>
      <span>{label}</span>
    </div>
  );
}

function ScoreBadge({ label, score }: { label: string; score: number }) {
  const color = score >= 90 ? 'text-green-400 bg-green-500/15 border-green-500/25'
              : score >= 50 ? 'text-yellow-400 bg-yellow-500/15 border-yellow-500/25'
              :               'text-red-400 bg-red-500/15 border-red-500/25';
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-xl border ${color}`}>
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">{label}</span>
      <span className="text-xl font-black">{score}</span>
    </div>
  );
}

// Render AI text: parse **bold** markers and numbered list items
function WeaknessText({ text }: { text: string }) {
  const items = text.split(/\n(?=\d+\.)/).map(s => s.trim()).filter(Boolean);

  function parseBold(str: string) {
    const parts = str.split(/\*\*([^*]+)\*\*/);
    return parts.map((part, i) =>
      i % 2 === 1
        ? <strong key={i} className="text-white font-semibold">{part}</strong>
        : <span key={i}>{part}</span>
    );
  }

  if (items.length > 1) {
    return (
      <ol className="space-y-3 list-none">
        {items.map((item, i) => {
          const body = item.replace(/^\d+\.\s*/, '');
          return (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="text-red-400 font-bold flex-shrink-0 mt-0.5">{i + 1}.</span>
              <span className="text-gray-300">{parseBold(body)}</span>
            </li>
          );
        })}
      </ol>
    );
  }
  return <p className="text-gray-300 text-sm leading-relaxed">{parseBold(text)}</p>;
}

function PlainText({ text }: { text: string }) {
  const parts = text.split(/\*\*([^*]+)\*\*/);
  return (
    <p className="text-gray-300 text-sm leading-relaxed">
      {parts.map((part, i) =>
        i % 2 === 1
          ? <strong key={i} className="text-white font-semibold">{part}</strong>
          : <span key={i}>{part}</span>
      )}
    </p>
  );
}

export default function WeaknessModal({ business, psiDetails, psiScreenshot, onClose }: Props) {
  const handleAIResponse = useHandleAIResponse();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WeaknessData | null>(null);
  const [error, setError] = useState('');
  const [scanStep, setScanStep] = useState(-1);

  useEffect(() => {
    if (!loading) { setScanStep(-1); return; }
    setScanStep(0);
    // Steps 0-5 advance on a slow timer that spans ~14s.
    // Step 6 ("Writing weakness report") stays active and spinning
    // until the actual API call finishes and loading flips to false.
    const timings = [2400, 5000, 7600, 10200, 12400, 14600];
    const ids = timings.map((t, i) => setTimeout(() => setScanStep(i + 1), t));
    return () => ids.forEach(clearTimeout);
  }, [loading]);

  const analyse = async () => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fetch('/api/weakness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business, psiData: psiDetails ?? undefined }),
      });
      let json: Record<string, unknown> = {};
      try { json = await res.json(); } catch { /* empty body */ }
      if (handleAIResponse(res, json)) return;
      if (!res.ok) throw new Error((json.error as string) || `Server error ${res.status}`);
      if (!json.weaknesses) throw new Error('Analysis returned empty — please try again');
      setData(json as unknown as WeaknessData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className={`bg-gray-900 border border-white/10 rounded-2xl w-full flex flex-col shadow-2xl transition-all duration-300 ${
        loading ? 'max-w-3xl' : 'max-w-2xl'
      } max-h-[92vh]`}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <h2 className="font-black text-white text-lg">Website Weakness Report</h2>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{business.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── SCANNING STATE ── */}
        {loading && (
          <div className="flex flex-1 overflow-hidden min-h-0">

            {/* Left: screenshot OR browser placeholder */}
            <div className="relative w-56 flex-shrink-0 overflow-hidden bg-gray-950 border-r border-white/8">
              <style>{`
                @keyframes scan-sweep {
                  0%   { top: -6px; opacity: 0; }
                  4%   { opacity: 1; }
                  92%  { opacity: 1; }
                  100% { top: 100%; opacity: 0; }
                }
                .scan-line { animation: scan-sweep 4s cubic-bezier(0.4,0,0.6,1) infinite; }
              `}</style>

              {psiScreenshot ? (
                <img
                  src={psiScreenshot}
                  alt="Website preview"
                  className="w-full h-full object-cover object-top"
                  style={{ minHeight: '340px', maxHeight: '480px' }}
                />
              ) : (
                /* Browser-frame placeholder */
                <div className="flex flex-col h-full" style={{ minHeight: '340px' }}>
                  {/* Browser chrome */}
                  <div className="bg-gray-800 px-3 py-2 flex items-center gap-2 flex-shrink-0 border-b border-white/8">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                    </div>
                    <div className="flex-1 bg-gray-700/60 rounded px-2 py-0.5">
                      <p className="text-[9px] text-gray-400 font-mono truncate">{business.website}</p>
                    </div>
                  </div>
                  {/* Fake page content lines */}
                  <div className="flex-1 p-3 space-y-2 overflow-hidden">
                    <div className="h-4 bg-white/8 rounded w-3/4" />
                    <div className="h-3 bg-white/5 rounded w-full" />
                    <div className="h-3 bg-white/5 rounded w-5/6" />
                    <div className="h-8 bg-white/8 rounded w-full mt-3" />
                    <div className="h-3 bg-white/5 rounded w-full" />
                    <div className="h-3 bg-white/5 rounded w-4/5" />
                    <div className="h-3 bg-white/5 rounded w-full" />
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="h-16 bg-white/8 rounded" />
                      <div className="h-16 bg-white/8 rounded" />
                    </div>
                    <div className="h-3 bg-white/5 rounded w-3/4" />
                    <div className="h-3 bg-white/5 rounded w-full" />
                    <div className="h-3 bg-white/5 rounded w-2/3" />
                    <div className="h-6 bg-white/8 rounded w-1/2 mt-2" />
                    <div className="h-3 bg-white/5 rounded w-full" />
                    <div className="h-3 bg-white/5 rounded w-5/6" />
                  </div>
                </div>
              )}

              {/* Green overlay tint */}
              <div className="absolute inset-0 bg-gradient-to-b from-green-900/5 via-transparent to-green-900/15 pointer-events-none" />

              {/* Scan line */}
              <div className="scan-line absolute left-0 right-0 pointer-events-none" style={{
                height: '3px',
                background: 'linear-gradient(90deg, transparent 0%, #22c55e 25%, #86efac 50%, #22c55e 75%, transparent 100%)',
                boxShadow: '0 0 8px #22c55e, 0 0 20px rgba(34,197,94,0.3)',
              }} />
              {/* Glow trail */}
              <div className="scan-line absolute left-0 right-0 pointer-events-none" style={{
                height: '48px',
                marginTop: '3px',
                background: 'linear-gradient(180deg, rgba(34,197,94,0.12) 0%, transparent 100%)',
              }} />

              {/* Corner brackets */}
              <div className="absolute top-10 left-2 w-4 h-4 border-t-2 border-l-2 border-green-400/50" />
              <div className="absolute top-10 right-2 w-4 h-4 border-t-2 border-r-2 border-green-400/50" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-green-400/50" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-green-400/50" />
            </div>

            {/* Right: step checklist */}
            <div className="flex-1 flex flex-col justify-center p-6 gap-0">
              <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-5 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Scanning in progress
              </p>
              <div className="space-y-3.5">
                {SCAN_STEPS.map((step, i) => {
                  const done   = i < scanStep;
                  const active = i === scanStep;
                  return (
                    <div key={i} className={`flex items-center gap-3 text-sm transition-all duration-400 ${
                      done ? 'text-green-400' : active ? 'text-white' : 'text-gray-700'
                    }`}>
                      {done   ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-400" />
                              : active ? <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin text-yellow-400" />
                              : <Circle className="w-4 h-4 flex-shrink-0" />}
                      <span className={active ? 'font-semibold' : ''}>{step.icon} {step.label}</span>
                      {active && <span className="ml-auto text-[10px] text-yellow-400 animate-pulse font-mono">…</span>}
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-600 mt-6 leading-relaxed">
                Analysing {business.name}&apos;s website using Google data + AI. This usually takes 10–20 seconds.
              </p>
            </div>
          </div>
        )}

        {/* ── IDLE / RESULTS STATE ── */}
        {!loading && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Website badge */}
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-2">
              <span className="text-gray-500 text-xs flex-shrink-0">Current site:</span>
              <a href={business.website} target="_blank" rel="noopener noreferrer"
                className="text-blue-400 text-sm hover:underline truncate">{business.website}</a>
            </div>

            {/* PSI scorecard */}
            {psiDetails && (
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5" /> PageSpeed Insights (Mobile)
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  <ScoreBadge label="Perf" score={psiDetails.categories.performance} />
                  <ScoreBadge label="Access." score={psiDetails.categories.accessibility} />
                  <ScoreBadge label="Practices" score={psiDetails.categories.bestPractices} />
                  <ScoreBadge label="SEO" score={psiDetails.categories.seo} />
                </div>
                {psiDetails.opportunities.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1.5">Speed Opportunities</p>
                    <div className="space-y-1">
                      {psiDetails.opportunities.map((o) => (
                        <div key={o.id} className="flex items-start justify-between gap-2 text-xs">
                          <span className="text-gray-400 leading-snug">{o.title}</span>
                          {o.savings && <span className="text-orange-400 font-mono whitespace-nowrap flex-shrink-0">{o.savings}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {psiDetails.failedAudits.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1.5">Failed Checks</p>
                    <div className="flex flex-wrap gap-1.5">
                      {psiDetails.failedAudits.map((a) => (
                        <span key={a.id} className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
                          {a.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-gray-600">{psiDetails.passedCount} audits passed</p>
              </div>
            )}

            {/* Idle prompt */}
            {!data && (
              <div className="text-center py-8">
                <div className="text-5xl mb-3">🔍</div>
                <p className="text-gray-300 font-semibold mb-1">Scan &amp; Analyse Website</p>
                <p className="text-gray-500 text-sm mb-6">
                  Claude scans their website for SEO, mobile, speed, and UX issues — then helps you pitch a rebuild.
                  {psiDetails && ' PSI scores are included in the analysis.'}
                </p>
                {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
                <button onClick={analyse}
                  className="bg-gradient-to-r from-yellow-600 to-orange-500 hover:from-yellow-500 hover:to-orange-400 text-white font-bold px-6 py-3 rounded-xl transition-all">
                  Run Analysis
                </button>
              </div>
            )}

            {/* Results */}
            {data && (
              <div className="space-y-4">

                {/* Premium scan-complete screenshot panel */}
                {psiScreenshot && (
                  <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                    {/* Browser chrome */}
                    <div className="bg-gray-800 px-4 py-2.5 flex items-center gap-3 border-b border-white/8">
                      <div className="flex gap-1.5 flex-shrink-0">
                        <div className="w-3 h-3 rounded-full bg-red-500/70" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                        <div className="w-3 h-3 rounded-full bg-green-500/70" />
                      </div>
                      <div className="flex-1 bg-gray-700/70 rounded-md px-3 py-1 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border border-green-400/50 flex-shrink-0" />
                        <span className="text-[11px] text-gray-300 font-mono truncate">{business.website}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <span className="text-[11px] font-bold text-green-400">Scanned</span>
                      </div>
                    </div>
                    {/* Screenshot */}
                    <div className="relative">
                      <img
                        src={psiScreenshot}
                        alt={`${business.name} website`}
                        className="w-full object-cover object-top"
                        style={{ maxHeight: '320px' }}
                      />
                      {/* Subtle gradient fade at bottom */}
                      <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-gray-900 to-transparent" />
                      {/* Issue count badge */}
                      {data.metrics && (
                        <div className="absolute bottom-3 left-3 flex items-center gap-2">
                          <span className="bg-red-500/90 backdrop-blur text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                            {Object.values(data.metrics).filter(v => !v).length} issues found
                          </span>
                          {psiDetails && (
                            <span className={`backdrop-blur text-[11px] font-bold px-2.5 py-1 rounded-full ${
                              psiDetails.categories.performance < 50
                                ? 'bg-red-500/90 text-white'
                                : psiDetails.categories.performance < 90
                                ? 'bg-yellow-500/90 text-black'
                                : 'bg-green-500/90 text-black'
                            }`}>
                              {psiDetails.categories.performance < 50 ? '🐌' : psiDetails.categories.performance < 90 ? '🐢' : '⚡'} {psiDetails.categories.performance}/100 speed
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Technical scan */}
                {data.metrics && (
                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Technical Scan</h3>
                    <div className="grid grid-cols-2 gap-x-4">
                      <MetricRow label="Page Title"       ok={data.metrics.hasTitle} />
                      <MetricRow label="Meta Description" ok={data.metrics.hasMeta} />
                      <MetricRow label="H1 Heading"       ok={data.metrics.hasH1} />
                      <MetricRow label="Mobile Viewport"  ok={data.metrics.hasViewport} />
                      <MetricRow label="WhatsApp Button"  ok={data.metrics.hasWhatsApp} />
                      <MetricRow label="Phone Number"     ok={data.metrics.hasPhone} />
                      <MetricRow label="Structured Data"  ok={data.metrics.hasSchema} />
                    </div>
                  </div>
                )}

                {/* Weaknesses — parsed bold markdown */}
                <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Website Weaknesses
                  </h3>
                  <WeaknessText text={data.weaknesses} />
                </div>

                {/* Revenue impact */}
                <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Revenue Impact
                  </h3>
                  <PlainText text={data.revenueImpact} />
                </div>

                {/* Pitch angle */}
                <div className="bg-green-950/30 border border-green-500/20 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-2">💬 Your Pitch Angle</h3>
                  <PlainText text={data.pitch} />
                </div>

                <button onClick={analyse} disabled={loading}
                  className="flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> Re-analyse
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
