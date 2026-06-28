'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Zap, Sparkles, Mail } from 'lucide-react';

import SearchForm from '@/components/SearchForm';
import BusinessGrid from '@/components/BusinessGrid';
import BusinessDrawer from '@/components/BusinessDrawer';
import PromptModal from '@/components/PromptModal';
import QuickFireModal from '@/components/QuickFireModal';
import DailyBriefModal from '@/components/DailyBriefModal';
import BulkEmailModal from '@/components/BulkEmailModal';
import { Business, SearchFormData } from '@/types';
import { useProspects } from '@/context/ProspectsContext';
import { saveToHistory, getBestTimeStatus } from '@/lib/searchHistory';

type FilterMode = 'all' | 'no-website' | 'new';

const STAGE_SORT_ORDER: Record<string, number> = {
  found: 2, contacted: 3, interested: 3, proposal: 4, won: 5, lost: 5,
};

const PER_PAGE = 20;

export default function Home() {
  const { isSaved, get } = useProspects();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [page, setPage] = useState(0);

  const [selected, setSelected] = useState<Business | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showQuickFire, setShowQuickFire] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const [showBulkEmail, setShowBulkEmail] = useState(false);

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
      if (!res.ok) throw new Error(json.error || 'Search failed');
      const results: Business[] = json.businesses || [];
      setBusinesses(results);
      // Save to search history
      saveToHistory({
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

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const handleFilterChange = (f: FilterMode) => { setFilter(f); setPage(0); };
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const goNext = () => { setPage((p) => Math.min(p + 1, totalPages - 1)); scrollToTop(); };
  const goPrev = () => { setPage((p) => Math.max(p - 1, 0)); scrollToTop(); };

  const quickFireTargets = businesses.filter((b) => !b.hasWebsite && b.phone);

  // Email blast: no-website + social-only (FB/IG). Social-only businesses
  // are online enough that their contact email is often findable.
  const isSocialOnly = (b: typeof businesses[0]) =>
    !!b.website && /instagram\.com|facebook\.com|tiktok\.com|twitter\.com|x\.com/.test(b.website);
  const emailBlastTargets = businesses.filter((b) => !b.hasWebsite || isSocialOnly(b));

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      <SearchForm onSearch={handleSearch} loading={loading} onBrief={() => setShowBrief(true)} />

      {hasSearched && (
        <main className="max-w-7xl mx-auto px-4 py-8">

          {!loading && !error && businesses.length > 0 && (
            <div className="flex items-center gap-3 mb-6 flex-wrap">

              {/* Stats + time indicator */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-gray-500">
                  <strong className="text-white">{filtered.length}</strong> results
                  {totalPages > 1 && (
                    <span className="text-gray-600">
                      &nbsp;· page <strong className="text-purple-400">{page + 1}</strong> of <strong className="text-purple-400">{totalPages}</strong>
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
                {/* Quick-Fire button */}
                {quickFireTargets.length > 0 && (
                  <button
                    onClick={() => setShowQuickFire(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 hover:bg-yellow-500/25 transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5" /> Quick-Fire ({quickFireTargets.length})
                  </button>
                )}

                {/* Email Blast button */}
                <button
                  onClick={() => setShowBulkEmail(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25 hover:bg-blue-500/25 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" /> Email Blast ({emailBlastTargets.length})
                </button>

                {/* Filters */}
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

          <BusinessGrid businesses={paginated} loading={loading} error={error} onSelect={handleSelect} />

          {/* Pagination */}
          {!loading && !error && totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <button onClick={goPrev} disabled={page === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/8 hover:bg-white/15 border border-white/10 rounded-xl text-sm font-semibold text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button key={i} onClick={() => { setPage(i); scrollToTop(); }}
                    className={`w-9 h-9 rounded-xl text-sm font-bold transition-colors ${
                      i === page ? 'bg-purple-600 text-white' : 'bg-white/8 text-gray-500 hover:bg-white/15 hover:text-white border border-white/10'}`}>
                    {i + 1}
                  </button>
                ))}
              </div>
              <button onClick={goNext} disabled={page === totalPages - 1}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/8 hover:bg-white/15 border border-white/10 rounded-xl text-sm font-semibold text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <p className="text-center text-xs text-gray-600 mt-3">
              Showing {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, filtered.length)} of {filtered.length} businesses
            </p>
          )}
        </main>
      )}

      {!hasSearched && (
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: '🔍', title: 'Discover Prospects', desc: 'Search any industry in any city — up to 60 results per search' },
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
        <QuickFireModal
          businesses={businesses}
          onClose={() => setShowQuickFire(false)}
        />
      )}
      {showBulkEmail && (
        <BulkEmailModal
          businesses={emailBlastTargets}
          onClose={() => setShowBulkEmail(false)}
        />
      )}
      {showBrief && (
        <DailyBriefModal
          onStart={(industry, location) => {
            setShowBrief(false);
            const query = `${industry} in ${location}`;
            handleSearch({ industry, location, radius: 5, query });
          }}
          onDismiss={() => setShowBrief(false)}
        />
      )}
    </div>
  );
}
