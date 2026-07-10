'use client';

import { useState, useCallback } from 'react';
import {
  Loader2, CheckCircle2, AlertCircle, Copy, Check,
  ChevronDown, ChevronRight, Play, PlayCircle, Download,
  Search, TrendingUp, FileText, Code2, Bot, Shield, Sparkles,
} from 'lucide-react';
import type { SeoAnalysisSection } from '@/app/api/seo-analysis/route';

type Status = 'idle' | 'running' | 'done' | 'error';
interface SectionState { status: Status; output: unknown; error: string; }

const SECTIONS: Array<{
  id: SeoAnalysisSection;
  icon: React.ElementType;
  emoji: string;
  label: string;
  tagline: string;
  delivers: string[];
  color: string;
}> = [
  {
    id: 'keywords', icon: Search, emoji: '🔑', label: 'Keyword Intelligence',
    tagline: 'Generates 200+ keywords across every intent, market, and pain point — Nigerian-specific and global',
    delivers: ['Primary keywords (15+)', 'Nigeria local terms', 'vs Fiverr/Upwork/Apollo', 'AI platform queries (Claude/ChatGPT)', 'Long-tail quick wins (15+)', '20+ content topics'],
    color: 'blue',
  },
  {
    id: 'competitors', icon: Shield, emoji: '🎯', label: 'Competitor Analysis',
    tagline: 'Identifies every gap Apollo.io, Fiverr, Upwork and Hunter.io leave open for Runvax to own',
    delivers: ['Content gaps per competitor', 'Comparison page briefs', 'Content moats you can own', 'Link-worthy targets', 'SERP feature opportunities'],
    color: 'red',
  },
  {
    id: 'content', icon: FileText, emoji: '📝', label: 'Content Strategy',
    tagline: 'Full 12-week content calendar — pillar pages, blog posts, FAQ, landing pages, case studies, video scripts',
    delivers: ['5+ pillar page briefs', '12-week blog calendar', '20+ FAQ Q&As', 'City-specific landing pages', 'Case study angles', 'YouTube/TikTok scripts'],
    color: 'green',
  },
  {
    id: 'technical', icon: Code2, emoji: '⚙️', label: 'Technical SEO + GEO Assets',
    tagline: 'Ready-to-deploy meta tags, JSON-LD schemas, llms.txt, robots.txt, sitemap, Core Web Vitals plan',
    delivers: ['All page meta tags', '5 JSON-LD schemas', 'llms.txt (AI model discovery)', 'robots.txt', 'Sitemap structure', 'Core Web Vitals targets'],
    color: 'purple',
  },
  {
    id: 'geo', icon: Bot, emoji: '🤖', label: 'AI Platform Ranking (GEO)',
    tagline: 'Gets Runvax cited by Claude, ChatGPT, Perplexity, and Gemini when users ask about finding clients',
    delivers: ['Target prompts per AI platform', 'Entity definition for AI models', 'Community strategy (Nairaland, Reddit, Twitter)', 'PR angles for AI citation', 'ProductHunt launch strategy'],
    color: 'orange',
  },
  {
    id: 'authority', icon: TrendingUp, emoji: '🏆', label: 'Authority Building',
    tagline: '90-day backlink, partnership, and community plan to make Runvax the #1 name in African freelance tools',
    delivers: ['Backlink strategy by type', 'Directory listing targets', 'Partnership pitches', 'Nairaland strategy', 'Social media plan (Twitter/TikTok/LinkedIn)', '90-day week-by-week plan'],
    color: 'yellow',
  },
];

const COLORS: Record<string, { border: string; bg: string; text: string; badge: string; glow: string }> = {
  blue:   { border: 'border-blue-500/30',   bg: 'bg-blue-500/10',   text: 'text-blue-400',   badge: 'bg-blue-500/20 text-blue-300',   glow: 'shadow-blue-500/10' },
  red:    { border: 'border-red-500/30',    bg: 'bg-red-500/10',    text: 'text-red-400',    badge: 'bg-red-500/20 text-red-300',    glow: 'shadow-red-500/10' },
  green:  { border: 'border-green-500/30',  bg: 'bg-green-500/10',  text: 'text-green-400',  badge: 'bg-green-500/20 text-green-300',  glow: 'shadow-green-500/10' },
  purple: { border: 'border-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300', glow: 'shadow-purple-500/10' },
  orange: { border: 'border-orange-500/30', bg: 'bg-orange-500/10', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-300', glow: 'shadow-orange-500/10' },
  yellow: { border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', text: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-300', glow: 'shadow-yellow-500/10' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => {
      try { await navigator.clipboard.writeText(text); } catch { /* */ }
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }} className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
      copied ? 'bg-green-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'
    }`}>
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

function DownloadBtn({ content, filename }: { content: string; filename: string }) {
  return (
    <button onClick={() => {
      const blob = new Blob([content], { type: 'text/plain' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
      a.click();
    }} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 transition-colors">
      <Download className="w-3.5 h-3.5" /> Download
    </button>
  );
}

function Label({ text, color = 'gray' }: { text: string; color?: string }) {
  const c = color === 'blue' ? 'text-blue-400' : color === 'green' ? 'text-green-400' : color === 'orange' ? 'text-orange-400' : color === 'purple' ? 'text-purple-400' : color === 'red' ? 'text-red-400' : color === 'yellow' ? 'text-yellow-400' : 'text-gray-500';
  return <p className={`text-[10px] font-black uppercase tracking-widest ${c} mb-2`}>{text}</p>;
}

function Chip({ text }: { text: string }) {
  return <span className="text-xs bg-white/8 border border-white/10 text-gray-300 px-2.5 py-1 rounded-full">{text}</span>;
}

function IntentBadge({ intent }: { intent: string }) {
  const cfg: Record<string, string> = {
    transactional: 'bg-green-500/20 text-green-300 border-green-500/30',
    informational: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    commercial:    'bg-orange-500/20 text-orange-300 border-orange-500/30',
    navigational:  'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  return <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${cfg[intent] ?? cfg.informational}`}>{intent}</span>;
}

function DiffBadge({ d }: { d: string }) {
  const cfg: Record<string, string> = {
    easy:   'text-green-400',
    medium: 'text-yellow-400',
    hard:   'text-red-400',
  };
  return <span className={`text-[10px] font-bold ${cfg[d] ?? 'text-gray-500'}`}>{d === 'easy' ? '🟢' : d === 'medium' ? '🟡' : '🔴'} {d}</span>;
}

function VolBadge({ v }: { v: string }) {
  return <span className="text-[10px] text-gray-500">{v === 'high' ? '📈 High vol' : v === 'medium' ? '〰️ Med vol' : '🔹 Low vol'}</span>;
}

// ── Keyword table ─────────────────────────────────────────────────────────────

type KwRow = { keyword: string; intent: string; volume: string; difficulty: string; why: string };

function KeywordTable({ rows, title, color }: { rows: KwRow[]; title: string; color: string }) {
  const [open, setOpen] = useState(true);
  if (!rows?.length) return null;
  const allText = rows.map(r => r.keyword).join('\n');
  return (
    <div className="space-y-2">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 w-full text-left">
        <Label text={title} color={color} />
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 ${COLORS[color]?.badge ?? 'bg-white/10 text-gray-400'}`}>{rows.length}</span>
        {open ? <ChevronDown className="w-3 h-3 text-gray-600 ml-auto" /> : <ChevronRight className="w-3 h-3 text-gray-600 ml-auto" />}
      </button>
      {open && (
        <>
          <div className="space-y-1.5">
            {rows.map((r, i) => (
              <div key={i} className="bg-white/[0.025] border border-white/8 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm text-white font-semibold flex-1">{r.keyword}</span>
                  <IntentBadge intent={r.intent} />
                  <VolBadge v={r.volume} />
                  <DiffBadge d={r.difficulty} />
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{r.why}</p>
              </div>
            ))}
          </div>
          <CopyBtn text={allText} label={`Copy ${rows.length} keywords`} />
        </>
      )}
    </div>
  );
}

// ── Section output renderers ──────────────────────────────────────────────────

function KeywordsOutput({ data }: { data: Record<string, unknown> }) {
  const categories: Array<[string, string, string]> = [
    ['primaryKeywords',    'Primary Keywords',                   'blue'],
    ['noWebsiteNiche',     'No-Website Niche',                   'green'],
    ['outreachTools',      'Outreach Tools',                     'purple'],
    ['nigeriaLocal',       'Nigeria Local',                      'orange'],
    ['africanMarkets',     'African Markets',                    'yellow'],
    ['vsFiverr',           'vs Fiverr Keywords',                 'red'],
    ['vsUpwork',           'vs Upwork Keywords',                 'red'],
    ['vsApollo',           'vs Apollo.io Keywords',              'red'],
    ['aiOutreach',         'AI Outreach Keywords',               'purple'],
    ['whatsappMarketing',  'WhatsApp Marketing',                 'green'],
    ['clientAcquisition',  'Client Acquisition',                 'blue'],
    ['freelancerPain',     'Freelancer Pain Points',             'orange'],
    ['longTailQuickWins',  'Long-Tail Quick Wins',               'green'],
  ];

  const aiQueries = data.aiPlatformQueries as Array<{ query: string; platform: string; why: string }> | undefined;
  const quickWins = data.quickWins as Array<{ keyword: string; reason: string }> | undefined;
  const topics    = data.contentTopics as Array<{ title: string; targetKeyword: string; type: string; priority: string }> | undefined;

  const allKeywords = categories.flatMap(([key]) => {
    const rows = data[key] as KwRow[] | undefined;
    return rows?.map(r => r.keyword) ?? [];
  });

  return (
    <div className="space-y-6">
      {typeof data.summary === 'string' && (
        <div className="bg-blue-900/20 border border-blue-500/20 rounded-2xl p-4">
          <Label text="SEO Opportunity Summary" color="blue" />
          <p className="text-sm text-gray-200 leading-relaxed">{data.summary}</p>
        </div>
      )}

      <div className="flex gap-2">
        <CopyBtn text={allKeywords.join('\n')} label={`Copy all ${allKeywords.length} keywords`} />
        <DownloadBtn content={allKeywords.join('\n')} filename="runvax-keywords.txt" />
      </div>

      {categories.map(([key, title, color]) => (
        <KeywordTable key={key} rows={(data[key] as KwRow[]) ?? []} title={title} color={color} />
      ))}

      {aiQueries && aiQueries.length > 0 && (
        <div className="space-y-2">
          <Label text="🤖 AI Platform Queries (Claude/ChatGPT/Perplexity)" color="purple" />
          <div className="space-y-2">
            {aiQueries.map((q, i) => (
              <div key={i} className="bg-purple-500/8 border border-purple-500/15 rounded-xl px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-gray-200 leading-relaxed flex-1">"{q.query}"</p>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full flex-shrink-0">{q.platform}</span>
                </div>
                {q.why && <p className="text-[11px] text-gray-600 mt-1">{q.why}</p>}
              </div>
            ))}
          </div>
          <CopyBtn text={aiQueries.map(q => q.query).join('\n')} label="Copy all AI queries" />
        </div>
      )}

      {quickWins && quickWins.length > 0 && (
        <div className="space-y-2">
          <Label text="⚡ Quick Win Keywords (rank fast)" color="green" />
          <div className="space-y-2">
            {quickWins.map((q, i) => (
              <div key={i} className="flex gap-3 bg-green-500/5 border border-green-500/15 rounded-xl px-3 py-2.5">
                <span className="text-green-400 font-bold text-xs flex-shrink-0 mt-0.5">→</span>
                <div>
                  <p className="text-sm text-white font-semibold">{q.keyword}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{q.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {topics && topics.length > 0 && (
        <div className="space-y-2">
          <Label text="📄 Content Topics to Create" color="blue" />
          <div className="space-y-1.5">
            {topics.map((t, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/[0.025] border border-white/8 rounded-xl px-3 py-2.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${
                  t.priority === 'high' ? 'bg-red-500/20 text-red-300' : 'bg-gray-500/20 text-gray-400'
                }`}>{t.priority}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-semibold">{t.title}</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">{t.targetKeyword} · {t.type}</p>
                </div>
              </div>
            ))}
          </div>
          <DownloadBtn content={topics.map(t => `[${t.priority.toUpperCase()}] ${t.title}\nKeyword: ${t.targetKeyword}\nType: ${t.type}`).join('\n\n')} filename="content-topics.txt" />
        </div>
      )}
    </div>
  );
}

function CompetitorsOutput({ data }: { data: Record<string, unknown> }) {
  type Gap = { competitor: string; gap: string; opportunity: string; difficulty: string };
  type CPage = { slug: string; h1: string; targetKeyword: string; whyWeWin: string; priority: string };
  type Link = { site: string; url?: string; strategy: string; why: string; da?: string };
  type Serp = { keyword: string; feature: string; howToCapture: string };
  type Moat = { topic: string; reason: string; format: string };
  const gaps   = data.competitorGaps as Gap[] | undefined;
  const pages  = data.comparisonPages as CPage[] | undefined;
  const moats  = data.contentMoats as Moat[] | undefined;
  const links  = data.linkTargets as Link[] | undefined;
  const serp   = data.serpFeatures as Serp[] | undefined;
  const neg    = data.negativeKeywords as string[] | undefined;

  return (
    <div className="space-y-6">
      {gaps && gaps.length > 0 && (
        <div className="space-y-2">
          <Label text="Competitor Content Gaps" color="red" />
          {gaps.map((g, i) => (
            <div key={i} className="bg-white/[0.025] border border-white/8 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">{g.competitor}</span>
                <DiffBadge d={g.difficulty} />
              </div>
              <p className="text-xs text-white font-semibold">{g.gap}</p>
              <p className="text-xs text-green-400 leading-relaxed">→ {g.opportunity}</p>
            </div>
          ))}
        </div>
      )}
      {pages && pages.length > 0 && (
        <div className="space-y-2">
          <Label text="Comparison Landing Pages to Build" color="orange" />
          {pages.map((p, i) => (
            <div key={i} className="bg-white/[0.025] border border-white/8 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs font-mono text-gray-500">/{p.slug}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.priority === 'high' ? 'bg-red-500/20 text-red-300' : 'bg-gray-500/20 text-gray-400'}`}>{p.priority}</span>
              </div>
              <p className="text-sm text-white font-semibold">{p.h1}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Keyword: {p.targetKeyword}</p>
              <p className="text-xs text-green-400 mt-1 leading-relaxed">{p.whyWeWin}</p>
            </div>
          ))}
          <CopyBtn text={pages.map(p => `/${p.slug}\n${p.h1}\n${p.targetKeyword}`).join('\n\n')} label="Copy page list" />
        </div>
      )}
      {moats && moats.length > 0 && (
        <div className="space-y-2">
          <Label text="Content Moats (yours to own)" color="purple" />
          {moats.map((m, i) => (
            <div key={i} className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-3">
              <p className="text-sm text-white font-semibold">{m.topic}</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{m.reason}</p>
              <span className="text-[10px] text-purple-400 mt-1 block">Format: {m.format}</span>
            </div>
          ))}
        </div>
      )}
      {links && links.length > 0 && (
        <div className="space-y-2">
          <Label text="Link Acquisition Targets" color="blue" />
          {links.map((l, i) => (
            <div key={i} className="flex gap-3 bg-white/[0.025] border border-white/8 rounded-xl px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-semibold">{l.site}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{l.strategy}{l.da ? ` · DA ~${l.da}` : ''}</p>
                <p className="text-[11px] text-gray-600 mt-0.5">{l.why}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {serp && serp.length > 0 && (
        <div className="space-y-2">
          <Label text="SERP Feature Opportunities" color="green" />
          {serp.map((s, i) => (
            <div key={i} className="bg-green-500/5 border border-green-500/15 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-white font-semibold">{s.keyword}</p>
                <Chip text={s.feature} />
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{s.howToCapture}</p>
            </div>
          ))}
        </div>
      )}
      {neg && neg.length > 0 && (
        <div className="space-y-2">
          <Label text="Keywords to Avoid (wrong audience)" color="red" />
          <div className="flex flex-wrap gap-2">{neg.map((k, i) => <span key={i} className="text-xs bg-red-500/10 border border-red-500/20 text-red-400 px-2.5 py-1 rounded-full line-through">{k}</span>)}</div>
        </div>
      )}
    </div>
  );
}

function ContentOutput({ data }: { data: Record<string, unknown> }) {
  type Pillar = { title: string; slug: string; targetKeyword: string; wordCount: number; sections: string[]; internalLinks: string[] };
  type Blog = { week: number; title: string; slug: string; keyword: string; type: string; wordCount: number; hook: string };
  type Faq = { question: string; answer: string; keyword: string };
  type LP = { url: string; headline: string; targetAudience: string; primaryKeyword: string; cta: string };
  type Video = { title: string; hook: string; keyword: string; platform: string };
  const pillars = data.pillarPages as Pillar[] | undefined;
  const blog    = data.blogCalendar as Blog[] | undefined;
  const faq     = data.faqContent as Faq[] | undefined;
  const lps     = data.landingPages as LP[] | undefined;
  const videos  = data.videoScripts as Video[] | undefined;

  return (
    <div className="space-y-6">
      {pillars && pillars.length > 0 && (
        <div className="space-y-2">
          <Label text="Pillar Pages (cornerstone content)" color="green" />
          {pillars.map((p, i) => (
            <div key={i} className="bg-white/[0.025] border border-white/8 rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-white font-bold">{p.title}</p>
                <Chip text={`${p.wordCount}w`} />
              </div>
              <p className="text-[11px] font-mono text-gray-600">/{p.slug} · {p.targetKeyword}</p>
              <div className="flex flex-wrap gap-1.5">{p.sections?.map((s, j) => <span key={j} className="text-[10px] bg-white/5 border border-white/8 text-gray-500 px-2 py-0.5 rounded-full">{s}</span>)}</div>
            </div>
          ))}
        </div>
      )}
      {blog && blog.length > 0 && (
        <div className="space-y-2">
          <Label text="12-Week Blog Calendar" color="blue" />
          {blog.map((b, i) => (
            <div key={i} className="flex gap-3 border-b border-white/5 pb-2">
              <span className="text-[10px] font-black text-gray-600 w-10 flex-shrink-0 mt-1">Wk {b.week}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-semibold leading-snug">{b.title}</p>
                <p className="text-[11px] text-gray-600 mt-0.5">{b.keyword} · {b.type} · {b.wordCount}w</p>
                {b.hook && <p className="text-[11px] text-gray-500 mt-0.5 italic">"{b.hook}"</p>}
              </div>
            </div>
          ))}
          <DownloadBtn content={blog.map(b => `Week ${b.week}: ${b.title}\nKeyword: ${b.keyword}\nType: ${b.type} | ${b.wordCount}w\nHook: ${b.hook}`).join('\n\n')} filename="blog-calendar.txt" />
        </div>
      )}
      {faq && faq.length > 0 && (
        <div className="space-y-2">
          <Label text="FAQ Content (Google PAA + AI citations)" color="purple" />
          {faq.map((f, i) => (
            <div key={i} className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-3 space-y-1">
              <p className="text-xs text-white font-semibold">Q: {f.question}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{f.answer}</p>
              {f.keyword && <p className="text-[10px] text-purple-400">Keyword: {f.keyword}</p>}
            </div>
          ))}
          <div className="flex gap-2 mt-1">
            <CopyBtn text={faq.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')} label="Copy all FAQs" />
            <DownloadBtn content={faq.map(f => `**Q: ${f.question}**\n${f.answer}`).join('\n\n')} filename="faq.md" />
          </div>
        </div>
      )}
      {lps && lps.length > 0 && (
        <div className="space-y-2">
          <Label text="Landing Pages to Build" color="orange" />
          {lps.map((l, i) => (
            <div key={i} className="bg-white/[0.025] border border-white/8 rounded-xl p-3">
              <p className="text-[11px] font-mono text-gray-500 mb-1">{l.url}</p>
              <p className="text-sm text-white font-bold">{l.headline}</p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-[10px] text-gray-600">{l.targetAudience}</span>
                <Chip text={l.primaryKeyword} />
              </div>
              <p className="text-xs text-green-400 mt-1">CTA: {l.cta}</p>
            </div>
          ))}
        </div>
      )}
      {videos && videos.length > 0 && (
        <div className="space-y-2">
          <Label text="Video Scripts" color="red" />
          {videos.map((v, i) => (
            <div key={i} className="bg-red-500/5 border border-red-500/15 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-white font-semibold flex-1">{v.title}</p>
                <Chip text={v.platform} />
              </div>
              <p className="text-[11px] text-gray-400">Keyword: {v.keyword}</p>
              <p className="text-xs text-gray-300 mt-2 italic leading-relaxed">"{v.hook}"</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TechnicalOutput({ data }: { data: Record<string, unknown> }) {
  const meta    = data.metaTags as Record<string, Record<string, string>> | undefined;
  const schema  = data.schemaMarkup as Record<string, string> | undefined;
  const llms    = data.llmsTxt as string | undefined;
  const robots  = data.robotsTxt as string | undefined;
  const sitemap = data.sitemapStructure as Array<{ url: string; priority: string; changefreq: string; why: string }> | undefined;
  const cwv     = data.coreWebVitals as Array<{ metric: string; target: string; tip: string }> | undefined;

  return (
    <div className="space-y-6">
      {llms && (
        <div className="space-y-2">
          <Label text="🤖 llms.txt — AI Model Discovery (Deploy to /llms.txt)" color="purple" />
          <div className="bg-purple-950/30 border border-purple-500/25 rounded-xl p-4">
            <pre className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">{llms}</pre>
          </div>
          <div className="flex gap-2">
            <CopyBtn text={llms} />
            <DownloadBtn content={llms} filename="llms.txt" />
          </div>
        </div>
      )}
      {schema && (
        <div className="space-y-2">
          <Label text="JSON-LD Schema Markup" color="blue" />
          {Object.entries(schema).map(([k, v]) => (
            <div key={k} className="bg-gray-950 border border-white/8 rounded-xl p-3 mb-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-blue-400 uppercase">{k}</p>
                <div className="flex gap-2">
                  <CopyBtn text={v} label="Copy" />
                  <DownloadBtn content={v} filename={`${k}.json`} />
                </div>
              </div>
              <pre className="text-xs text-gray-500 font-mono whitespace-pre-wrap line-clamp-5">{v}</pre>
            </div>
          ))}
        </div>
      )}
      {meta && (
        <div className="space-y-2">
          <Label text="Meta Tags — All Pages" color="green" />
          {Object.entries(meta).map(([page, tags]) => (
            <div key={page} className="bg-white/[0.025] border border-white/8 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-mono font-bold text-gray-500">/{page}</p>
                <CopyBtn text={Object.entries(tags).map(([k, v]) => `${k}: ${v}`).join('\n')} />
              </div>
              {Object.entries(tags).map(([k, v]) => (
                <p key={k} className="text-[11px] text-gray-400 leading-relaxed"><span className="text-gray-600">{k}:</span> {v}</p>
              ))}
            </div>
          ))}
        </div>
      )}
      {robots && (
        <div className="space-y-2">
          <Label text="robots.txt" />
          <div className="bg-gray-950 border border-white/8 rounded-xl p-3">
            <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">{robots}</pre>
          </div>
          <div className="flex gap-2"><CopyBtn text={robots} /><DownloadBtn content={robots} filename="robots.txt" /></div>
        </div>
      )}
      {sitemap && sitemap.length > 0 && (
        <div className="space-y-2">
          <Label text="Sitemap Structure" />
          {sitemap.map((s, i) => (
            <div key={i} className="flex items-start gap-3 text-xs text-gray-400 border-b border-white/5 pb-1.5">
              <span className="font-mono text-blue-400 flex-1 text-[11px]">{s.url}</span>
              <span className="text-gray-600 flex-shrink-0">{s.priority}</span>
              <span className="text-gray-600 flex-shrink-0">{s.changefreq}</span>
            </div>
          ))}
        </div>
      )}
      {cwv && cwv.length > 0 && (
        <div className="space-y-2">
          <Label text="Core Web Vitals Targets" color="green" />
          {cwv.map((c, i) => (
            <div key={i} className="bg-green-500/5 border border-green-500/15 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black text-white">{c.metric}</span>
                <Chip text={c.target} />
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{c.tip}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GeoOutput({ data }: { data: Record<string, unknown> }) {
  type TPrompt = { prompt: string; platform: string; currentLikelyAnswer: string; howWeCapture: string };
  type Community = { platform: string; tactic: string; samplePost: string };
  type PR = { outlet: string; angle: string; why: string };
  type ContentFmt = { format: string; why: string; example: string };
  type Entity = { entityDefinition: string; attributesToEstablish: string[]; mentionSources: string[] };
  type PH = { timing: string; tagline: string; description: string; makerComment: string; hunterApproach: string };
  const prompts = data.targetPrompts as TPrompt[] | undefined;
  const entity  = data.entityOptimization as Entity | undefined;
  const formats = data.contentFormats as ContentFmt[] | undefined;
  const community = data.communityStrategy as Community[] | undefined;
  const pr      = data.prStrategy as PR[] | undefined;
  const ph      = data.productHuntStrategy as PH | undefined;

  return (
    <div className="space-y-6">
      {typeof data.geoSummary === 'string' && (
        <div className="bg-orange-900/20 border border-orange-500/20 rounded-2xl p-4">
          <Label text="GEO Opportunity" color="orange" />
          <p className="text-sm text-gray-200 leading-relaxed">{data.geoSummary}</p>
        </div>
      )}
      {entity && (
        <div className="space-y-3">
          <Label text="Entity Optimization (how AI models should know Runvax)" color="purple" />
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
            <p className="text-xs text-gray-200 leading-relaxed italic">{entity.entityDefinition}</p>
          </div>
          <CopyBtn text={entity.entityDefinition} label="Copy entity definition" />
          {entity.attributesToEstablish?.length > 0 && (
            <div className="flex flex-wrap gap-2">{entity.attributesToEstablish.map((a, i) => <Chip key={i} text={a} />)}</div>
          )}
          {entity.mentionSources?.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-600 uppercase font-bold mb-2">Get mentioned on:</p>
              <ul className="space-y-1">{entity.mentionSources.map((s, i) => <li key={i} className="text-xs text-gray-400 flex gap-2"><span className="text-orange-400">→</span>{s}</li>)}</ul>
            </div>
          )}
        </div>
      )}
      {prompts && prompts.length > 0 && (
        <div className="space-y-2">
          <Label text="Target AI Prompts (get cited in these answers)" color="orange" />
          {prompts.map((p, i) => (
            <div key={i} className="bg-white/[0.025] border border-white/8 rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-[10px] bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full flex-shrink-0">{p.platform}</span>
                <p className="text-xs text-white font-semibold">"{p.prompt}"</p>
              </div>
              <p className="text-[11px] text-gray-500">Currently: {p.currentLikelyAnswer}</p>
              <p className="text-xs text-green-400 leading-relaxed">→ {p.howWeCapture}</p>
            </div>
          ))}
        </div>
      )}
      {formats && formats.length > 0 && (
        <div className="space-y-2">
          <Label text="Content Formats AI Models Cite" color="blue" />
          {formats.map((f, i) => (
            <div key={i} className="flex gap-3 bg-blue-500/5 border border-blue-500/15 rounded-xl px-3 py-2.5">
              <Chip text={f.format} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-300 leading-relaxed">{f.why}</p>
                <p className="text-[11px] text-gray-600 mt-0.5 italic">e.g. {f.example}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {community && community.length > 0 && (
        <div className="space-y-2">
          <Label text="Community Strategy" color="green" />
          {community.map((c, i) => (
            <div key={i} className="bg-white/[0.025] border border-white/8 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Chip text={c.platform} />
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">{c.tactic}</p>
              <div className="bg-green-950/30 border border-green-500/15 rounded-lg px-3 py-2">
                <p className="text-[11px] text-gray-400 italic">"{c.samplePost}"</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {pr && pr.length > 0 && (
        <div className="space-y-2">
          <Label text="PR Strategy (get covered = get cited by AI)" color="red" />
          {pr.map((p, i) => (
            <div key={i} className="bg-white/[0.025] border border-white/8 rounded-xl p-3">
              <p className="text-xs text-white font-semibold mb-1">{p.outlet}</p>
              <p className="text-xs text-gray-300 leading-relaxed">{p.angle}</p>
              <p className="text-[11px] text-gray-600 mt-1">{p.why}</p>
            </div>
          ))}
        </div>
      )}
      {ph && (
        <div className="space-y-2">
          <Label text="🚀 ProductHunt Launch Strategy" color="orange" />
          <div className="bg-orange-500/8 border border-orange-500/20 rounded-xl p-4 space-y-3">
            <p className="text-[10px] text-gray-500 font-bold">TIMING</p>
            <p className="text-xs text-white">{ph.timing}</p>
            <p className="text-[10px] text-gray-500 font-bold mt-2">TAGLINE</p>
            <p className="text-sm text-white font-bold">{ph.tagline}</p>
            <p className="text-[10px] text-gray-500 font-bold mt-2">DESCRIPTION</p>
            <p className="text-xs text-gray-300 leading-relaxed">{ph.description}</p>
            <p className="text-[10px] text-gray-500 font-bold mt-2">MAKER COMMENT</p>
            <p className="text-xs text-gray-400 italic leading-relaxed">{ph.makerComment}</p>
          </div>
          <CopyBtn text={`Tagline: ${ph.tagline}\n\n${ph.description}\n\nMaker comment:\n${ph.makerComment}`} label="Copy PH post" />
        </div>
      )}
    </div>
  );
}

function AuthorityOutput({ data }: { data: Record<string, unknown> }) {
  type BLink = { type: string; target: string; url?: string; da?: string; tactic: string; nigeriaRelevance: string };
  type Dir = { directory: string; url?: string; category: string; why: string };
  type Partner = { partner: string; type: string; pitch: string; benefit: string };
  type Week = { week: string; actions: string[]; expectedOutcome: string };
  type Metric = { metric: string; target30d: string; target90d: string; howToMeasure: string };
  type Social = { strategy: string; hashtags?: string[]; postFrequency?: string; contentMix?: string; targetGroups?: string[] };
  type Nairaland = { sections: string[]; postTypes: string[]; sampleThread: string };

  const links    = data.backlinkStrategy as BLink[] | undefined;
  const dirs     = data.directoryListings as Dir[] | undefined;
  const partners = data.partnershipTargets as Partner[] | undefined;
  const plan     = data.ninetydayPlan as Week[] | undefined;
  const metrics  = data.metrics as Metric[] | undefined;
  const social   = data.socialSignals as Record<string, Social> | undefined;
  const naira    = data.nairalandStrategy as Nairaland | undefined;

  return (
    <div className="space-y-6">
      {plan && plan.length > 0 && (
        <div className="space-y-2">
          <Label text="90-Day Action Plan" color="yellow" />
          {plan.map((w, i) => (
            <div key={i} className="bg-white/[0.025] border border-white/8 rounded-xl p-3">
              <div className="flex items-start gap-3">
                <span className="text-[10px] font-black text-yellow-400 w-12 flex-shrink-0 mt-0.5">Wk {w.week}</span>
                <div className="flex-1 min-w-0">
                  <ul className="space-y-1 mb-2">{w.actions?.map((a, j) => <li key={j} className="text-xs text-gray-300 flex gap-1.5"><span className="text-yellow-400 flex-shrink-0">·</span>{a}</li>)}</ul>
                  <p className="text-[11px] text-green-400">{w.expectedOutcome}</p>
                </div>
              </div>
            </div>
          ))}
          <DownloadBtn content={plan.map(w => `Week ${w.week}:\n${w.actions?.map(a => `  - ${a}`).join('\n')}\nOutcome: ${w.expectedOutcome}`).join('\n\n')} filename="90-day-plan.txt" />
        </div>
      )}
      {links && links.length > 0 && (
        <div className="space-y-2">
          <Label text="Backlink Strategy" color="blue" />
          {links.map((l, i) => (
            <div key={i} className="bg-white/[0.025] border border-white/8 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Chip text={l.type} />
                {l.da && <span className="text-[10px] text-gray-500">DA ~{l.da}</span>}
              </div>
              <p className="text-xs text-white font-semibold">{l.target}</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{l.tactic}</p>
              <p className="text-[11px] text-gray-600 mt-0.5">{l.nigeriaRelevance}</p>
            </div>
          ))}
        </div>
      )}
      {dirs && dirs.length > 0 && (
        <div className="space-y-2">
          <Label text="Directory Listings" color="green" />
          <div className="space-y-1.5">{dirs.map((d, i) => (
            <div key={i} className="flex gap-3 bg-white/[0.025] border border-white/8 rounded-xl px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-semibold">{d.directory}</p>
                <p className="text-[11px] text-gray-500">{d.category} · {d.why}</p>
              </div>
            </div>
          ))}</div>
        </div>
      )}
      {partners && partners.length > 0 && (
        <div className="space-y-2">
          <Label text="Partnership Targets" color="purple" />
          {partners.map((p, i) => (
            <div key={i} className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1"><p className="text-xs text-white font-semibold">{p.partner}</p><Chip text={p.type} /></div>
              <p className="text-xs text-gray-400 leading-relaxed">{p.pitch}</p>
              <p className="text-[11px] text-green-400 mt-1">↑ {p.benefit}</p>
            </div>
          ))}
        </div>
      )}
      {naira && (
        <div className="space-y-2">
          <Label text="Nairaland Strategy" color="orange" />
          <div className="bg-orange-500/8 border border-orange-500/20 rounded-xl p-4 space-y-3">
            <div><p className="text-[10px] text-gray-500 font-bold mb-1">SECTIONS TO TARGET</p><div className="flex flex-wrap gap-2">{naira.sections?.map((s, i) => <Chip key={i} text={s} />)}</div></div>
            <div><p className="text-[10px] text-gray-500 font-bold mb-1">POST TYPES</p><ul className="space-y-1">{naira.postTypes?.map((p, i) => <li key={i} className="text-xs text-gray-400">· {p}</li>)}</ul></div>
            {naira.sampleThread && <div><p className="text-[10px] text-gray-500 font-bold mb-1">SAMPLE VIRAL THREAD</p><p className="text-xs text-white font-semibold">{naira.sampleThread}</p></div>}
          </div>
        </div>
      )}
      {social && (
        <div className="space-y-2">
          <Label text="Social Media Strategy" color="blue" />
          {Object.entries(social).map(([platform, s]) => (
            <div key={platform} className="bg-white/[0.025] border border-white/8 rounded-xl p-3">
              <p className="text-xs font-bold text-white capitalize mb-1">{platform}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{s.strategy}</p>
              {s.hashtags && <div className="flex flex-wrap gap-1.5 mt-2">{s.hashtags.map((h, i) => <span key={i} className="text-[10px] text-blue-400">#{h}</span>)}</div>}
            </div>
          ))}
        </div>
      )}
      {metrics && metrics.length > 0 && (
        <div className="space-y-2">
          <Label text="Success Metrics" color="green" />
          <div className="grid grid-cols-2 gap-2">
            {metrics.map((m, i) => (
              <div key={i} className="bg-green-500/5 border border-green-500/15 rounded-xl p-3">
                <p className="text-[10px] text-gray-500 font-bold mb-1">{m.metric}</p>
                <p className="text-xs text-white font-semibold">{m.target90d} <span className="text-gray-600 font-normal text-[10px]">by day 90</span></p>
                <p className="text-[10px] text-gray-600 mt-0.5">{m.target30d} by day 30</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function renderOutput(id: SeoAnalysisSection, output: unknown) {
  const d = output as Record<string, unknown>;
  switch (id) {
    case 'keywords':    return <KeywordsOutput    data={d} />;
    case 'competitors': return <CompetitorsOutput data={d} />;
    case 'content':     return <ContentOutput     data={d} />;
    case 'technical':   return <TechnicalOutput   data={d} />;
    case 'geo':         return <GeoOutput         data={d} />;
    case 'authority':   return <AuthorityOutput   data={d} />;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SeoAnalysisPage() {
  const [states, setStates] = useState<Record<SeoAnalysisSection, SectionState>>({
    keywords:    { status: 'idle', output: null, error: '' },
    competitors: { status: 'idle', output: null, error: '' },
    content:     { status: 'idle', output: null, error: '' },
    technical:   { status: 'idle', output: null, error: '' },
    geo:         { status: 'idle', output: null, error: '' },
    authority:   { status: 'idle', output: null, error: '' },
  });
  const [expanded, setExpanded] = useState<Record<SeoAnalysisSection, boolean>>({
    keywords: false, competitors: false, content: false, technical: false, geo: false, authority: false,
  });
  const [runningAll, setRunningAll] = useState(false);

  const setSection = useCallback((id: SeoAnalysisSection, patch: Partial<SectionState>) =>
    setStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } })), []);

  const runSection = useCallback(async (section: SeoAnalysisSection): Promise<void> => {
    setSection(section, { status: 'running', error: '' });
    try {
      const res = await fetch('/api/seo-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section }),
      });
      let json: Record<string, unknown> = {};
      try { json = await res.json(); } catch { /* */ }
      if (!res.ok) throw new Error((json.error as string) || `Error ${res.status}`);
      setSection(section, { status: 'done', output: json.result });
      setExpanded(prev => ({ ...prev, [section]: true }));
    } catch (e) {
      setSection(section, { status: 'error', error: e instanceof Error ? e.message : 'Failed' });
    }
  }, [setSection]);

  const runAll = async () => {
    setRunningAll(true);
    await Promise.all(SECTIONS.map(s => runSection(s.id)));
    setRunningAll(false);
  };

  const anyRunning = Object.values(states).some(s => s.status === 'running');
  const allDone    = Object.values(states).every(s => s.status === 'done');
  const doneCount  = Object.values(states).filter(s => s.status === 'done').length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <a href="/growth" className="text-xs text-gray-600 hover:text-gray-400 transition-colors mb-4 block">← Back to Growth</a>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-900/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">World-Class SEO Analysis</h1>
              <p className="text-sm text-gray-500">6 agents · 200+ keywords · full deployment assets</p>
            </div>
          </div>
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/20 border border-blue-500/20 rounded-2xl p-4">
            <p className="text-sm text-gray-300 leading-relaxed">
              Six specialist agents analyse every dimension of Runvax's SEO opportunity — keywords, competitors, content, technical assets, AI platform ranking (GEO), and authority building. All run simultaneously. Output is production-ready: copy, download, and deploy.
            </p>
          </div>
        </div>

        {/* Progress */}
        {doneCount > 0 && (
          <div className="mb-4 flex items-center gap-3">
            <div className="flex-1 bg-white/5 rounded-full h-1.5">
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${(doneCount / SECTIONS.length) * 100}%` }} />
            </div>
            <span className="text-xs text-gray-500 flex-shrink-0">{doneCount}/{SECTIONS.length} complete</span>
          </div>
        )}

        {/* Run All */}
        <button
          onClick={runAll}
          disabled={anyRunning || runningAll}
          className="w-full flex items-center justify-center gap-2.5 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-2xl transition-all disabled:opacity-60 text-sm shadow-xl shadow-purple-900/30 mb-6"
        >
          {runningAll || anyRunning
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <PlayCircle className="w-5 h-5" />}
          {runningAll || anyRunning
            ? `Analysing… (${doneCount}/${SECTIONS.length} done)`
            : allDone ? '🔄 Re-run Full Analysis' : '🚀 Run Full SEO Analysis'}
        </button>

        {/* Section cards */}
        <div className="space-y-4">
          {SECTIONS.map((section) => {
            const state  = states[section.id];
            const colors = COLORS[section.color];
            const isOpen = expanded[section.id];
            const Icon   = section.icon;

            return (
              <div key={section.id} className={`border rounded-2xl overflow-hidden transition-all ${
                state.status === 'done'    ? `${colors.border} bg-white/[0.02]`    :
                state.status === 'error'   ? 'border-red-500/25 bg-red-950/10'     :
                state.status === 'running' ? `${colors.border} bg-white/[0.02]`    :
                'border-white/8 bg-white/[0.02]'
              }`}>

                <div className="flex items-start gap-4 px-5 py-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${state.status === 'done' ? colors.bg : 'bg-white/5'}`}>
                    {state.status === 'running'
                      ? <Loader2 className={`w-5 h-5 animate-spin ${colors.text}`} />
                      : state.status === 'done'
                      ? <CheckCircle2 className={`w-5 h-5 ${colors.text}`} />
                      : state.status === 'error'
                      ? <AlertCircle className="w-5 h-5 text-red-400" />
                      : <Icon className="w-5 h-5 text-gray-600" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-black text-white">{section.emoji} {section.label}</span>
                      {state.status === 'done' && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>Done</span>}
                      {state.status === 'running' && <span className="text-[10px] text-gray-500 animate-pulse">Analysing…</span>}
                    </div>
                    <p className="text-xs text-gray-500 leading-snug mb-2">{section.tagline}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {section.delivers.map((d, i) => (
                        <span key={i} className="text-[10px] bg-white/5 border border-white/8 text-gray-500 px-2 py-0.5 rounded-full">{d}</span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                    {(state.status === 'idle' || state.status === 'error') && (
                      <button onClick={() => runSection(section.id)}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${colors.bg} ${colors.text} ${colors.border} hover:opacity-80`}>
                        <Play className="w-3 h-3" />
                        {state.status === 'error' ? 'Retry' : 'Run'}
                      </button>
                    )}
                    {state.status === 'done' && (
                      <>
                        <button onClick={() => runSection(section.id)} className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">Re-run</button>
                        <button onClick={() => setExpanded(prev => ({ ...prev, [section.id]: !prev[section.id] }))}>
                          {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {state.status === 'error' && (
                  <div className="px-5 pb-3 text-xs text-red-400">{state.error}</div>
                )}

                {state.status === 'done' && isOpen && state.output != null && (
                  <div className="border-t border-white/8 px-5 py-5">
                    {renderOutput(section.id, state.output)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
