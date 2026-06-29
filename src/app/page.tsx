'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Zap, Mail, Lock } from 'lucide-react';

import SearchForm from '@/components/SearchForm';
import BusinessGrid from '@/components/BusinessGrid';
import BusinessDrawer from '@/components/BusinessDrawer';
import PromptModal from '@/components/PromptModal';
import QuickFireModal from '@/components/QuickFireModal';
import DailyBriefModal from '@/components/DailyBriefModal';
import BulkEmailModal from '@/components/BulkEmailModal';
import { Business, SearchFormData } from '@/types';
import { useProspects } from '@/context/ProspectsContext';
import { useUpgrade } from '@/context/UpgradeContext';
import { saveToHistory, getBestTimeStatus } from '@/lib/searchHistory';
import { scoreProspect } from '@/lib/scoring';

type FilterMode = 'all' | 'no-website' | 'new';

const STAGE_SORT_ORDER: Record<string, number> = {
  found: 2, contacted: 3, interested: 3, proposal: 4, won: 5, lost: 5,
};

const PER_PAGE = 20;

interface SearchMeta {
  searchesRemaining: number | null;
  searchesUsed: number | null;
  searchesLimit: number | null;
  plan: string;
  resultsLimit: number;
}

export default function Home() {
  const router = useRouter();
  const { isSaved, get } = useProspects();
  const { triggerUpgrade } = useUpgrade();

  const [businesses, setBusinesses]   = useState<Business[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [filter, setFilter]           = useState<FilterMode>('all');
  const [page, setPage]               = useState(0);
  const [searchMeta, setSearchMeta]   = useState<SearchMeta | null>(null);

  const [phoneOnly, setPhoneOnly]           = useState(false);
  const [reviewedOnly, setReviewedOnly]     = useState(false);
  const [sortByScore, setSortByScore]       = useState(false);

  const [selected, setSelected]             = useState<Business | null>(null);
  const [detailLoading, setDetailLoading]   = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [generating, setGenerating]         = useState(false);
  const [showQuickFire, setShowQuickFire]   = useState(false);
  const [showBrief, setShowBrief]           = useState(false);
  const [showBulkEmail, setShowBulkEmail]   = useState(false);
  const [guestGate, setGuestGate]           = useState(false);
  const [guestStats, setGuestStats]         = useState({ total: 0, noWebsite: 0, location: '' });
  const [generateError, setGenerateError]   = useState<string | null>(null);

  // Track whether this guest has used their one free search
  const [guestExhausted, setGuestExhausted] = useState(false);
  useEffect(() => {
    try { setGuestExhausted(!!localStorage.getItem('aip_guest_used')); } catch { /* */ }
  }, []);

  const timeStatus = getBestTimeStatus();

  const handleSearch = async (data: SearchFormData) => {
    // If guest already used their free search, show gate immediately
    if (guestExhausted && businesses.length > 0) {
      setGuestGate(true);
      return;
    }

    setLoading(true);
    setError(null);
    setBusinesses([]);
    setHasSearched(true);
    setSelected(null);
    setGeneratedPrompt(null);
    setPage(0);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (res.status === 402 && json.code === 'SEARCH_LIMIT') {
        triggerUpgrade('ai_limit');
        setError(json.error || 'Daily search limit reached. Upgrade for more searches.');
        return;
      }
      if (!res.ok) throw new Error(json.error || 'Search failed');

      const results: Business[] = json.businesses || [];
      setBusinesses(results);

      if (json.isGuest) {
        // Show results blurred behind signup gate
        const noWebsite = results.filter((b: Business) => !b.hasWebsite).length;
        setGuestStats({ total: results.length, noWebsite, location: data.location || 'your area' });
        setGuestGate(true);
        // Mark this guest's free attempt as used
        try { localStorage.setItem('aip_guest_used', '1'); setGuestExhausted(true); } catch { /* */ }
        return; // skip search history + meta for guests
      }

      setSearchMeta({
        searchesRemaining: json.searchesRemaining ?? null,
        searchesUsed:      json.searchesUsed      ?? null,
        searchesLimit:     json.searchesLimit     ?? null,
        plan:              json.plan              ?? 'free',
        resultsLimit:      json.resultsLimit      ?? 20,
      });

      void saveToHistory({
        industry: data.industry,
        location: data.location || 'GPS',
        totalCount: results.length,
        noWebsiteCount: results.filter((b) => !b.hasWebsite).length,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (business: Business) => {
    setSelected(business);
    setGeneratedPrompt(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/details?id=${business.id}`);
      const json = await res.json();
      if (res.ok && json.details) setSelected(json.details);
    } catch { /* keep basic data */ }
    finally { setDetailLoading(false); }
  };

  const handleGenerate = async () => {
    if (!selected) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business: selected }),
      });
      if (res.status === 401) { router.push('/auth/signup'); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generation failed');
      setGeneratedPrompt(json.prompt);
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate prompt');
    } finally { setGenerating(false); }
  };

  const noWebsiteCount = businesses.filter((b) => !b.hasWebsite).length;
  const newCount = businesses.filter((b) => !isSaved(b.id)).length;
  const hotCount = businesses.filter((b) => scoreProspect(b) >= 8).length;

  const sorted = [...businesses].sort((a, b) => {
    if (sortByScore) {
      return scoreProspect(b) - scoreProspect(a);
    }
    const aStage = isSaved(a.id) ? STAGE_SORT_ORDER[get(a.id)?.stage ?? 'found'] ?? 2 : 1;
    const bStage = isSaved(b.id) ? STAGE_SORT_ORDER[get(b.id)?.stage ?? 'found'] ?? 2 : 1;
    return aStage - bStage;
  });

  const primaryFiltered =
    filter === 'no-website' ? sorted.filter((b) => !b.hasWebsite) :
    filter === 'new'        ? sorted.filter((b) => !isSaved(b.id)) :
    sorted;

  const filtered = primaryFiltered
    .filter((b) => !phoneOnly || !!b.phone)
    .filter((b) => !reviewedOnly || (b.reviewCount != null && b.reviewCount > 0));

  // Hot leads pinned strip (score ≥ 8, only when not already sorted by score)
  const hotLeads = !sortByScore && page === 0
    ? filtered.filter((b) => scoreProspect(b) >= 8).slice(0, 3)
    : [];

  const totalPages   = Math.ceil(filtered.length / PER_PAGE);
  const paginated    = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  // Is Next locked? Free plan gets only 1 page (20 results)
  const resultsLimit    = searchMeta?.resultsLimit ?? Infinity;
  const maxAllowedPages = resultsLimit === Infinity ? totalPages : Math.ceil(resultsLimit / PER_PAGE);
  const nextLocked      = page >= maxAllowedPages - 1 && totalPages > maxAllowedPages;

  const handleFilterChange = (f: FilterMode) => { setFilter(f); setPage(0); };
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const goNext = () => {
    if (nextLocked) { triggerUpgrade('feature'); return; }
    setPage((p) => Math.min(p + 1, totalPages - 1));
    scrollToTop();
  };
  const goPrev = () => { setPage((p) => Math.max(p - 1, 0)); scrollToTop(); };

  const quickFireTargets  = businesses.filter((b) => !b.hasWebsite && b.phone);
  const isSocialOnly      = (b: typeof businesses[0]) =>
    !!b.website && /instagram\.com|facebook\.com|tiktok\.com|twitter\.com|x\.com/.test(b.website);
  const emailBlastTargets = businesses.filter((b) => !b.hasWebsite || isSocialOnly(b));

  // Searches remaining badge color
  const remainingColor =
    searchMeta?.searchesRemaining == null ? '' :
    searchMeta.searchesRemaining <= 1     ? 'text-red-400 bg-red-500/10 border-red-500/20' :
    searchMeta.searchesRemaining <= 3     ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' :
                                            'text-green-400 bg-green-500/10 border-green-500/20';

  return (
    <div className="min-h-dvh bg-gray-950 text-white">

      <SearchForm onSearch={handleSearch} loading={loading} onBrief={() => setShowBrief(true)} />

      {hasSearched && (
        <main className="max-w-7xl mx-auto px-4 py-4 sm:py-8">

          {/* Guest signup gate — overlays blurred results */}
          {guestGate && (
            <div className="relative">
              {/* Blurred results behind gate */}
              <div className="pointer-events-none select-none blur-sm opacity-40 -mt-2">
                <BusinessGrid businesses={businesses.slice(0, 6)} loading={false} error={null} onSelect={() => {}} />
              </div>

              {/* Overlay gate */}
              <div className="absolute inset-0 flex items-start justify-center pt-10 px-4 z-10">
                <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/60 max-w-md w-full p-5 sm:p-8 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-purple-900/30">
                    <img src="/logo.svg" alt="" className="w-10 h-10" />
                  </div>

                  {guestStats.noWebsite > 0 ? (
                    <>
                      <div className="inline-flex items-center gap-1.5 bg-orange-500/15 border border-orange-500/25 text-orange-400 text-xs font-bold px-3 py-1.5 rounded-full mb-4">
                        🎯 {guestStats.noWebsite} businesses with no website found
                      </div>
                      <h2 className="text-xl font-black text-white mb-2">
                        Your prospects are ready
                      </h2>
                      <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                        You found <strong className="text-white">{guestStats.total} businesses</strong> in {guestStats.location} —{' '}
                        <strong className="text-orange-400">{guestStats.noWebsite} have no website</strong> and could be your next paying clients.
                        Sign up free to access their details, phone numbers, and AI outreach messages.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-black text-white mb-2">
                        {guestStats.total} businesses found
                      </h2>
                      <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                        Sign up free to access contact details, save prospects, and generate AI outreach messages.
                      </p>
                    </>
                  )}

                  <div className="space-y-3">
                    <button
                      onClick={() => router.push('/auth/signup')}
                      className="w-full bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 text-white font-black py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-purple-900/30"
                    >
                      Sign up free — takes 30 seconds
                    </button>
                    <button
                      onClick={() => router.push('/auth/signin')}
                      className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white font-semibold py-3 rounded-xl text-sm transition-colors"
                    >
                      Already have an account? Sign in
                    </button>
                  </div>

                  <p className="text-gray-700 text-xs mt-4">Free plan · No credit card needed</p>
                </div>
              </div>
            </div>
          )}

          {/* Search quota badge */}
          {!guestGate && searchMeta && searchMeta.searchesLimit !== null && (
            <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border mb-4 ${remainingColor}`}>
              {searchMeta.searchesRemaining === 0
                ? '🔒 No searches left today — upgrade to continue'
                : `🔍 ${searchMeta.searchesRemaining} of ${searchMeta.searchesLimit} searches left today`}
            </div>
          )}

          {!guestGate && !loading && !error && businesses.length > 0 && (
            <div className="flex items-center gap-3 mb-6 flex-wrap">

              {/* Stats + time indicator */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-gray-500">
                  <strong className="text-white">{filtered.length}</strong> results
                  {totalPages > 1 && (
                    <span className="text-gray-600">
                      &nbsp;· page <strong className="text-purple-400">{page + 1}</strong> of{' '}
                      <strong className="text-purple-400">{maxAllowedPages}</strong>
                      {maxAllowedPages < totalPages && (
                        <span className="text-gray-700"> ({totalPages - maxAllowedPages} locked)</span>
                      )}
                    </span>
                  )}
                  &nbsp;·&nbsp;
                  <strong className="text-orange-400">{noWebsiteCount}</strong> no website
                  &nbsp;·&nbsp;
                  <strong className="text-green-400">{newCount}</strong> new
                </span>
                <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                  <span className={`w-1.5 h-1.5 rounded-full ${timeStatus.dot}`} />
                  <span className={timeStatus.color}>{timeStatus.label}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto flex-wrap">
                {quickFireTargets.length > 0 && (
                  <button
                    onClick={() => setShowQuickFire(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 hover:bg-yellow-500/25 transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5" /> Quick-Fire ({quickFireTargets.length})
                  </button>
                )}
                <button
                  onClick={() => setShowBulkEmail(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25 hover:bg-blue-500/25 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" /> Email Blast ({emailBlastTargets.length})
                </button>
                <button onClick={() => handleFilterChange('all')}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                    filter === 'all' ? 'bg-purple-600 text-white' : 'bg-white/8 text-gray-400 hover:bg-white/15 border border-white/10'}`}>
                  All ({businesses.length})
                </button>
                <button onClick={() => handleFilterChange('no-website')}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                    filter === 'no-website' ? 'bg-orange-500 text-white' : 'bg-white/8 text-gray-400 hover:bg-white/15 border border-white/10'}`}>
                  🎯 No Website ({noWebsiteCount})
                </button>
                <button onClick={() => handleFilterChange('new')}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                    filter === 'new' ? 'bg-green-600 text-white' : 'bg-white/8 text-gray-400 hover:bg-white/15 border border-white/10'}`}>
                  ✨ New ({newCount})
                </button>
                <span className="text-gray-700 text-xs hidden sm:inline">|</span>
                <button
                  onClick={() => setPhoneOnly((v) => !v)}
                  title="Only show businesses with a phone number (WhatsApp-ready)"
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                    phoneOnly ? 'bg-green-700 text-green-200 border border-green-600/50' : 'bg-white/8 text-gray-400 hover:bg-white/15 border border-white/10'}`}>
                  📞 Phone only
                </button>
                <button
                  onClick={() => setReviewedOnly((v) => !v)}
                  title="Only show businesses with at least one Google review (active & real)"
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                    reviewedOnly ? 'bg-yellow-700 text-yellow-200 border border-yellow-600/50' : 'bg-white/8 text-gray-400 hover:bg-white/15 border border-white/10'}`}>
                  ⭐ Reviewed
                </button>
                <button
                  onClick={() => { setSortByScore((v) => !v); setPage(0); }}
                  title="Sort by lead score — hottest prospects first"
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                    sortByScore ? 'bg-red-700 text-red-200 border border-red-600/50' : 'bg-white/8 text-gray-400 hover:bg-white/15 border border-white/10'}`}>
                  🔥 Hot first {hotCount > 0 && `(${hotCount})`}
                </button>
              </div>
            </div>
          )}

          {/* Hot leads pinned strip */}
          {!guestGate && hotLeads.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-bold text-red-400 uppercase tracking-widest">🔥 Hottest Leads</span>
                <span className="text-[10px] text-gray-600">Score 8–10 · pitch these first</span>
              </div>
              <BusinessGrid businesses={hotLeads} loading={false} error={null} onSelect={handleSelect} />
              <div className="border-t border-white/8 mt-6 mb-2" />
              <p className="text-[11px] text-gray-600 mb-4">All results below</p>
            </div>
          )}

          {!guestGate && (
            <BusinessGrid businesses={paginated} loading={loading} error={error} onSelect={handleSelect} />
          )}

          {/* Pagination */}
          {!guestGate && !loading && !error && totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <button onClick={goPrev} disabled={page === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/8 hover:bg-white/15 border border-white/10 rounded-xl text-sm font-semibold text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const locked = i >= maxAllowedPages;
                  return (
                    <button key={i}
                      onClick={() => {
                        if (locked) { triggerUpgrade('feature'); return; }
                        setPage(i); scrollToTop();
                      }}
                      className={`w-9 h-9 rounded-xl text-sm font-bold transition-colors flex items-center justify-center ${
                        locked
                          ? 'bg-white/5 text-gray-700 border border-white/8 cursor-not-allowed'
                          : i === page
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/8 text-gray-500 hover:bg-white/15 hover:text-white border border-white/10'
                      }`}
                    >
                      {locked ? <Lock className="w-3 h-3" /> : i + 1}
                    </button>
                  );
                })}
              </div>

              <button onClick={goNext}
                disabled={page >= maxAllowedPages - 1 && !nextLocked}
                className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-semibold transition-colors ${
                  nextLocked
                    ? 'bg-orange-500/10 border-orange-500/25 text-orange-400 hover:bg-orange-500/20 cursor-pointer'
                    : page === totalPages - 1
                    ? 'bg-white/8 border-white/10 text-gray-300 opacity-30 cursor-not-allowed'
                    : 'bg-white/8 hover:bg-white/15 border-white/10 text-gray-300'
                }`}
              >
                {nextLocked
                  ? <><Lock className="w-4 h-4" /> Upgrade for More</>
                  : <>Next <ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          )}

          {/* Results cap notice for limited plans */}
          {!guestGate && !loading && !error && filtered.length > 0 && (
            <div className="text-center mt-3 space-y-1">
              <p className="text-xs text-gray-600">
                Showing {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, filtered.length)} of{' '}
                {filtered.length} businesses
              </p>
              {maxAllowedPages < totalPages && (
                <p className="text-xs text-orange-400/70">
                  Your plan shows {resultsLimit} results per search —{' '}
                  <button onClick={() => triggerUpgrade('feature')} className="underline hover:text-orange-400">
                    upgrade to unlock all {filtered.length}
                  </button>
                </p>
              )}
            </div>
          )}
        </main>
      )}

      {!hasSearched && (
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: '🔍', title: 'Discover Prospects', desc: 'Search any industry in any city — up to 60 results per search on Pro' },
              { icon: '⚡', title: 'Quick-Fire Mode', desc: 'Send WhatsApp to 20 prospects in under 5 minutes — one by one' },
              { icon: '🤖', title: 'AI-Powered Outreach', desc: 'BAB, AIDA, PAS messages + proposals + Lovable prompts generated instantly' },
            ].map((step) => (
              <div key={step.title} className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 text-left">
                <div className="text-3xl mb-3">{step.icon}</div>
                <div className="font-bold text-white text-sm mb-1">{step.title}</div>
                <div className="text-gray-500 text-xs leading-relaxed">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <BusinessDrawer
          business={selected}
          onClose={() => { setSelected(null); setGeneratedPrompt(null); setGenerateError(null); }}
          onGenerate={handleGenerate}
          generating={generating || detailLoading}
          generateError={generateError}
        />
      )}
      {generatedPrompt && selected && (
        <PromptModal
          prompt={generatedPrompt}
          businessName={selected.name}
          onClose={() => setGeneratedPrompt(null)}
          onRegenerate={handleGenerate}
          generating={generating}
        />
      )}
      {showQuickFire && (
        <QuickFireModal businesses={businesses} onClose={() => setShowQuickFire(false)} />
      )}
      {showBulkEmail && (
        <BulkEmailModal businesses={emailBlastTargets} onClose={() => setShowBulkEmail(false)} />
      )}
      {showBrief && (
        <DailyBriefModal
          onStart={(industry, location) => {
            setShowBrief(false);
            handleSearch({ industry, location, radius: 5, query: `${industry} in ${location}` });
          }}
          onDismiss={() => setShowBrief(false)}
        />
      )}
    </div>
  );
}
