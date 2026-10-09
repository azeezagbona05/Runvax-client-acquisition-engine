'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Search, Loader2, ChevronDown, ChevronUp, MessageCircle, Mail, Sparkles, Send,
  Reply, Handshake, FileText, Clock, AlertCircle, ArrowRight, CreditCard,
} from 'lucide-react';
import CampaignsPanel from '@/components/CampaignsPanel';
import OutreachModal, { type OutreachData } from '@/components/OutreachModal';
import type { Business } from '@/types';
import type { DashboardSummary, DashboardOpportunity, FollowUpItem, ActivityItem } from '@/lib/dashboardSummary';

interface Draft {
  id: string;
  channel: string;
  whatsapp: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  framework: string | null;
  opportunityTitle: string | null;
  priorContext: string[] | null;
  prospect: { id: string; businessName: string; businessData: unknown };
}

interface NextStep {
  type: 'reactivate_cold_leads' | 'scan_more_prospects' | 'follow_up_interested';
  label: string;
  detail: string;
  done: boolean;
}

interface PlanNotice {
  summary: string;
  recommendations: Array<{ type: string; label: string; detail: string; href: string }>;
}

interface OpenModal {
  business: Business;
  draft: Draft | null;
}

const CARD = 'bg-gray-800/60 border border-white/5 rounded-2xl';

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

function greeting(name?: string | null) {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const first = name?.split(' ')[0];
  return first ? `${part}, ${first}.` : `${part}.`;
}

const CONFIDENCE_STYLE: Record<DashboardOpportunity['confidence'], string> = {
  high: 'text-green-400',
  medium: 'text-yellow-500',
  low: 'text-gray-500',
};

function MetricCard({ icon: Icon, value, label, hint, tone }: {
  icon: React.ElementType; value: number; label: string; hint: string; tone: string;
}) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center ${tone}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        <span className="text-xs font-semibold text-gray-400 leading-tight">{label}</span>
      </div>
      <p className={`text-3xl font-black leading-none ${tone}`}>{value}</p>
      <p className="text-[11px] text-gray-600 mt-1.5">{hint}</p>
    </div>
  );
}

function OpportunityRow({ opp, onPitch, onDismiss }: {
  opp: DashboardOpportunity; onPitch: () => void; onDismiss: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white leading-tight truncate">{opp.name}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {opp.category}{opp.location ? ` · ${opp.location}` : ''}
          </p>
        </div>
        <span className="text-[11px] font-semibold text-gray-500 flex-shrink-0 capitalize">{opp.band} fit</span>
      </div>

      <p className="text-sm text-gray-300 mt-2.5 leading-snug">{opp.problem}</p>
      <p className="text-xs text-gray-500 mt-1.5">
        <span className="font-semibold text-gray-400">Suggested offer:</span> {opp.offer}
      </p>
      <p className="text-[11px] text-gray-600 mt-1">{opp.websiteStatus} · {opp.contact}</p>

      {open && (
        <div className="mt-3 pt-3 border-t border-white/5 text-xs text-gray-400 space-y-1.5">
          <p className="font-semibold text-gray-300">
            Why we think so{' '}
            <span className={`font-bold ${CONFIDENCE_STYLE[opp.confidence]}`}>({opp.confidence} confidence)</span>
          </p>
          {opp.evidence.length > 0 ? (
            <ul className="list-disc pl-4 space-y-0.5">
              {opp.evidence.map((e) => <li key={e}>{e}</li>)}
            </ul>
          ) : (
            <p>Based on the business category only — no specific observations yet.</p>
          )}
          <p className="text-gray-600">Estimates are inferred from public listing data, not verified with the business.</p>
        </div>
      )}

      <div className="flex items-center gap-4 mt-3">
        <button
          onClick={onPitch}
          className="text-xs font-bold px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors"
        >
          {opp.draftId ? 'Review & send pitch' : 'Write pitch'}
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-xs font-bold text-gray-500 hover:text-gray-300 flex items-center gap-0.5"
        >
          {open ? <>Hide why <ChevronUp className="w-3 h-3" /></> : <>Why this? <ChevronDown className="w-3 h-3" /></>}
        </button>
        <button onClick={onDismiss} className="text-xs font-bold text-gray-600 hover:text-gray-400 ml-auto">
          Dismiss
        </button>
      </div>
    </div>
  );
}

function FollowUpRow({ item }: { item: FollowUpItem }) {
  const tone =
    item.kind === 'reply' ? 'text-green-400 bg-green-500/10'
    : item.kind === 'overdue' ? 'text-red-400 bg-red-500/10'
    : 'text-yellow-500 bg-yellow-500/10';
  const Icon = item.kind === 'reply' ? Reply : item.kind === 'overdue' ? AlertCircle : Clock;
  return (
    <Link href="/pipeline" className="flex items-start gap-3 py-2.5 group">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${tone}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-white truncate group-hover:text-purple-400">{item.name}</span>
        <span className="block text-xs text-gray-500">{item.label}</span>
        {item.detail && <span className="block text-xs text-gray-600 line-clamp-1 mt-0.5">“{item.detail}”</span>}
      </span>
    </Link>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const Icon = item.kind === 'sent' ? Send : item.kind === 'pitch' ? FileText : Search;
  return (
    <div className="flex items-start gap-2.5 py-2">
      <Icon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
      <p className="text-xs text-gray-300 leading-snug flex-1 min-w-0 break-words">{item.title}</p>
      <span className="text-[10px] text-gray-600 flex-shrink-0">{timeAgo(item.at)}</span>
    </div>
  );
}

export default function CommandCentrePage() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [modal, setModal] = useState<OpenModal | null>(null);
  const [nextSteps, setNextSteps] = useState<NextStep[]>([]);
  const [plan, setPlan] = useState<PlanNotice | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');
  const [showActivity, setShowActivity] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/summary');
      if (!res.ok) throw new Error('Could not load your dashboard');
      setSummary(await res.json());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDrafts = useCallback(() => {
    fetch('/api/outreach-drafts').then((r) => r.json()).then((json) => {
      if (Array.isArray(json.drafts)) setDrafts(json.drafts);
    }).catch(() => { /* non-critical */ });
  }, []);

  const loadNextSteps = useCallback(() => {
    fetch('/api/atlas/brief').then((r) => r.json()).then((json) => {
      if (Array.isArray(json.recommendations)) setNextSteps(json.recommendations);
    }).catch(() => { /* non-critical */ });
  }, []);

  useEffect(() => {
    void loadSummary();
    loadDrafts();
    loadNextSteps();
    fetch('/api/billing/brief').then((r) => r.json()).then((json) => {
      if (json.recommendations?.length) setPlan(json);
    }).catch(() => { /* non-critical */ });
  }, [loadSummary, loadDrafts, loadNextSteps]);

  const refresh = () => { void loadSummary(); loadDrafts(); loadNextSteps(); };

  const runNextStep = async (type: NextStep['type']) => {
    setActing(type);
    setActionMsg('');
    try {
      const res = await fetch('/api/atlas/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const json = await res.json() as { message?: string };
      setActionMsg(json.message ?? 'Done.');
      refresh();
    } catch {
      setActionMsg('Something went wrong — try again.');
    } finally {
      setActing(null);
    }
  };

  const dismissDraft = async (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    try {
      await fetch(`/api/outreach-drafts/${id}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' }),
      });
    } catch { /* optimistic */ }
    void loadSummary();
  };

  // Dismissing an opportunity moves the prospect to "Lost" in the CRM — it is
  // reversible there — and clears any pitch that was waiting for it.
  const dismissOpportunity = async (opp: DashboardOpportunity) => {
    setSummary((s) => s && { ...s, opportunities: s.opportunities.filter((o) => o.prospectId !== opp.prospectId) });
    try {
      if (opp.draftId) await dismissDraft(opp.draftId);
      await fetch(`/api/prospects/${opp.prospectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'lost' }),
      });
    } catch { /* refresh below restores truth */ }
    refresh();
  };

  const openPitch = (opp: DashboardOpportunity) => {
    const draft = opp.draftId ? drafts.find((d) => d.id === opp.draftId) ?? null : null;
    setModal({ business: opp.business, draft });
  };

  const m = summary?.metrics;
  const opps = summary?.opportunities ?? [];
  const followUps = summary?.followUps ?? [];
  const activity = summary?.activity ?? [];
  const visibleActivity = activityExpanded ? activity : activity.slice(0, 5);

  const subline =
    !m ? 'Discover businesses, identify opportunities, and turn them into clients.'
    : m.repliesToFollowUp > 0 ? `${m.repliesToFollowUp} ${m.repliesToFollowUp === 1 ? 'business has' : 'businesses have'} replied — answer them while the conversation is warm.`
    : m.pitchesReady > 0 ? `${m.pitchesReady} ${m.pitchesReady === 1 ? 'pitch is' : 'pitches are'} ready for you to review and send.`
    : opps.length > 0 ? `Your best opportunity right now is ${opps[0].name}.`
    : 'Discover businesses, identify opportunities, and turn them into clients.';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10">

      {/* Welcome + primary action */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
            {greeting(session?.user?.name)} Let&apos;s find your next client.
          </h1>
          <p className="text-sm text-gray-500 mt-1">{subline}</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold transition-colors flex-shrink-0"
        >
          <Search className="w-4 h-4" /> Find new opportunities
        </Link>
      </div>

      {error && !loading && (
        <div className={`${CARD} p-6 text-center mb-6`} role="alert">
          <p className="text-sm text-red-400 mb-3">{error}</p>
          <button onClick={() => { setLoading(true); void loadSummary(); }} className="text-sm font-bold text-purple-400 hover:text-purple-300">
            Try again
          </button>
        </div>
      )}

      {/* Acquisition metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${CARD} h-[104px] animate-pulse`} />)
        ) : m && (
          <>
            <MetricCard icon={Sparkles} value={m.newOpportunities} label="New opportunities" hint="Qualified, saved in the last 7 days" tone="text-blue-400" />
            <MetricCard icon={FileText} value={m.pitchesReady} label="Pitches ready" hint="Drafted and waiting for your review" tone="text-green-400" />
            <MetricCard icon={Reply} value={m.repliesToFollowUp} label="Replies to follow up" hint="Prospects waiting on you" tone="text-orange-400" />
            <MetricCard icon={Handshake} value={m.dealsInProgress} label="Deals in progress" hint={`${m.clientsWon} won in the last 30 days`} tone="text-purple-400" />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">

        {/* Main column */}
        <div className="lg:col-span-2 space-y-8 min-w-0">

          <section aria-labelledby="best-opps">
            <div className="flex items-center justify-between mb-2.5">
              <h2 id="best-opps" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Your best opportunities</h2>
              <Link href="/pipeline" className="text-xs font-bold text-purple-400 hover:text-purple-300">View all →</Link>
            </div>
            {loading ? (
              <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className={`${CARD} h-36 animate-pulse`} />)}</div>
            ) : opps.length === 0 ? (
              <div className={`${CARD} p-8 text-center`}>
                <Search className="w-7 h-7 text-gray-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-300 mb-1">No opportunities waiting</p>
                <p className="text-xs text-gray-500 mb-4">Search a niche and location — businesses worth pitching will show up here, ranked.</p>
                <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-purple-400 hover:text-purple-300">
                  Find prospects <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {opps.map((opp) => (
                  <OpportunityRow
                    key={opp.prospectId}
                    opp={opp}
                    onPitch={() => openPitch(opp)}
                    onDismiss={() => void dismissOpportunity(opp)}
                  />
                ))}
              </div>
            )}
          </section>

          {drafts.length > 0 && (
            <section aria-labelledby="ready-to-send" id="outreach">
              <h2 id="ready-to-send" className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5">
                Ready to send · {drafts.length}
              </h2>
              <div className={`${CARD} divide-y divide-white/5`}>
                {drafts.map((draft) => (
                  <div key={draft.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-7 h-7 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center flex-shrink-0">
                      {draft.channel === 'email' ? <Mail className="w-3.5 h-3.5" /> : <MessageCircle className="w-3.5 h-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{draft.prospect.businessName}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {draft.opportunityTitle ?? (draft.whatsapp ?? draft.emailBody ?? '').slice(0, 100)}
                      </p>
                    </div>
                    <button
                      onClick={() => setModal({ business: draft.prospect.businessData as unknown as Business, draft })}
                      className="text-xs font-bold text-purple-400 hover:text-purple-300 flex-shrink-0"
                    >
                      Review &amp; send →
                    </button>
                    <button onClick={() => void dismissDraft(draft.id)} className="text-xs font-bold text-gray-600 hover:text-gray-400 flex-shrink-0">
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Side column */}
        <aside className="space-y-6 min-w-0">

          <section aria-labelledby="follow-ups" id="follow-ups" className={`${CARD} p-4`}>
            <h2 id="follow-ups" className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Follow-ups</h2>
            {loading ? (
              <div className="h-16 animate-pulse" />
            ) : followUps.length === 0 ? (
              <p className="text-xs text-gray-500 py-2">Nothing waiting. Replies and overdue follow-ups will appear here.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {followUps.map((f) => <FollowUpRow key={`${f.prospectId}-${f.kind}`} item={f} />)}
              </div>
            )}
          </section>

          {nextSteps.some((s) => !s.done) && (
            <section aria-labelledby="next-steps" className={`${CARD} p-4`}>
              <h2 id="next-steps" className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5">Suggested next steps</h2>
              <div className="flex flex-col gap-2">
                {nextSteps.filter((s) => !s.done).map((s) => (
                  <button
                    key={s.type}
                    onClick={() => void runNextStep(s.type)}
                    disabled={acting === s.type}
                    title={s.detail}
                    className="text-left text-xs font-bold px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-200 transition-colors flex items-center gap-1.5"
                  >
                    {acting === s.type && <Loader2 className="w-3 h-3 animate-spin" />}
                    {s.label} →
                  </button>
                ))}
              </div>
              {actionMsg && <p className="text-xs text-gray-400 mt-2.5" role="status">{actionMsg}</p>}
            </section>
          )}

          {plan && (
            <section aria-label="Plan" className={`${CARD} p-4`}>
              <div className="flex items-start gap-2.5">
                <CreditCard className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-300 leading-relaxed">{plan.summary}</p>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {plan.recommendations.map((r) => (
                      <Link key={r.type} href={r.href} title={r.detail} className="text-xs font-bold text-purple-400 hover:text-purple-300">
                        {r.label} →
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          <div id="campaigns"><CampaignsPanel /></div>

          <section aria-labelledby="recent-activity" className={`${CARD} p-4`}>
            <button
              onClick={() => setShowActivity((v) => !v)}
              aria-expanded={showActivity}
              className="w-full flex items-center justify-between"
            >
              <h2 id="recent-activity" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Recent activity</h2>
              {showActivity ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
            {showActivity && (
              activity.length === 0 ? (
                <p className="text-xs text-gray-500 mt-2">No activity yet — new prospects, pitches and replies will show here.</p>
              ) : (
                <div className="mt-2 divide-y divide-white/5">
                  {visibleActivity.map((a) => <ActivityRow key={a.id} item={a} />)}
                  {activity.length > 5 && (
                    <button
                      onClick={() => setActivityExpanded((v) => !v)}
                      className="w-full text-left text-xs font-bold text-purple-400 hover:text-purple-300 pt-2.5"
                    >
                      {activityExpanded ? 'Show less' : `Show all ${activity.length}`}
                    </button>
                  )}
                </div>
              )
            )}
          </section>
        </aside>
      </div>

      {modal && (
        <OutreachModal
          business={modal.business}
          draftId={modal.draft?.id}
          onClose={() => { setModal(null); refresh(); }}
          initialData={modal.draft ? {
            whatsapp: modal.draft.whatsapp ?? '',
            emailSubject: modal.draft.emailSubject ?? '',
            emailBody: modal.draft.emailBody ?? '',
            framework: (modal.draft.framework ?? 'PAS') as OutreachData['framework'],
            priorContext: modal.draft.priorContext ?? undefined,
          } : undefined}
        />
      )}
    </div>
  );
}
