'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

interface Ops {
  windowDays: number;
  tasks: Record<string, number>;
  tasksByType: Record<string, number>;
  failed: Array<{ id: string; type: string; attempts: number; maxAttempts: number; error: string | null; createdAt: string; user: { email: string | null } }>;
  activityByAgent: Record<string, number>;
  drafts: Record<string, number>;
  messagesSent: number;
  campaigns: Array<{ status: string; count: number; imported: number }>;
  seo: { runs: number; last: { title: string; createdAt: string } | null };
}

const AGENT_NAMES: Record<string, string> = {
  research: 'Ava · Research', outreach: 'Rex · Outreach', seo: 'Nova · SEO & Growth',
  support: 'Zee · Support', billing: 'Milo · Billing', atlas: 'Atlas · Orchestrator',
};

function Stat({ label, value, tone = 'text-white' }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="bg-gray-900 border border-white/8 rounded-xl p-4">
      <p className={`text-2xl font-black ${tone}`}>{value}</p>
      <p className="text-[11px] text-gray-500 uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}

export default function OperationsPanel() {
  const [data, setData] = useState<Ops | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/operations')
      .then(async (r) => { if (!r.ok) throw new Error('Failed to load operations'); return r.json(); })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-400 py-8 text-center">{error}</p>;
  if (!data) return <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 text-purple-400 animate-spin" /></div>;

  const t = data.tasks;
  const failed = t.failed ?? 0;

  return (
    <div className="space-y-6 py-4">
      <p className="text-xs text-gray-500">All accounts · last {data.windowDays} days</p>

      <section>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Agent task queue</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Stat label="Pending / running" value={(t.pending ?? 0) + (t.running ?? 0)} />
          <Stat label="Completed" value={t.completed ?? 0} tone="text-green-400" />
          <Stat label="Skipped" value={t.skipped ?? 0} tone="text-gray-400" />
          <Stat label="Failed" value={failed} tone={failed > 0 ? 'text-red-400' : 'text-white'} />
          <Stat label="Messages sent" value={data.messagesSent} tone="text-purple-400" />
        </div>
      </section>

      <section>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Pipeline throughput</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Pitches awaiting review" value={data.drafts.pending ?? 0} />
          <Stat label="Pitches sent" value={data.drafts.sent ?? 0} tone="text-green-400" />
          <Stat label="Pitches dismissed" value={data.drafts.dismissed ?? 0} tone="text-gray-400" />
          <Stat
            label="Active campaigns"
            value={data.campaigns.find((c) => c.status === 'active')?.count ?? 0}
          />
        </div>
      </section>

      <section>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Agent activity</h2>
        <div className="bg-gray-900 border border-white/8 rounded-xl divide-y divide-white/5">
          {Object.keys(AGENT_NAMES).map((k) => (
            <div key={k} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-gray-300">{AGENT_NAMES[k]}</span>
              <span className="font-bold text-white">{data.activityByAgent[k] ?? 0}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Failed tasks</h2>
        {data.failed.length === 0 ? (
          <p className="text-sm text-gray-500">No failures in the last {data.windowDays} days.</p>
        ) : (
          <div className="bg-gray-900 border border-white/8 rounded-xl divide-y divide-white/5">
            {data.failed.map((f) => (
              <div key={f.id} className="px-4 py-3 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="font-semibold text-gray-200">{f.type} · {f.user.email ?? 'unknown'}</span>
                  <span className="text-gray-600 flex-shrink-0">{new Date(f.createdAt).toLocaleString()} · {f.attempts}/{f.maxAttempts} tries</span>
                </div>
                {f.error && <p className="text-red-400/80 mt-1 break-words line-clamp-3">{f.error}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">SEO &amp; GEO engine</h2>
        <div className="bg-gray-900 border border-white/8 rounded-xl p-4 text-sm flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-gray-300"><b className="text-white">{data.seo.runs}</b> runs this week</span>
          {data.seo.last && <span className="text-gray-500 text-xs">Last: {data.seo.last.title} · {new Date(data.seo.last.createdAt).toLocaleDateString()}</span>}
          <span className="ml-auto flex gap-4">
            <Link href="/growth" className="text-xs font-bold text-purple-400 hover:text-purple-300">Content agents →</Link>
            <Link href="/growth/seo" className="text-xs font-bold text-purple-400 hover:text-purple-300">SEO analysis →</Link>
          </span>
        </div>
      </section>

      <p className="text-[11px] text-gray-600">
        Email and WhatsApp delivery health is not tracked here yet — sends are not recorded with a delivery status.
      </p>
    </div>
  );
}
