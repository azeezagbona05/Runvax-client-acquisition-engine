'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, MapPin, Phone, Globe, Star, Clock, Loader2, Sparkles,
  ExternalLink, MessageCircle, FileText, AlertTriangle,
  Bookmark, BookmarkX, TrendingUp, MessageSquare, Mail, ShieldCheck, ShieldX, ShieldQuestion,
  Copy, Check, Wand2, Lock,
} from 'lucide-react';
import { Business, PsiDetails } from '@/types';
import { useProspects } from '@/context/ProspectsContext';
import { useUpgrade } from '@/context/UpgradeContext';
import { useFeature } from '@/context/PlanFeaturesContext';
import { scoreProspect, scoreLabel, estimatePrice, formatPrice } from '@/lib/scoring';
import OutreachModal from './OutreachModal';
import ProposalModal from './ProposalModal';
import WeaknessModal from './WeaknessModal';
import ConversationPanel from './ConversationPanel';
import AITeamPanel from './AITeamPanel';
import ReplyPanel from './ReplyPanel';

// Demo-site preview is built but hidden for now — flip to true to re-enable.
// Backend (/api/demo, /demo/[slug], DemoSite model) remains in place.
const SHOW_DEMO = false;

type DrawerTab = 'details' | 'outreach' | 'conversation' | 'team' | 'reply';

type ProspectStage = 'found' | 'contacted' | 'interested' | 'proposal' | 'won' | 'lost';

const STAGES: Array<{ id: ProspectStage; icon: string; label: string; color: string }> = [
  { id: 'found',      icon: '🔵', label: 'Found',     color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { id: 'contacted',  icon: '📱', label: 'Contacted', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { id: 'interested', icon: '🤝', label: 'Interested',color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { id: 'proposal',   icon: '📄', label: 'Proposal',  color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { id: 'won',        icon: '🏆', label: 'Won',       color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  { id: 'lost',       icon: '❌', label: 'Lost',      color: 'bg-red-500/20 text-red-300 border-red-500/30' },
];

interface PsiMetrics { fcp?: string; lcp?: string; tbt?: string; cls?: string; si?: string; }

interface Props {
  business: Business;
  onClose: () => void;
  onGenerate: () => void;
  generating: boolean;
  generateError?: string | null;
  onPsiScore?: (placeId: string, score: number, desktopScore: number | null) => void;
}

export default function BusinessDrawer({ business, onClose, onGenerate, generating, generateError, onPsiScore }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragDy = useRef(0);

  const onHandleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragDy.current = 0;
  };
  const onHandleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0 && sheetRef.current) {
      dragDy.current = dy;
      sheetRef.current.style.transform = `translateY(${dy}px)`;
      sheetRef.current.style.transition = 'none';
    }
  };
  const onHandleTouchEnd = () => {
    if (dragDy.current > 120) {
      onClose();
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = '';
      sheetRef.current.style.transition = '';
    }
    dragStartY.current = null;
    dragDy.current = 0;
  };

  const { isSaved, save, remove, get, updateStage, updateNotes, setReminder, clearReminder } = useProspects();
  const { triggerUpgrade } = useUpgrade();
  const canProposal = useFeature('proposals');
  const canWeakness = useFeature('weaknessAnalysis');
  const saved = isSaved(business.id);
  const prospect = get(business.id);

  const [activeTab, setActiveTab] = useState<DrawerTab>('details');
  const [localNotes, setLocalNotes] = useState(prospect?.notes ?? '');
  const [reminderDate, setReminderDate] = useState(prospect?.reminderDate ?? '');
  const [reminderNote, setReminderNote] = useState(prospect?.reminderNote ?? '');
  const [showOutreach, setShowOutreach] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  const [showWeakness, setShowWeakness] = useState(false);
  const [auditText, setAuditText] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditCopied, setAuditCopied] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoUrl, setDemoUrl] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoCopied, setDemoCopied] = useState(false);
  const [psiScore, setPsiScore] = useState<number | null>(business.psiScore ?? null);
  const [psiDesktopScore, setPsiDesktopScore] = useState<number | null>(business.psiDesktopScore ?? null);
  const [psiDetails, setPsiDetails] = useState<PsiDetails | null>(business.psiDetails ?? null);
  const [psiScreenshot, setPsiScreenshot] = useState<string | null>(null);
  const [psiMetrics, setPsiMetrics] = useState<PsiMetrics | null>(null);
  const [psiLoading, setPsiLoading] = useState(false);
  const [psiError, setPsiError] = useState<string | null>(null);

  const SOCIAL_HOSTS = ['instagram.com', 'facebook.com', 'twitter.com', 'tiktok.com', 'linkedin.com'];
  const isSocialWebsite = business.website
    ? SOCIAL_HOSTS.some((h) => business.website!.includes(h))
    : false;

  const checkPsi = async () => {
    if (!business.website || isSocialWebsite || psiLoading) return;
    setPsiLoading(true);
    setPsiError(null);
    try {
      const res = await fetch(`/api/pagespeed?placeId=${business.id}&url=${encodeURIComponent(business.website)}`);
      const data = await res.json() as { score?: number; desktopScore?: number; details?: PsiDetails; metrics?: PsiMetrics; screenshotData?: string; error?: string };
      if (!res.ok || data.error) { setPsiError(data.error ?? 'Check failed'); return; }
      if (data.score != null) {
        setPsiScore(data.score);
        if (data.desktopScore != null) setPsiDesktopScore(data.desktopScore);
        if (data.details) setPsiDetails(data.details);
        if (data.screenshotData) setPsiScreenshot(data.screenshotData);
        if (data.metrics) setPsiMetrics(data.metrics);
        onPsiScore?.(business.id, data.score, data.desktopScore ?? null);
      }
    } catch (err: unknown) {
      setPsiError(err instanceof Error ? err.message : 'Request failed');
    } finally { setPsiLoading(false); }
  };

  // Auto-trigger PSI when details tab opens for a website business with no score yet
  useEffect(() => {
    if (activeTab === 'details' && business.hasWebsite && !isSocialWebsite && psiScore == null && !psiLoading) {
      checkPsi();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, business.id]);

  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailVerified, setEmailVerified] = useState<'valid' | 'invalid' | 'unknown' | null>(
    business.emailVerified ?? null
  );

  const conversationCount = prospect?.conversations?.length ?? 0;

  const score = useMemo(() => scoreProspect(business), [business]);
  const { label: scoreText, color: scoreColor } = useMemo(() => scoreLabel(score), [score]);
  const price = useMemo(() => estimatePrice(business.category, business.categoryTypes), [business.category, business.categoryTypes]);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.name)}&query_place_id=${business.id}`;

  const handleSaveToggle = () => {
    saved ? remove(business.id) : save(business);
    setLocalNotes('');
  };

  const handleStage = (stage: ProspectStage) => {
    if (!saved) save(business);
    updateStage(business.id, stage);
  };

  const handleNotesBlur = () => {
    if (!saved && localNotes) save(business);
    updateNotes(business.id, localNotes);
  };

  const handleReminderSave = () => {
    if (!reminderDate) { clearReminder(business.id); return; }
    if (!saved) save(business);
    setReminder(business.id, reminderDate, reminderNote);
  };

  const currentStage = prospect?.stage ?? 'found';

  const generateAudit = async () => {
    setAuditLoading(true);
    setAuditText(null);
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setAuditText(json.audit);
    } catch (e: unknown) {
      setAuditText(`Error: ${e instanceof Error ? e.message : 'Failed to generate audit'}`);
    } finally {
      setAuditLoading(false);
    }
  };

  const copyAudit = async () => {
    if (!auditText) return;
    try { await navigator.clipboard.writeText(auditText); } catch { /* ignore */ }
    setAuditCopied(true);
    setTimeout(() => setAuditCopied(false), 2500);
  };

  const generateDemo = async () => {
    setDemoLoading(true);
    setDemoError(null);
    setDemoUrl(null);
    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate');
      setDemoUrl(`${window.location.origin}${json.url}`);
    } catch (e: unknown) {
      setDemoError(e instanceof Error ? e.message : 'Failed to generate demo');
    } finally {
      setDemoLoading(false);
    }
  };

  const copyDemo = async () => {
    if (!demoUrl) return;
    try { await navigator.clipboard.writeText(demoUrl); } catch { /* ignore */ }
    setDemoCopied(true);
    setTimeout(() => setDemoCopied(false), 2500);
  };

  const shareDemoWhatsApp = () => {
    if (!demoUrl) return;
    const msg = `Hi! I put together a website preview for ${business.name} — take a look: ${demoUrl}`;
    const digits = (business.phoneIntl || business.phone || '').replace(/[^0-9]/g, '');
    const link = digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(link, '_blank');
  };

  const verifyEmail = async () => {
    if (!business.email || emailVerifying) return;
    setEmailVerifying(true);
    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: business.email }),
      });
      const json = await res.json();
      setEmailVerified(json.result ?? 'unknown');
    } catch {
      setEmailVerified('unknown');
    } finally {
      setEmailVerifying(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" onClick={onClose} />

      {/* Mobile: bottom sheet · Desktop: right-side drawer */}
      <div
        ref={sheetRef}
        className="
          fixed z-50 flex flex-col bg-gray-900 shadow-2xl overflow-hidden
          bottom-0 inset-x-0 max-h-[92vh] rounded-t-3xl border-t border-white/10
          animate-slide-in-up
          sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:max-h-none sm:w-full sm:max-w-md
          sm:rounded-none sm:border-t-0 sm:border-l sm:border-white/10
          sm:animate-slide-in-right
        "
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Mobile drag handle */}
        <div
          className="sm:hidden flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing flex-shrink-0"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        {/* Header */}
        <div className="bg-gray-900/95 backdrop-blur border-b border-white/10 px-5 py-4 flex items-start justify-between gap-4 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-white text-lg leading-tight line-clamp-2 mb-0.5">{business.name}</h2>
            <span className="text-sm text-purple-400 font-medium">{business.category}</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 flex-shrink-0">
          {(['details', 'outreach', 'reply', 'team', 'conversation'] as const).map((tabId) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${
                activeTab === tabId
                  ? 'text-purple-400 border-purple-400'
                  : 'text-gray-600 border-transparent hover:text-gray-400'
              }`}
            >
              {tabId === 'details'   ? 'Details'
               : tabId === 'outreach'     ? 'Outreach'
               : tabId === 'reply'        ? '💬 Reply'
               : tabId === 'team'         ? '🤖 Team'
               : 'Convo'}
              {tabId === 'conversation' && conversationCount > 0 && (
                <span className="bg-purple-500/20 text-purple-300 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  {conversationCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── REPLY INTELLIGENCE TAB ── */}
          {activeTab === 'reply' && (
            <ReplyPanel
              business={business}
              currentStage={prospect?.stage}
              onStageChange={() => {/* stage update triggers re-render via context */}}
            />
          )}

          {/* ── AI TEAM TAB ── */}
          {activeTab === 'team' && (
            <AITeamPanel business={business} psiDetails={psiDetails} />
          )}

          {/* ── OUTREACH TAB ── */}
          {activeTab === 'outreach' && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Choose an action</p>

              {/* Flagship: instant demo website (hidden behind SHOW_DEMO flag) */}
              {SHOW_DEMO && (
                <>
                  <button
                    onClick={generateDemo}
                    disabled={demoLoading}
                    className="w-full flex items-center gap-3 px-4 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-purple-900/30 disabled:opacity-60"
                  >
                    {demoLoading ? <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" /> : <Wand2 className="w-5 h-5 flex-shrink-0" />}
                    <div className="text-left">
                      <div className="font-bold">{demoLoading ? 'Building their website…' : 'Build Demo Website'}</div>
                      <div className="text-xs text-white/70 mt-0.5">Instant live preview from their Google data — pitch &ldquo;here&apos;s your site&rdquo;</div>
                    </div>
                  </button>

                  {demoError && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl px-4 py-3">{demoError}</div>
                  )}

                  {demoUrl && (
                    <div className="bg-purple-950/30 border border-purple-500/25 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2 text-purple-300">
                        <Check className="w-4 h-4 flex-shrink-0" />
                        <span className="text-[11px] font-bold uppercase tracking-widest">Demo site ready</span>
                      </div>
                      <a href={demoUrl} target="_blank" rel="noopener noreferrer" className="block text-xs text-purple-300 hover:text-purple-200 break-all underline">
                        {demoUrl}
                      </a>
                      <div className="grid grid-cols-3 gap-2">
                        <a href={demoUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" /> Open
                        </a>
                        <button onClick={copyDemo}
                          className={`flex items-center justify-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-lg transition-colors ${
                            demoCopied ? 'bg-green-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-200'
                          }`}>
                          {demoCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {demoCopied ? 'Copied' : 'Copy'}
                        </button>
                        <button onClick={shareDemoWhatsApp}
                          className="flex items-center justify-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-lg bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/20 transition-colors">
                          <MessageCircle className="w-3.5 h-3.5" /> Send
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              <button
                onClick={() => setShowOutreach(true)}
                className="w-full flex items-center gap-3 px-4 py-4 bg-green-600/15 hover:bg-green-600/25 text-green-400 border border-green-500/20 rounded-xl text-sm font-semibold transition-colors"
              >
                <MessageCircle className="w-5 h-5 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-bold">Cold Outreach Message</div>
                  <div className="text-xs text-green-400/60 mt-0.5">AI-written WhatsApp &amp; email message</div>
                </div>
              </button>
              <button
                onClick={() => canProposal ? setShowProposal(true) : triggerUpgrade('feature', 'AI Proposals')}
                className="w-full flex items-center gap-3 px-4 py-4 bg-purple-600/15 hover:bg-purple-600/25 text-purple-400 border border-purple-500/20 rounded-xl text-sm font-semibold transition-colors"
              >
                {canProposal ? <FileText className="w-5 h-5 flex-shrink-0" /> : <Lock className="w-5 h-5 flex-shrink-0" />}
                <div className="text-left">
                  <div className="font-bold flex items-center gap-2">Generate Proposal {!canProposal && <span className="text-[10px] font-bold uppercase tracking-wide bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">Pro</span>}</div>
                  <div className="text-xs text-purple-400/60 mt-0.5">Full project proposal with pricing</div>
                </div>
              </button>
              {!business.hasWebsite && (
                <>
                  <button
                    onClick={onGenerate}
                    disabled={generating}
                    className="w-full flex items-center gap-3 px-4 py-4 bg-orange-600/15 hover:bg-orange-600/25 text-orange-400 border border-orange-500/20 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {generating ? <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" /> : <Sparkles className="w-5 h-5 flex-shrink-0" />}
                    <div className="text-left">
                      <div className="font-bold">Generate Website Prompt</div>
                      <div className="text-xs text-orange-400/60 mt-0.5">AI build prompt from their business info</div>
                    </div>
                  </button>
                  {generateError && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                      ⚠ {generateError}
                    </p>
                  )}
                </>
              )}
              {business.hasWebsite && (
                <button
                  onClick={() => canWeakness ? setShowWeakness(true) : triggerUpgrade('feature', 'Website Weakness Analysis')}
                  className="w-full flex items-center gap-3 px-4 py-4 bg-yellow-600/15 hover:bg-yellow-600/25 text-yellow-400 border border-yellow-500/20 rounded-xl text-sm font-semibold transition-colors"
                >
                  {canWeakness ? <AlertTriangle className="w-5 h-5 flex-shrink-0" /> : <Lock className="w-5 h-5 flex-shrink-0" />}
                  <div className="text-left">
                    <div className="font-bold flex items-center gap-2">Website Weakness Report {!canWeakness && <span className="text-[10px] font-bold uppercase tracking-wide bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded">Pro</span>}</div>
                    <div className="text-xs text-yellow-400/60 mt-0.5">Analyse what&apos;s wrong with their site</div>
                  </div>
                </button>
              )}

              {/* Digital Presence Audit */}
              <button
                onClick={generateAudit}
                disabled={auditLoading}
                className="w-full flex items-center gap-3 px-4 py-4 bg-cyan-600/15 hover:bg-cyan-600/25 text-cyan-400 border border-cyan-500/20 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {auditLoading ? <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" /> : <TrendingUp className="w-5 h-5 flex-shrink-0" />}
                <div className="text-left">
                  <div className="font-bold">Generate Digital Presence Audit</div>
                  <div className="text-xs text-cyan-400/60 mt-0.5">Shareable audit showing exactly what they&apos;re missing</div>
                </div>
              </button>

              {auditText && (
                <div className="bg-cyan-950/30 border border-cyan-500/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest">Digital Presence Audit</span>
                    <button
                      onClick={copyAudit}
                      className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
                        auditCopied ? 'bg-green-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'
                      }`}
                    >
                      {auditCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {auditCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">{auditText}</div>
                </div>
              )}
            </div>
          )}

          {/* ── CONVERSATION TAB ── */}
          {activeTab === 'conversation' && (
            <div>
              {!saved && (
                <div className="mb-4 bg-yellow-900/30 border border-yellow-500/20 rounded-xl px-4 py-3 text-yellow-300 text-sm">
                  <span className="font-bold">Save to pipeline first</span> to track conversations.
                  <button onClick={() => save(business)} className="ml-2 underline hover:no-underline">Save now</button>
                </div>
              )}
              {saved && <ConversationPanel business={business} />}
              {!saved && (
                <div className="text-center py-8 border border-dashed border-white/10 rounded-2xl">
                  <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Save this prospect to start tracking conversations</p>
                </div>
              )}
            </div>
          )}

          {/* ── DETAILS TAB ── */}
          {activeTab === 'details' && <>

          {/* Status banner */}
          {business.hasWebsite ? (
            <div className="space-y-3">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3">
                <Globe className="w-5 h-5 text-green-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-green-400 font-bold text-sm">Has a Website</div>
                  <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-green-300/60 text-xs hover:underline truncate block">
                    {business.website}
                  </a>
                </div>
              </div>

              {/* PageSpeed Insights panel */}
              {!isSocialWebsite && (
                <div className={`border rounded-xl p-4 ${
                  psiScore == null ? 'bg-white/[0.02] border-white/8' :
                  psiScore >= 90   ? 'bg-green-500/8 border-green-500/20' :
                  psiScore >= 50   ? 'bg-yellow-500/8 border-yellow-500/20' :
                                     'bg-red-500/8 border-red-500/20'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Mobile Speed Score</span>
                    {psiLoading
                      ? <span className="text-[11px] text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Checking…</span>
                      : psiScore == null
                      ? <button onClick={checkPsi} className="text-[11px] text-blue-400 hover:text-blue-300 font-bold transition-colors">Check now</button>
                      : <button onClick={checkPsi} className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">Recheck</button>
                    }
                  </div>

                  {psiScore != null && (
                    <>
                      <div className="flex gap-4 mb-3">
                        {[
                          { label: '📱 Mobile', score: psiScore },
                          ...(psiDesktopScore != null ? [{ label: '🖥 Desktop', score: psiDesktopScore }] : []),
                        ].map(({ label, score: s }) => (
                          <div key={label}>
                            <div className="text-[10px] text-gray-500 mb-0.5">{label}</div>
                            <div className="flex items-end gap-1">
                              <span className={`text-2xl font-black ${
                                s >= 90 ? 'text-green-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400'
                              }`}>{s}</span>
                              <span className="text-gray-600 text-xs mb-0.5">/100</span>
                              <span className="text-xs mb-0.5 ml-0.5">
                                {s >= 90 ? '⚡' : s >= 50 ? '🐢' : '🐌'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {psiMetrics && (
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          {psiMetrics.fcp && <div className="flex justify-between"><span className="text-gray-500">First Paint</span><span className="text-gray-300 font-mono">{psiMetrics.fcp}</span></div>}
                          {psiMetrics.lcp && <div className="flex justify-between"><span className="text-gray-500">Largest Paint</span><span className="text-gray-300 font-mono">{psiMetrics.lcp}</span></div>}
                          {psiMetrics.tbt && <div className="flex justify-between"><span className="text-gray-500">Blocking Time</span><span className="text-gray-300 font-mono">{psiMetrics.tbt}</span></div>}
                          {psiMetrics.si  && <div className="flex justify-between"><span className="text-gray-500">Speed Index</span><span className="text-gray-300 font-mono">{psiMetrics.si}</span></div>}
                        </div>
                      )}
                      {psiScore < 50 && (
                        <div className="mt-3 pt-3 border-t border-red-500/20">
                          <p className="text-[11px] text-red-300/80 leading-relaxed">
                            💡 <strong>Pitch angle:</strong> &ldquo;Your website loads too slowly on mobile — most of your customers are leaving before they even see your menu.&rdquo;
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  {psiError && <p className="text-[11px] text-red-400 mt-1">{psiError}</p>}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-orange-500/10 border border-orange-500/25 rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl">🎯</span>
              <div>
                <div className="text-orange-400 font-bold">No Website Found</div>
                <div className="text-orange-300/60 text-xs">This is a hot prospect — they need you!</div>
              </div>
            </div>
          )}

          {/* Score + Price row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Prospect Score</div>
              <div className={`text-sm font-bold px-2 py-0.5 rounded-full border inline-block ${scoreColor}`}>
                {scoreText} — {score}/10
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Price Estimate</div>
              <div className="text-sm font-bold text-white">
                {formatPrice(price.min)} <span className="text-gray-500">–</span> {formatPrice(price.max)}
              </div>
            </div>
          </div>

          {/* "What You're Missing" card — only for no-website businesses */}
          {!business.hasWebsite && (
            <div className="bg-gradient-to-br from-orange-900/30 to-red-900/20 border border-orange-500/20 rounded-xl p-4">
              <div className="text-orange-400 font-bold text-sm mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" /> What They're Missing Without a Website
              </div>
              <ul className="space-y-1.5">
                {[
                  "❌ Customers can't find them when searching online",
                  '❌ No way to accept bookings or orders 24/7',
                  '❌ Lost to competitors who do have a website',
                  '❌ No professional presence to build trust',
                ].map((item) => (
                  <li key={item} className="text-gray-300 text-xs leading-snug">{item}</li>
                ))}
              </ul>
              {business.rating && business.reviewCount && business.reviewCount > 20 && (
                <div className="mt-3 text-xs text-orange-300/70 bg-orange-500/10 rounded-lg px-3 py-2">
                  ⭐ With {business.reviewCount} reviews, they have a strong reputation — a website would turn that trust into real sales.
                </div>
              )}
            </div>
          )}

          {/* Contact info */}
          <div className="space-y-2.5">
            {business.address && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-300 text-sm leading-snug">{business.address}</span>
              </div>
            )}
            {business.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <a href={`tel:${business.phone}`} className="text-gray-300 text-sm hover:text-white transition-colors">
                  {business.phone}
                </a>
              </div>
            )}
            {business.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-gray-300 text-sm flex-1 truncate">{business.email}</span>
                {emailVerified === 'valid' && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/15 border border-green-500/25 px-2 py-0.5 rounded-full flex-shrink-0">
                    <ShieldCheck className="w-3 h-3" /> Valid
                  </span>
                )}
                {emailVerified === 'invalid' && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/15 border border-red-500/25 px-2 py-0.5 rounded-full flex-shrink-0">
                    <ShieldX className="w-3 h-3" /> Invalid
                  </span>
                )}
                {emailVerified === 'unknown' && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-white/8 border border-white/10 px-2 py-0.5 rounded-full flex-shrink-0">
                    <ShieldQuestion className="w-3 h-3" /> Unknown
                  </span>
                )}
                {!emailVerified && (
                  <button
                    onClick={verifyEmail}
                    disabled={emailVerifying}
                    className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 px-2 py-0.5 rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
                  >
                    {emailVerifying ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Verify'}
                  </button>
                )}
              </div>
            )}
            {business.rating ? (
              <div className="flex items-center gap-3">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                <span className="text-gray-300 text-sm">
                  {business.rating} / 5 &nbsp;·&nbsp; {business.reviewCount} reviews
                  {business.lastReviewDate && <span className="text-gray-500"> · last {business.lastReviewDate}</span>}
                </span>
              </div>
            ) : null}
            {business.hoursComplete === false && (
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-amber-500/80 text-sm">Opening hours not listed on Google</span>
              </div>
            )}
          </div>

          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> View on Google Maps
          </a>

          {/* ── Pipeline Stage ── */}
          <div>
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Pipeline Stage</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {STAGES.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => handleStage(stage.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    currentStage === stage.id && saved
                      ? stage.color
                      : 'bg-white/5 text-gray-500 border-white/8 hover:bg-white/10 hover:text-gray-300'
                  }`}
                >
                  <span>{stage.icon}</span> {stage.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Notes ── */}
          <div>
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Notes</h3>
            <textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add notes about this prospect…"
              rows={3}
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none transition-colors"
            />
          </div>

          {/* ── Reminder ── */}
          <div>
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Follow-up Reminder</h3>
            <div className="space-y-2">
              <input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors"
              />
              <input
                type="text"
                value={reminderNote}
                onChange={(e) => setReminderNote(e.target.value)}
                placeholder="Reminder note (e.g. Call back, Send proposal)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
              />
              <button
                onClick={handleReminderSave}
                className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
              >
                {reminderDate ? '💾 Save Reminder' : '🗑 Clear Reminder'}
              </button>
            </div>
          </div>

          {/* ── Description ── */}
          {business.description && (
            <div>
              <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">About</h3>
              <p className="text-gray-300 text-sm leading-relaxed">{business.description}</p>
            </div>
          )}

          {/* ── Opening hours ── */}
          {business.openingHours && business.openingHours.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Opening Hours
              </h3>
              <div className="space-y-1">
                {business.openingHours.map((h, i) => (
                  <div key={i} className="text-sm text-gray-400">{h}</div>
                ))}
              </div>
            </div>
          )}

          {/* ── Reviews ── */}
          {business.reviews && business.reviews.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">Customer Reviews</h3>
              <div className="space-y-3">
                {business.reviews.map((r, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-gray-300">{r.author}</span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Star key={j} className={`w-3 h-3 ${j < r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-700'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{r.text}</p>
                    <p className="text-[11px] text-gray-600 mt-1.5">{r.time}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          </> /* end details tab */}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-gray-900/95 backdrop-blur border-t border-white/10 p-4">
          <button
            onClick={handleSaveToggle}
            className={`w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl transition-all text-sm ${
              saved
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/25'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {saved ? (
              <><BookmarkX className="w-4 h-4" /> Remove from Pipeline</>
            ) : (
              <><Bookmark className="w-4 h-4" /> Save to Pipeline</>
            )}
          </button>
        </div>
      </div>

      {showOutreach && <OutreachModal business={business} onClose={() => setShowOutreach(false)} />}
      {showProposal && <ProposalModal business={business} onClose={() => setShowProposal(false)} />}
      {showWeakness && <WeaknessModal business={business} psiDetails={psiDetails} psiScreenshot={psiScreenshot} onClose={() => setShowWeakness(false)} />}
    </>
  );
}
