'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bot, Search, Send, TrendingUp, LifeBuoy, Loader2, ChevronDown, ChevronUp, MessageCircle, Mail,
} from 'lucide-react';
import OutreachModal, { type OutreachData } from '@/components/OutreachModal';
import type { Business } from '@/types';

type AgentKey = 'research' | 'outreach' | 'seo' | 'support';

interface Draft {
  id: string;
  channel: string;
  whatsapp: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  framework: string | null;
  opportunityTitle: string | null;
  opportunityReason: string | null;
  createdAt: string;
  prospect: { id: string; businessName: string; businessData: unknown };
}

interface Activity {
  id: string;
  agentKey: AgentKey;
  action: string;
  title: string;
  detail: string | null;
  createdAt: string;
}

interface ActivityResponse {
  activities: Activity[];
  weekly: Record<AgentKey, number>;
}

const AGENTS: Array<{
  key: AgentKey; name: string; role: string; icon: React.ElementType;
  border: string; bg: string; text: string;
}> = [
  { key: 'research', name: 'Ava',  role: 'Research', icon: Search,     border: 'border-blue-500/30',   bg: 'bg-blue-500/10',   text: 'text-blue-400' },
  { key: 'outreach', name: 'Rex',  role: 'Outreach',  icon: Send,       border: 'border-green-500/30',  bg: 'bg-green-500/10',  text: 'text-green-400' },
  { key: 'seo',      name: 'Nova', role: 'SEO & Growth', icon: TrendingUp, border: 'border-orange-500/30', bg: 'bg-orange-500/10', text: 'text-orange-400' },
  { key: 'support',  name: 'Zee',  role: 'Support',   icon: LifeBuoy,   border: 'border-cyan-500/30',   bg: 'bg-cyan-500/10',   text: 'text-cyan-400' },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function ActivityRow({ activity }: { activity: Activity }) {
  const agent = AGENTS.find((a) => a.key === activity.agentKey) ?? AGENTS[0];
  const Icon = agent.icon;
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!activity.detail && activity.detail.length > 0;

  return (
    <div className={`flex gap-3 p-3.5 rounded-xl bg-gray-800/60 border-l-4 ${agent.border} border-y border-r border-white/5`}>
      <div className={`w-8 h-8 rounded-lg ${agent.bg} ${agent.text} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${agent.text}`}>{agent.name} · {agent.role}</span>
          <span className="text-[10px] text-gray-600 ml-auto flex-shrink-0">{timeAgo(activity.createdAt)}</span>
        </div>
        <p className="text-sm text-gray-200 leading-snug mt-0.5 break-words">{activity.title}</p>
        {hasDetail && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] text-gray-600 hover:text-gray-400 flex items-center gap-0.5 mt-1 transition-colors"
            >
              {expanded ? <><ChevronUp className="w-3 h-3" /> Less</> : <><ChevronDown className="w-3 h-3" /> Details</>}
            </button>
            {expanded && (
              <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap break-words">{activity.detail}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function CommandCentrePage() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [openDraft, setOpenDraft] = useState<Draft | null>(null);

  const loadDrafts = () => {
    fetch('/api/outreach-drafts').then((r) => r.json()).then((json) => {
      if (Array.isArray(json.drafts)) setDrafts(json.drafts);
    }).catch(() => { /* */ });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/agent-activity');
        if (!res.ok) throw new Error('Failed to load agent activity');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    loadDrafts();
    return () => { cancelled = true; };
  }, []);

  const dismissDraft = async (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    try {
      await fetch(`/api/outreach-drafts/${id}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' }),
      });
    } catch { /* */ }
  };

  const lastActiveFor = (key: AgentKey) =>
    data?.activities.find((a) => a.agentKey === key)?.createdAt;

  const isEmpty = !loading && !error && (data?.activities.length ?? 0) === 0 && drafts.length === 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-purple-600/15 text-purple-400 flex items-center justify-center flex-shrink-0">
          <Bot className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white leading-tight">Command Centre</h1>
          <p className="text-sm text-gray-500">What your AI team has been doing</p>
        </div>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          const count = data?.weekly[agent.key] ?? 0;
          const last = lastActiveFor(agent.key);
          return (
            <div key={agent.key} className={`rounded-2xl border ${agent.border} ${agent.bg} p-4`}>
              <div className={`w-8 h-8 rounded-lg bg-white/5 ${agent.text} flex items-center justify-center mb-2.5`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-sm font-bold text-white leading-tight">{agent.name}</p>
              <p className="text-[11px] text-gray-500 mb-2">{agent.role}</p>
              <p className={`text-lg font-black ${agent.text}`}>{count}</p>
              <p className="text-[10px] text-gray-600 uppercase tracking-wide">this week</p>
              <p className="text-[10px] text-gray-600 mt-1.5">
                {last ? `Active ${timeAgo(last)}` : 'Not active yet'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Rex's draft queue — never auto-sent, always reviewed by a human */}
      {drafts.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5">
            Ready to send · {drafts.length}
          </h2>
          <div className="space-y-2.5">
            {drafts.map((draft) => (
              <div key={draft.id} className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-800/60 border-l-4 border-green-500/30 border-y border-r border-white/5">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center flex-shrink-0">
                  {draft.channel === 'email' ? <Mail className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white leading-tight">{draft.prospect.businessName}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {draft.opportunityTitle ?? (draft.whatsapp ?? draft.emailBody ?? '').slice(0, 100)}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => setOpenDraft(draft)}
                      className="text-xs font-bold text-purple-400 hover:text-purple-300"
                    >
                      Review &amp; Send →
                    </button>
                    <button
                      onClick={() => dismissDraft(draft.id)}
                      className="text-xs font-bold text-gray-600 hover:text-gray-400"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity feed */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading activity…
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-16 text-red-400 text-sm">{error}</div>
      )}

      {isEmpty && (
        <div className="text-center py-16 bg-gray-800/40 border border-white/8 rounded-2xl px-6">
          <Bot className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-300 font-semibold mb-1">Your agents haven&apos;t run yet</p>
          <p className="text-sm text-gray-500 mb-4">
            Search for prospects to wake Ava, or send your first message to activate Rex.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/" className="text-sm font-bold text-purple-400 hover:text-purple-300">Find prospects →</Link>
            <Link href="/pipeline" className="text-sm font-bold text-purple-400 hover:text-purple-300">Go to pipeline →</Link>
          </div>
        </div>
      )}

      {!loading && !error && (data?.activities.length ?? 0) > 0 && (
        <div className="space-y-2.5">
          {data?.activities.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} />
          ))}
        </div>
      )}

      {openDraft && (
        <OutreachModal
          business={openDraft.prospect.businessData as unknown as Business}
          draftId={openDraft.id}
          onClose={() => { setOpenDraft(null); loadDrafts(); }}
          initialData={{
            whatsapp: openDraft.whatsapp ?? '',
            emailSubject: openDraft.emailSubject ?? '',
            emailBody: openDraft.emailBody ?? '',
            framework: (openDraft.framework ?? 'PAS') as OutreachData['framework'],
          }}
        />
      )}
    </div>
  );
}
