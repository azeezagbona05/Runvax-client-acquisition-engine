'use client';

import { useState, useCallback } from 'react';
import {
  Loader2, CheckCircle2, AlertCircle, Copy, Check,
  ChevronDown, ChevronRight, Play, PlayCircle, Download,
  TrendingUp, Search, Megaphone, PenTool, Code2, Sparkles,
} from 'lucide-react';
import type { SeoAgentType } from '@/app/api/seo-agents/route';

type AgentStatus = 'idle' | 'running' | 'done' | 'error';
interface AgentState { status: AgentStatus; output: unknown; error: string; }

const AGENTS: Array<{
  id: SeoAgentType; icon: React.ElementType; emoji: string;
  label: string; tagline: string; delivers: string[]; color: string;
}> = [
  {
    id: 'researcher', icon: Search, emoji: '🔬', label: 'Researcher',
    tagline: 'Finds every keyword and question people use to find tools like yours',
    delivers: ['Google keyword list', 'AI platform query list', 'Competitor gaps', 'Community targets'],
    color: 'blue',
  },
  {
    id: 'strategist', icon: TrendingUp, emoji: '🧠', label: 'Strategist',
    tagline: 'Plans the 90-day roadmap to rank on Google and get cited by AI assistants',
    delivers: ['Quick wins list', '90-day content calendar', 'GEO tactics', 'Platform-by-platform strategy'],
    color: 'purple',
  },
  {
    id: 'marketer', icon: Megaphone, emoji: '📣', label: 'Marketer',
    tagline: 'Writes all positioning copy — homepage, meta tags, audience-specific messages',
    delivers: ['Hero headline', 'Meta title + description', 'Value props', 'AI entity definition'],
    color: 'orange',
  },
  {
    id: 'copywriter', icon: PenTool, emoji: '✍️', label: 'Copywriter',
    tagline: 'Writes SEO blog post, FAQ page, ProductHunt launch, Twitter thread',
    delivers: ['1500-word SEO blog post', 'FAQ page (AI-optimised)', 'ProductHunt post', 'Twitter thread'],
    color: 'green',
  },
  {
    id: 'builder', icon: Code2, emoji: '🏗️', label: 'Builder',
    tagline: 'Generates all technical SEO assets including schema, meta tags, and llms.txt',
    delivers: ['JSON-LD schema markup', 'All page meta tags', 'robots.txt', 'llms.txt for AI models'],
    color: 'cyan',
  },
];

const COLORS: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  blue:   { border: 'border-blue-500/30',   bg: 'bg-blue-500/10',   text: 'text-blue-400',   badge: 'bg-blue-500/20 text-blue-300' },
  purple: { border: 'border-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300' },
  orange: { border: 'border-orange-500/30', bg: 'bg-orange-500/10', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-300' },
  green:  { border: 'border-green-500/30',  bg: 'bg-green-500/10',  text: 'text-green-400',  badge: 'bg-green-500/20 text-green-300' },
  cyan:   { border: 'border-cyan-500/30',   bg: 'bg-cyan-500/10',   text: 'text-cyan-400',   badge: 'bg-cyan-500/20 text-cyan-300' },
};

function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { /* */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
      copied ? 'bg-green-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'
    }`}>
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

function DownloadBtn({ content, filename }: { content: string; filename: string }) {
  const download = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    a.click(); URL.revokeObjectURL(url);
  };
  return (
    <button onClick={download} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 transition-colors">
      <Download className="w-3.5 h-3.5" /> Download
    </button>
  );
}

function Section({ title, color = 'gray', children }: { title: string; color?: string; children: React.ReactNode }) {
  const tc = color === 'green' ? 'text-green-400' : color === 'blue' ? 'text-blue-400'
           : color === 'orange' ? 'text-orange-400' : color === 'red' ? 'text-red-400' : 'text-gray-400';
  return (
    <div className="space-y-2">
      <p className={`text-[10px] font-black uppercase tracking-widest ${tc}`}>{title}</p>
      {children}
    </div>
  );
}

function KeywordChip({ word }: { word: string }) {
  return <span className="text-xs bg-white/8 border border-white/10 text-gray-300 px-2.5 py-1 rounded-full">{word}</span>;
}

// ── Output renderers ──────────────────────────────────────────────────────────

function ResearcherOutput({ data }: { data: Record<string, unknown> }) {
  const kw = data.googleKeywords as Record<string, string[]> | undefined;
  const ai = data.aiPlatformQueries as string[] | undefined;
  const gaps = data.competitorGaps as string[] | undefined;
  const pain = data.painPointPhrases as string[] | undefined;
  const viral = data.viralAngles as string[] | undefined;
  const communities = data.communityTargets as string[] | undefined;
  return (
    <div className="space-y-5">
      {kw && (
        <Section title="Google Keywords" color="blue">
          {kw.highIntent && <div className="space-y-1.5"><p className="text-[10px] text-green-400 font-bold mb-1">High Intent</p><div className="flex flex-wrap gap-2">{kw.highIntent.map((k, i) => <KeywordChip key={i} word={k} />)}</div></div>}
          {kw.longTail && <div className="space-y-1.5 mt-3"><p className="text-[10px] text-blue-400 font-bold mb-1">Long Tail</p><div className="flex flex-wrap gap-2">{kw.longTail.map((k, i) => <KeywordChip key={i} word={k} />)}</div></div>}
          {kw.localNigeria && <div className="space-y-1.5 mt-3"><p className="text-[10px] text-orange-400 font-bold mb-1">Nigeria Local</p><div className="flex flex-wrap gap-2">{kw.localNigeria.map((k, i) => <KeywordChip key={i} word={k} />)}</div></div>}
        </Section>
      )}
      {ai && ai.length > 0 && (
        <Section title="🤖 Questions People Ask Claude / ChatGPT" color="purple">
          <ul className="space-y-2">{ai.map((q, i) => <li key={i} className="text-xs text-gray-300 bg-purple-500/8 border border-purple-500/15 rounded-xl px-3 py-2 leading-relaxed">"{q}"</li>)}</ul>
        </Section>
      )}
      {pain && pain.length > 0 && (
        <Section title="Pain Point Phrases (use in content)" color="orange">
          <div className="flex flex-wrap gap-2">{pain.map((p, i) => <KeywordChip key={i} word={p} />)}</div>
        </Section>
      )}
      {gaps && gaps.length > 0 && (
        <Section title="Competitor Content Gaps" color="green">
          <ul className="space-y-1">{gaps.map((g, i) => <li key={i} className="text-xs text-gray-300 flex gap-2"><span className="text-green-400 flex-shrink-0">→</span>{g}</li>)}</ul>
        </Section>
      )}
      {viral && viral.length > 0 && (
        <Section title="Viral Content Angles">
          <ul className="space-y-1">{viral.map((v, i) => <li key={i} className="text-xs text-gray-300 flex gap-2"><span className="text-yellow-400 flex-shrink-0">⚡</span>{v}</li>)}</ul>
        </Section>
      )}
      {communities && communities.length > 0 && (
        <Section title="Communities to Target">
          <ul className="space-y-1">{communities.map((c, i) => <li key={i} className="text-xs text-gray-300 flex gap-2"><span className="text-blue-400 flex-shrink-0">👥</span>{c}</li>)}</ul>
        </Section>
      )}
    </div>
  );
}

function StrategistOutput({ data }: { data: Record<string, unknown> }) {
  type CalEntry = { week: number; title: string; keyword: string; type: string };
  type QuickWin = { action: string; impact: string; timeframe: string };
  const quickWins = data.quickWins as QuickWin[] | undefined;
  const calendar  = data.contentCalendar as CalEntry[] | undefined;
  const geo       = data.geoTactics as string[] | undefined;
  const links     = data.linkBuildingTargets as string[] | undefined;
  const platform  = data.platformStrategy as Record<string, string> | undefined;
  const milestones = data.monthlyMilestones as Record<string, string> | undefined;
  return (
    <div className="space-y-5">
      {quickWins && quickWins.length > 0 && (
        <Section title="⚡ Quick Wins (Do First)" color="green">
          <div className="space-y-2">{quickWins.map((w, i) => (
            <div key={i} className="bg-green-500/8 border border-green-500/20 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-white font-semibold leading-snug">{w.action}</p>
                <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">{w.timeframe}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{w.impact}</p>
            </div>
          ))}</div>
        </Section>
      )}
      {geo && geo.length > 0 && (
        <Section title="🤖 GEO Tactics (Get Cited by AI)" color="purple">
          <ul className="space-y-2">{geo.map((g, i) => <li key={i} className="text-xs text-gray-300 bg-purple-500/8 border border-purple-500/15 rounded-xl px-3 py-2 leading-relaxed flex gap-2"><span className="text-purple-400 flex-shrink-0 font-bold">{i + 1}.</span>{g}</li>)}</ul>
        </Section>
      )}
      {calendar && calendar.length > 0 && (
        <Section title="📅 Content Calendar" color="blue">
          <div className="space-y-2">{calendar.map((c, i) => (
            <div key={i} className="flex items-start gap-3 text-xs border-b border-white/5 pb-2">
              <span className="text-[10px] font-black text-gray-600 w-12 flex-shrink-0 mt-0.5">Wk {c.week}</span>
              <div className="flex-1 min-w-0">
                <p className="text-gray-200 font-semibold leading-snug">{c.title}</p>
                <p className="text-gray-500 mt-0.5">{c.keyword}</p>
              </div>
              <span className="text-[10px] bg-white/10 text-gray-400 px-2 py-0.5 rounded-full flex-shrink-0">{c.type}</span>
            </div>
          ))}</div>
        </Section>
      )}
      {platform && (
        <Section title="Platform Strategy">
          <div className="grid grid-cols-1 gap-2">{Object.entries(platform).map(([k, v]) => (
            <div key={k} className="bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">{k}</p>
              <p className="text-xs text-gray-300 leading-relaxed">{v}</p>
            </div>
          ))}</div>
        </Section>
      )}
      {links && links.length > 0 && (
        <Section title="Link Building Targets">
          <div className="flex flex-wrap gap-2">{links.map((l, i) => <KeywordChip key={i} word={l} />)}</div>
        </Section>
      )}
      {milestones && (
        <Section title="Monthly Milestones" color="orange">
          <div className="grid grid-cols-3 gap-2">{Object.entries(milestones).map(([k, v]) => (
            <div key={k} className="bg-orange-500/8 border border-orange-500/20 rounded-xl p-3">
              <p className="text-[10px] font-bold text-orange-400 uppercase mb-1">{k}</p>
              <p className="text-xs text-gray-300 leading-relaxed">{v}</p>
            </div>
          ))}</div>
        </Section>
      )}
    </div>
  );
}

function MarketerOutput({ data }: { data: Record<string, unknown> }) {
  const vp = data.valueProps as Array<{ headline: string; body: string }> | undefined;
  const am = data.audienceMessages as Record<string, string> | undefined;
  const ch = data.comparisonHeadlines as Record<string, string> | undefined;
  return (
    <div className="space-y-5">
      <Section title="Homepage Hero Copy" color="orange">
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-[10px] text-gray-500 font-bold mb-1">HEADLINE</p>
            <p className="text-white text-lg font-black leading-tight">{data.heroHeadline as string}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold mb-1">SUB-HEADLINE</p>
            <p className="text-gray-300 text-sm leading-relaxed">{data.subHeadline as string}</p>
          </div>
          <CopyBtn text={`${data.heroHeadline}\n\n${data.subHeadline}`} label="Copy hero" />
        </div>
      </Section>
      <Section title="SEO Meta Tags" color="blue">
        <div className="bg-gray-950 border border-white/10 rounded-xl p-3 space-y-2 font-mono text-xs">
          <p><span className="text-gray-500">title: </span><span className="text-green-400">"{data.metaTitle as string}"</span></p>
          <p><span className="text-gray-500">description: </span><span className="text-blue-400">"{data.metaDescription as string}"</span></p>
        </div>
        <CopyBtn text={`<title>${data.metaTitle}</title>\n<meta name="description" content="${data.metaDescription}">`} label="Copy tags" />
      </Section>
      {vp && vp.length > 0 && (
        <Section title="Value Propositions" color="green">
          <div className="space-y-2">{vp.map((v, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
              <p className="text-sm text-white font-semibold">{v.headline}</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{v.body}</p>
            </div>
          ))}</div>
        </Section>
      )}
      {am && (
        <Section title="Audience-Specific Messages">
          <div className="space-y-2">{Object.entries(am).map(([k, v]) => (
            <div key={k} className="bg-white/[0.03] border border-white/8 rounded-xl p-3 flex items-start gap-3">
              <span className="text-[10px] font-bold text-gray-600 uppercase mt-0.5 w-16 flex-shrink-0">{k}</span>
              <p className="text-xs text-gray-300 leading-relaxed flex-1">{v}</p>
              <CopyBtn text={v} />
            </div>
          ))}</div>
        </Section>
      )}
      {ch && (
        <Section title="Comparison Page Headlines (SEO)">
          <div className="space-y-2">{Object.entries(ch).map(([k, v]) => (
            <div key={k} className="flex items-start gap-3 bg-white/[0.03] border border-white/8 rounded-xl p-3">
              <span className="text-[10px] font-bold text-gray-600 uppercase mt-0.5 w-16 flex-shrink-0">{k.replace('vs', 'vs ')}</span>
              <p className="text-xs text-white font-semibold flex-1">{v}</p>
            </div>
          ))}</div>
        </Section>
      )}
      {typeof data.aiEntityDefinition === 'string' && (
        <Section title="🤖 AI Entity Definition (put this on your About page)" color="purple">
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
            <p className="text-xs text-gray-200 leading-relaxed italic">{data.aiEntityDefinition}</p>
          </div>
          <CopyBtn text={data.aiEntityDefinition} />
        </Section>
      )}
    </div>
  );
}

function CopywriterOutput({ data }: { data: Record<string, unknown> }) {
  type BlogPost = { title: string; slug: string; metaDescription: string; content: string; targetKeyword: string };
  type FAQ = { question: string; answer: string };
  type PHPost = { tagline: string; description: string; makerComment: string };
  const blog = data.blogPost as BlogPost | undefined;
  const faq  = data.faqPage as { title: string; questions: FAQ[] } | undefined;
  const ph   = data.productHuntPost as PHPost | undefined;
  const tw   = data.twitterThread as string[] | undefined;
  return (
    <div className="space-y-5">
      {blog && (
        <Section title="📝 SEO Blog Post" color="green">
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-[10px] text-gray-500 font-bold mb-1">TARGET KEYWORD</p>
              <KeywordChip word={blog.targetKeyword} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold mb-1">TITLE</p>
              <p className="text-white font-bold text-sm">{blog.title}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold mb-1">META DESCRIPTION</p>
              <p className="text-gray-400 text-xs">{blog.metaDescription}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold mb-2">CONTENT PREVIEW</p>
              <p className="text-gray-400 text-xs leading-relaxed line-clamp-4">{blog.content?.substring(0, 400)}…</p>
            </div>
            <div className="flex gap-2">
              <CopyBtn text={blog.content} label="Copy full post" />
              <DownloadBtn content={`# ${blog.title}\n\n${blog.content}`} filename={`${blog.slug}.md`} />
            </div>
          </div>
        </Section>
      )}
      {faq && faq.questions?.length > 0 && (
        <Section title="🤖 FAQ Page (Optimised for AI Search)" color="purple">
          <div className="space-y-2">
            {faq.questions.map((q, i) => (
              <div key={i} className="bg-purple-500/8 border border-purple-500/15 rounded-xl p-3">
                <p className="text-xs text-white font-semibold mb-1">Q: {q.question}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{q.answer}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <CopyBtn text={faq.questions.map(q => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n')} label="Copy FAQ" />
            <DownloadBtn content={faq.questions.map(q => `**Q: ${q.question}**\n${q.answer}`).join('\n\n')} filename="faq.md" />
          </div>
        </Section>
      )}
      {ph && (
        <Section title="🚀 ProductHunt Launch Post" color="orange">
          <div className="bg-orange-500/8 border border-orange-500/20 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-[10px] text-gray-500 font-bold mb-1">TAGLINE</p>
              <p className="text-white font-bold">{ph.tagline}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold mb-1">DESCRIPTION</p>
              <p className="text-gray-300 text-xs leading-relaxed">{ph.description}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold mb-1">MAKER COMMENT</p>
              <p className="text-gray-400 text-xs leading-relaxed italic">{ph.makerComment}</p>
            </div>
          </div>
          <CopyBtn text={`${ph.tagline}\n\n${ph.description}\n\n${ph.makerComment}`} label="Copy PH post" />
        </Section>
      )}
      {tw && tw.length > 0 && (
        <Section title="🐦 Twitter / X Thread" color="blue">
          <div className="space-y-2">{tw.map((t, i) => (
            <div key={i} className="flex gap-2 bg-blue-500/8 border border-blue-500/15 rounded-xl p-3">
              <span className="text-[10px] font-black text-blue-400 flex-shrink-0 mt-0.5">{i + 1}/</span>
              <p className="text-xs text-gray-200 leading-relaxed flex-1">{t}</p>
            </div>
          ))}</div>
          <CopyBtn text={tw.map((t, i) => `${i + 1}/${tw.length} ${t}`).join('\n\n')} label="Copy thread" />
        </Section>
      )}
    </div>
  );
}

function BuilderOutput({ data }: { data: Record<string, unknown> }) {
  const schema = data.schemaMarkup as Record<string, string> | undefined;
  const meta   = data.metaTags as Array<{ page: string; title: string; description: string }> | undefined;
  const sitemap = data.sitemapUrls as Array<{ url: string; priority: string; changefreq: string }> | undefined;
  const robots = data.robotsTxt as string | undefined;
  const llms   = data.llmsTxt as string | undefined;
  return (
    <div className="space-y-5">
      {llms && (
        <Section title="🤖 llms.txt — AI Model Discovery File" color="purple">
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
            <p className="text-[10px] text-purple-400 font-bold mb-2">Place at /llms.txt on your domain — helps Claude, ChatGPT, and Perplexity understand your product</p>
            <pre className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">{llms}</pre>
          </div>
          <div className="flex gap-2 mt-2">
            <CopyBtn text={llms} label="Copy" />
            <DownloadBtn content={llms} filename="llms.txt" />
          </div>
        </Section>
      )}
      {schema && (
        <Section title="JSON-LD Schema Markup" color="blue">
          {Object.entries(schema).map(([k, v]) => (
            <div key={k} className="bg-gray-950 border border-white/10 rounded-xl p-3 mb-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-blue-400 uppercase">{k}</p>
                <div className="flex gap-2">
                  <CopyBtn text={v} label="Copy" />
                  <DownloadBtn content={v} filename={`${k}-schema.json`} />
                </div>
              </div>
              <pre className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap font-mono line-clamp-4">{v}</pre>
            </div>
          ))}
        </Section>
      )}
      {meta && meta.length > 0 && (
        <Section title="Meta Tags — All Pages" color="green">
          <div className="space-y-2">
            {meta.map((m, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-gray-400 font-mono">{m.page}</p>
                  <CopyBtn text={`<title>${m.title}</title>\n<meta name="description" content="${m.description}">`} />
                </div>
                <p className="text-xs text-white font-semibold mb-0.5">{m.title}</p>
                <p className="text-xs text-gray-500">{m.description}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
      {robots && (
        <Section title="robots.txt">
          <div className="bg-gray-950 border border-white/10 rounded-xl p-3">
            <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">{robots}</pre>
          </div>
          <div className="flex gap-2 mt-2">
            <CopyBtn text={robots} />
            <DownloadBtn content={robots} filename="robots.txt" />
          </div>
        </Section>
      )}
      {sitemap && sitemap.length > 0 && (
        <Section title="Sitemap URLs">
          <div className="space-y-1">{sitemap.map((s, i) => (
            <div key={i} className="flex items-center gap-3 text-xs text-gray-400">
              <span className="font-mono text-blue-400 flex-1">{s.url}</span>
              <span className="text-gray-600">{s.priority}</span>
              <span className="text-gray-600">{s.changefreq}</span>
            </div>
          ))}</div>
        </Section>
      )}
    </div>
  );
}

function renderOutput(id: SeoAgentType, output: unknown) {
  const d = output as Record<string, unknown>;
  switch (id) {
    case 'researcher': return <ResearcherOutput data={d} />;
    case 'strategist': return <StrategistOutput data={d} />;
    case 'marketer':   return <MarketerOutput   data={d} />;
    case 'copywriter': return <CopywriterOutput data={d} />;
    case 'builder':    return <BuilderOutput    data={d} />;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GrowthPage() {
  const [states, setStates] = useState<Record<SeoAgentType, AgentState>>({
    researcher: { status: 'idle', output: null, error: '' },
    strategist: { status: 'idle', output: null, error: '' },
    marketer:   { status: 'idle', output: null, error: '' },
    copywriter: { status: 'idle', output: null, error: '' },
    builder:    { status: 'idle', output: null, error: '' },
  });
  const [expanded, setExpanded] = useState<Record<SeoAgentType, boolean>>({
    researcher: false, strategist: false, marketer: false, copywriter: false, builder: false,
  });
  const [runningAll, setRunningAll] = useState(false);

  const setAgent = useCallback((id: SeoAgentType, patch: Partial<AgentState>) =>
    setStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } })), []);

  const runAgent = useCallback(async (agentType: SeoAgentType): Promise<unknown> => {
    setAgent(agentType, { status: 'running', error: '' });
    try {
      const res = await fetch('/api/seo-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType }),
      });
      let json: Record<string, unknown> = {};
      try { json = await res.json(); } catch { /* empty */ }
      if (!res.ok) throw new Error((json.error as string) || `Error ${res.status}`);
      const output = json.result;
      setAgent(agentType, { status: 'done', output });
      setExpanded(prev => ({ ...prev, [agentType]: true }));
      return output;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed';
      setAgent(agentType, { status: 'error', error: msg });
      return null;
    }
  }, [setAgent]);

  const runAll = async () => {
    setRunningAll(true);
    await Promise.all(AGENTS.map(agent => runAgent(agent.id)));
    setRunningAll(false);
  };

  const anyRunning = Object.values(states).some(s => s.status === 'running');
  const allDone    = Object.values(states).every(s => s.status === 'done');

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">AI Growth Engine</h1>
              <p className="text-sm text-gray-500">SEO + AI platform ranking, automated</p>
            </div>
          </div>
          <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/20 border border-purple-500/20 rounded-2xl p-4">
            <p className="text-sm text-gray-300 leading-relaxed">
              5 AI agents work in sequence to build everything you need to rank on{' '}
              <span className="text-white font-semibold">Google</span> and be recommended by{' '}
              <span className="text-white font-semibold">Claude, ChatGPT, Perplexity, and Gemini</span>{' '}
              when someone asks how to find clients for their web agency in Nigeria.
            </p>
          </div>
        </div>

        {/* Run All */}
        <button
          onClick={runAll}
          disabled={anyRunning || runningAll}
          className="w-full flex items-center justify-center gap-2.5 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-2xl transition-all disabled:opacity-60 text-sm shadow-xl shadow-purple-900/30 mb-6"
        >
          {runningAll || anyRunning
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <PlayCircle className="w-5 h-5" />}
          {runningAll || anyRunning ? 'AI Team Running…' : allDone ? '🔄 Re-run Full Team' : '🚀 Run Full AI Growth Team'}
        </button>

        {/* Agent cards */}
        <div className="space-y-4">
          {AGENTS.map((agent) => {
            const state  = states[agent.id];
            const colors = COLORS[agent.color];
            const isOpen = expanded[agent.id];
            const Icon   = agent.icon;

            const canRun = state.status !== 'running';

            return (
              <div key={agent.id} className={`border rounded-2xl overflow-hidden transition-all ${
                state.status === 'done'  ? `${colors.border} bg-white/[0.02]`   :
                state.status === 'error' ? 'border-red-500/25 bg-red-950/10'    :
                state.status === 'running' ? `${colors.border} bg-white/[0.02]` :
                'border-white/8 bg-white/[0.02]'
              }`}>

                {/* Header */}
                <div className="flex items-start gap-4 px-5 py-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    state.status === 'done' ? colors.bg : 'bg-white/5'
                  }`}>
                    {state.status === 'running'
                      ? <Loader2 className={`w-5 h-5 animate-spin ${colors.text}`} />
                      : state.status === 'done'
                      ? <CheckCircle2 className={`w-5 h-5 ${colors.text}`} />
                      : state.status === 'error'
                      ? <AlertCircle className="w-5 h-5 text-red-400" />
                      : <Icon className="w-5 h-5 text-gray-600" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-black text-white">{agent.emoji} {agent.label}</span>
                      {state.status === 'done' && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>Done</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 leading-snug mb-2">{agent.tagline}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.delivers.map((d, i) => (
                        <span key={i} className="text-[10px] bg-white/5 border border-white/8 text-gray-500 px-2 py-0.5 rounded-full">{d}</span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                    {(state.status === 'idle' || state.status === 'error') && (
                      <button
                        onClick={() => runAgent(agent.id)}
                        disabled={!canRun}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                          canRun
                            ? `${colors.bg} ${colors.text} ${colors.border} hover:opacity-80`
                            : 'bg-white/5 text-gray-700 border-white/8 cursor-not-allowed'
                        }`}
                      >
                        <Play className="w-3 h-3" />
                        {state.status === 'error' ? 'Retry' : 'Run'}
                      </button>
                    )}
                    {state.status === 'done' && (
                      <>
                        <button onClick={() => runAgent(agent.id)} className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">Re-run</button>
                        <button onClick={() => setExpanded(prev => ({ ...prev, [agent.id]: !prev[agent.id] }))}>
                          {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Error */}
                {state.status === 'error' && (
                  <div className="px-5 pb-3 text-xs text-red-400">{state.error}</div>
                )}

                {/* Output */}
                {state.status === 'done' && isOpen && state.output != null && (
                  <div className="border-t border-white/8 px-5 py-5">
                    {renderOutput(agent.id, state.output)}
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
