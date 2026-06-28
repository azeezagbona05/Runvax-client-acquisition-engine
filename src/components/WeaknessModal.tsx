'use client';

import { useState } from 'react';
import { X, Loader2, RefreshCw, AlertTriangle, TrendingUp } from 'lucide-react';
import { Business } from '@/types';
import { useHandleAIResponse } from '@/context/UpgradeContext';

interface Props {
  business: Business;
  onClose: () => void;
}

interface WeaknessData {
  weaknesses: string;
  pitch: string;
  revenueImpact: string;
  metrics: Record<string, boolean> | null;
}

function MetricRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-xs py-1 ${ok ? 'text-green-400' : 'text-red-400'}`}>
      <span>{ok ? '✅' : '❌'}</span>
      <span>{label}</span>
    </div>
  );
}

export default function WeaknessModal({ business, onClose }: Props) {
  const handleAIResponse = useHandleAIResponse();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WeaknessData | null>(null);
  const [error, setError] = useState('');

  const analyse = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/weakness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business }),
      });
      const json = await res.json();
      if (handleAIResponse(res, json)) return;
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">

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

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Website badge */}
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="text-gray-500 text-xs">Current site:</span>
            <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm hover:underline truncate">
              {business.website}
            </a>
          </div>

          {!data && !loading && (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">🔍</div>
              <p className="text-gray-300 font-semibold mb-1">Scan & Analyse Website</p>
              <p className="text-gray-500 text-sm mb-6">
                Claude scans their website for SEO, mobile, speed, and UX issues — then helps you pitch a rebuild.
              </p>
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              <button
                onClick={analyse}
                className="bg-gradient-to-r from-yellow-600 to-orange-500 hover:from-yellow-500 hover:to-orange-400 text-white font-bold px-6 py-3 rounded-xl transition-all"
              >
                Run Analysis
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
              <p className="text-gray-400 text-sm">Scanning website…</p>
            </div>
          )}

          {data && (
            <div className="space-y-4">

              {/* Technical scan */}
              {data.metrics && (
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Technical Scan</h3>
                  <div className="grid grid-cols-2 gap-x-4">
                    <MetricRow label="Page Title" ok={data.metrics.hasTitle} />
                    <MetricRow label="Meta Description" ok={data.metrics.hasMeta} />
                    <MetricRow label="H1 Heading" ok={data.metrics.hasH1} />
                    <MetricRow label="Mobile Viewport" ok={data.metrics.hasViewport} />
                    <MetricRow label="WhatsApp Button" ok={data.metrics.hasWhatsApp} />
                    <MetricRow label="Phone Number" ok={data.metrics.hasPhone} />
                    <MetricRow label="Structured Data" ok={data.metrics.hasSchema} />
                  </div>
                </div>
              )}

              {/* Weaknesses */}
              <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-4">
                <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Website Weaknesses
                </h3>
                <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {data.weaknesses}
                </div>
              </div>

              {/* Revenue impact */}
              <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-4">
                <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Revenue Impact
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">{data.revenueImpact}</p>
              </div>

              {/* Pitch angle */}
              <div className="bg-green-950/30 border border-green-500/20 rounded-xl p-4">
                <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-2">
                  💬 Your Pitch Angle
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">{data.pitch}</p>
              </div>

              <button
                onClick={analyse}
                disabled={loading}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Re-analyse
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
