'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Zap, Sparkles, Mail, Lock } from 'lucide-react';

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

  const [selected, setSelected]             = useState<Business | null>(null);
  const [detailLoading, setDetailLoading]   = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [generating, setGenerating]         = useState(false);
  const [showQuickFire, setShowQuickFire]   = useState(false);
  const [showBrief, setShowBrief]           = useState(false);
  const [showBulkEmail, setShowBulkEmail]   = useState(false);

  const timeStatus = getBestTimeStatus();

  const handleSearch = async (data: SearchFormData) => {
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

      if (res.status === 401) {
        setError('__auth__');
        return;
      }
      if (res.status === 402 && json.code === 'SEARCH_LIMIT') {
        triggerUpgrade('ai_limit');
        setError(json.error || 'Daily search limit reached. Upgrade for more searches.');
        return;
      }
      if (!res.ok) throw new Error(json.error || 'Search failed');

      const results: Business[] = json.businesses || [];
      setBusinesses(results);
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
      alert(err instanceof Error ? err.message : 'Failed to generate prompt');
    } finally { setGenerating(false); }
  };

  const noWebsiteCount = businesses.filter((b) => !b.hasWebsite).length;
  const newCount = businesses.filter((b) => !isSaved(b.id)).length;

  const sorted = [...businesses].sort((a, b) => {
    const aStage = isSaved(a.id) ? STAGE_SORT_ORDER[get(a.id)?.stage ?? 'found'] ?? 2 : 1;
    const bStage = isSaved(b.id) ? STAGE_SORT_ORDER[get(b.id)?.stage ?? 'found'] ?? 2 : 1;
    return aStage - bStage;
  });

  const filtered =
    filter === 'no-website' ? sorted.filter((b) => !b.hasWebsite) :
    filter === 'new'        ? sorted.filter((b) => !isSaved(b.id)) :
    sorted;

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
    <div className="min-h-screen bg-gray-950 text-white">

      <SearchForm onSearch={handleSearch} loading={loading} onBrief={() => setShowBrief(true)} />

      {hasSearched && (
        <main className="max-w-7xl mx-auto px-4 py-8">

          {/* Auth gate — shown instead of redirecting */}
          {error === '__auth__' && (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-purple-900/30">
                <img src="/logo.svg" alt="" className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Create a free account to search</h2>
              <p className="text-gray-400 text-sm mb-8 max-w-sm">
                Sign up free to discover businesses with no website — your next paying clients. Takes 30 seconds.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => router.push('/auth/signup')}
                  className="bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 text-white font-black px-8 py-3 rounded-xl text-sm transition-all shadow-lg shadow-purple-900/30"
                >
                  Sign up free
                </button>
                <button
                  onClick={() => router.push('/auth/signin')}
                  className="bg-white/8 hover:bg-white/15 border border-white/10 text-gray-300 font-semibold px-8 py-3 rounded-xl text-sm transition-colors"
                >
                  Sign in
                </button>
              </div>
            </div>
          )}

          {/* Search quota badge */}
          {error !== '__auth__' && searchMeta && searchMeta.searchesLimit !== null && (
            <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border mb-4 ${remainingColor}`}>
              {searchMeta.searchesRemaining === 0
                ? '🔒 No searches left today — upgrade to continue'
                : `🔍 ${searchMeta.searchesRemaining} of ${searchMeta.searchesLimit} searches left today`}
            </div>
          )}

          {!loading && !error && businesses.length > 0 && (
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
              </div>
            </div>
          )}

          {error !== '__auth__' && (
            <BusinessGrid businesses={paginated} loading={loading} error={error} onSelect={handleSelect} />
          )}

          {/* Pagination */}
          {error !== '__auth__' && !loading && !error && totalPages > 1 && (
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
          {error !== '__auth__' && !loading && !error && filtered.length > 0 && (
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
          onClose={() => { setSelected(null); setGeneratedPrompt(null); }}
          onGenerate={handleGenerate}
          generating={generating || detailLoading}
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
