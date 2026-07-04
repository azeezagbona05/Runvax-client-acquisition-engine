'use client';

import { useState, useCallback } from 'react';
import {
  Loader2, CheckCircle2, AlertCircle, Copy, Check,
  ChevronDown, ChevronRight, Play, PlayCircle,
} from 'lucide-react';
import { Business, PsiDetails, AgentType, ResearcherOutput, StrategistOutput, MarketerOutput, CopywriterOutput, BuilderOutput } from '@/types';
import { useHandleAIResponse } from '@/context/UpgradeContext';

interface Props {
  business: Business;
  psiDetails?: PsiDetails | null;
}

type AgentStatus = 'idle' | 'running' | 'done' | 'error';

interface AgentState {
  status: AgentStatus;
  output: unknown;
  error: string;
}

const AGENTS: Array<{ id: AgentType; icon: string; label: string; desc: string; color: string }> = [
  { id: 'researcher',  icon: '🔬', label: 'Researcher',  desc: 'Reviews, pain points, digital signals',        color: 'blue'   },
  { id: 'strategist',  icon: '🧠', label: 'Strategist',  desc: 'Best channel, hook, objections, win odds',      color: 'purple' },
  { id: 'marketer',    icon: '📣', label: 'Marketer',    desc: 'Value proposition, ROI, positioning',            color: 'orange' },
  { id: 'copywriter',  icon: '✍️',  label: 'Copywriter',  desc: 'WA opener, email, day-3 & day-7 follow-ups',   color: 'green'  },
  { id: 'builder',     icon: '🏗️',  label: 'Builder',     desc: 'Page structure, design brief, Lovable prompt',  color: 'cyan'   },
];

const COLOR_MAP: Record<string, { badge: string; border: string; text: string }> = {
  blue:   { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25',   border: 'border-blue-500/20',   text: 'text-blue-400'   },
  purple: { badge: 'bg-purple-500/15 text-purple-400 border-purple-500/25', border: 'border-purple-500/20', text: 'text-purple-400' },
  orange: { badge: 'bg-orange-500/15 text-orange-400 border-orange-500/25', border: 'border-orange-500/20', text: 'text-orange-400' },
  green:  { badge: 'bg-green-500/15 text-green-400 border-green-500/25',   border: 'border-green-500/20',  text: 'text-green-400'  },
  cyan:   { badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',     border: 'border-cyan-500/20',   text: 'text-cyan-400'   },
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg transition-colors ${
      copied ? 'bg-green-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-400'
    }`}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] bg-white/8 border border-white/10 text-gray-300 px-2 py-0.5 rounded-full">{children}</span>;
}

function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  const c = color === 'high' ? 'bg-green-500/20 text-green-400 border-green-500/30'
          : color === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
          : 'bg-red-500/20 text-red-400 border-red-500/30';
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${c}`}>{label}: {value}</span>
  );
}

// ── Output renderers ──────────────────────────────────────────────────────────

function ResearcherView({ data }: { data: ResearcherOutput }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2">
        {data.ownerName && <Tag>👤 {data.ownerName}</Tag>}
        {data.businessAge && <Tag>📅 {data.businessAge}</Tag>}
        <Tag>{data.reviewSentiment === 'positive' ? '😊' : data.reviewSentiment === 'negative' ? '😟' : '😐'} {data.reviewSentiment} reviews</Tag>
        {data.socialMedia?.instagram && <Tag>📸 {data.socialMedia.instagram}</Tag>}
        {data.socialMedia?.facebook && <Tag>👤 {data.socialMedia.facebook}</Tag>}
      </div>
      {data.quickInsight && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2.5 text-blue-200 text-xs leading-relaxed italic">
          💡 {data.quickInsight}
        </div>
      )}
      {data.painPoints?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1.5">Pain Points</p>
          <ul className="space-y-1">{data.painPoints.map((p, i) => <li key={i} className="text-xs text-gray-300 flex gap-2"><span className="text-red-400 flex-shrink-0">•</span>{p}</li>)}</ul>
        </div>
      )}
      {data.opportunities?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-1.5">Opportunities</p>
          <ul className="space-y-1">{data.opportunities.map((o, i) => <li key={i} className="text-xs text-gray-300 flex gap-2"><span className="text-green-400 flex-shrink-0">•</span>{o}</li>)}</ul>
        </div>
      )}
      {data.keyThemes?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.keyThemes.map((t, i) => <Tag key={i}>{t}</Tag>)}
        </div>
      )}
    </div>
  );
}

function StrategistView({ data }: { data: StrategistOutput }) {
  const channelIcon = data.recommendedChannel === 'whatsapp' ? '💬' : data.recommendedChannel === 'email' ? '📧' : '📞';
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <Tag>{channelIcon} {data.recommendedChannel}</Tag>
        {data.winProbability && <Pill label="Win odds" value={data.winProbability} color={data.winProbability} />}
      </div>
      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2.5">
        <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">Lead With</p>
        <p className="text-xs text-gray-200 leading-relaxed">{data.leadWith}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1.5">Recommended Offer</p>
        <p className="text-xs text-gray-300">{data.recommendedOffer}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Approach Angle</p>
        <p className="text-xs text-gray-300 leading-relaxed">{data.approachAngle}</p>
      </div>
      {data.urgencyTrigger && (
        <div className="bg-yellow-500/8 border border-yellow-500/20 rounded-xl px-3 py-2">
          <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest mb-0.5">Urgency</p>
          <p className="text-xs text-gray-300">{data.urgencyTrigger}</p>
        </div>
      )}
      {data.expectedObjections?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1.5">Expect These Objections</p>
          <ul className="space-y-1">{data.expectedObjections.map((o, i) => <li key={i} className="text-xs text-gray-400 flex gap-2"><span className="text-red-400 flex-shrink-0">⚠</span>{o}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function MarketerView({ data }: { data: MarketerOutput }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2.5">
        <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Value Proposition</p>
        <p className="text-xs text-white font-semibold leading-relaxed">{data.valueProposition}</p>
      </div>
      {data.keyBenefits?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Key Benefits</p>
          <ul className="space-y-1">{data.keyBenefits.map((b, i) => <li key={i} className="text-xs text-gray-300 flex gap-2"><span className="text-orange-400 flex-shrink-0">✓</span>{b}</li>)}</ul>
        </div>
      )}
      {data.costOfInaction && (
        <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2">
          <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-0.5">Cost of Doing Nothing</p>
          <p className="text-xs text-gray-300">{data.costOfInaction}</p>
        </div>
      )}
      <div className="flex gap-3">
        {data.estimatedRoi && <div className="flex-1 bg-green-500/8 border border-green-500/20 rounded-xl px-3 py-2"><p className="text-[10px] font-bold text-green-400 mb-0.5">Est. ROI</p><p className="text-xs text-gray-300">{data.estimatedRoi}</p></div>}
        {data.positioning && <div className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2"><p className="text-[10px] font-bold text-gray-500 mb-0.5">Positioning</p><p className="text-xs text-gray-300">{data.positioning}</p></div>}
      </div>
    </div>
  );
}

function CopywriterView({ data }: { data: CopywriterOutput }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="bg-green-500/8 border border-green-500/20 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest">💬 WhatsApp Opener</p>
          <CopyBtn text={data.whatsappOpener} />
        </div>
        <p className="text-xs text-gray-200 leading-relaxed">{data.whatsappOpener}</p>
      </div>
      <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">📧 Email</p>
          <CopyBtn text={`Subject: ${data.emailSubject}\n\n${data.emailBody}`} />
        </div>
        <p className="text-[11px] text-blue-300 font-semibold mb-1">Subject: {data.emailSubject}</p>
        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{data.emailBody}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Day 3 Follow-up</p>
            <CopyBtn text={data.followUp1} />
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">{data.followUp1}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Day 7 Follow-up</p>
            <CopyBtn text={data.followUp2} />
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">{data.followUp2}</p>
        </div>
      </div>
    </div>
  );
}

function BuilderView({ data }: { data: BuilderOutput }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-1.5">
        {data.pageStructure?.map((p, i) => <Tag key={i}>{p}</Tag>)}
      </div>
      {data.keyFeatures?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-1.5">Key Features</p>
          <ul className="space-y-1">{data.keyFeatures.map((f, i) => <li key={i} className="text-xs text-gray-300 flex gap-2"><span className="text-cyan-400 flex-shrink-0">⚙</span>{f}</li>)}</ul>
        </div>
      )}
      {data.designStyle && (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Design Style</p>
          <p className="text-xs text-gray-300">{data.designStyle}</p>
        </div>
      )}
      {data.websitePrompt && (
        <div className="bg-cyan-500/8 border border-cyan-500/20 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">🏗 Website Prompt</p>
            <CopyBtn text={data.websitePrompt} />
          </div>
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-4">{data.websitePrompt}</p>
          <div className="flex gap-2 mt-2">
            <a href="https://lovable.dev" target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 underline">Lovable →</a>
            <a href="https://bolt.new" target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 underline">Bolt →</a>
          </div>
        </div>
      )}
    </div>
  );
}

function renderOutput(agentId: AgentType, output: unknown) {
  if (!output) return null;
  switch (agentId) {
    case 'researcher':  return <ResearcherView  data={output as ResearcherOutput} />;
    case 'strategist':  return <StrategistView  data={output as StrategistOutput} />;
    case 'marketer':    return <MarketerView    data={output as MarketerOutput} />;
    case 'copywriter':  return <CopywriterView  data={output as CopywriterOutput} />;
    case 'builder':     return <BuilderView     data={output as BuilderOutput} />;
  }
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function AITeamPanel({ business, psiDetails }: Props) {
  const handleAIResponse = useHandleAIResponse();

  const [states, setStates] = useState<Record<AgentType, AgentState>>({
    researcher: { status: 'idle', output: null, error: '' },
    strategist: { status: 'idle', output: null, error: '' },
    marketer:   { status: 'idle', output: null, error: '' },
    copywriter: { status: 'idle', output: null, error: '' },
    builder:    { status: 'idle', output: null, error: '' },
  });
  const [expanded, setExpanded] = useState<Record<AgentType, boolean>>({
    researcher: false, strategist: false, marketer: false, copywriter: false, builder: false,
  });
  const [runningAll, setRunningAll] = useState(false);

  const setAgent = useCallback((id: AgentType, patch: Partial<AgentState>) => {
    setStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const toggleExpand = (id: AgentType) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const runAgent = useCallback(async (
    agentType: AgentType,
    currentStates: Record<AgentType, AgentState>,
  ): Promise<unknown> => {
    setAgent(agentType, { status: 'running', error: '' });
    try {
      const context = {
        researcher: currentStates.researcher.output as ResearcherOutput | undefined,
        strategist: currentStates.strategist.output as StrategistOutput | undefined,
        marketer:   currentStates.marketer.output   as MarketerOutput   | undefined,
      };
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType, business, psiDetails, context }),
      });
      let json: Record<string, unknown> = {};
      try { json = await res.json(); } catch { /* empty */ }
      if (handleAIResponse(res, json)) { setAgent(agentType, { status: 'idle' }); return null; }
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
  }, [business, psiDetails, handleAIResponse, setAgent]);

  const runAll = async () => {
    setRunningAll(true);
    // Run sequentially — each feeds the next via a local accumulator
    const acc: Record<AgentType, AgentState> = { ...states };

    const order: AgentType[] = ['researcher', 'strategist', 'marketer', 'copywriter', 'builder'];
    for (const agentType of order) {
      const output = await runAgent(agentType, acc);
      if (!output && agentType !== 'builder') break; // stop chain on failure (except builder which is independent)
      acc[agentType] = { status: 'done', output, error: '' };
    }
    setRunningAll(false);
  };

  const anyRunning = Object.values(states).some(s => s.status === 'running');

  return (
    <div className="space-y-3">
      {/* Run All button */}
      <button
        onClick={runAll}
        disabled={anyRunning || runningAll}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-60 text-sm shadow-lg shadow-purple-900/30"
      >
        {runningAll || anyRunning
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <PlayCircle className="w-4 h-4" />}
        {runningAll || anyRunning ? 'Running AI Team…' : 'Run Full AI Team'}
      </button>

      {/* Agent cards */}
      {AGENTS.map((agent, idx) => {
        const state  = states[agent.id];
        const colors = COLOR_MAP[agent.color];
        const isOpen = expanded[agent.id];

        // Dependency check — can this agent run yet?
        const deps: AgentType[] = idx === 0 ? [] : idx === 4 ? ['researcher'] : AGENTS.slice(0, idx).map(a => a.id);
        const depsReady = deps.every(d => states[d].status === 'done');
        const canRun = depsReady && state.status !== 'running';

        return (
          <div key={agent.id} className={`border rounded-2xl overflow-hidden transition-all ${
            state.status === 'done'  ? `${colors.border} bg-white/[0.02]` :
            state.status === 'error' ? 'border-red-500/20 bg-red-950/10' :
            'border-white/8 bg-white/[0.02]'
          }`}>
            {/* Card header */}
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-lg flex-shrink-0">{agent.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">{agent.label}</span>
                  {state.status === 'done' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  )}
                  {state.status === 'running' && (
                    <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin flex-shrink-0" />
                  )}
                  {state.status === 'error' && (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-gray-500 truncate">{agent.desc}</p>
              </div>

              {/* Status / actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {state.status === 'idle' && (
                  <button
                    onClick={() => runAgent(agent.id, states)}
                    disabled={!canRun}
                    className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                      canRun
                        ? `${colors.badge} border-current hover:opacity-80`
                        : 'bg-white/5 text-gray-700 border-white/8 cursor-not-allowed'
                    }`}
                  >
                    <Play className="w-3 h-3" /> Run
                  </button>
                )}
                {state.status === 'error' && (
                  <button
                    onClick={() => runAgent(agent.id, states)}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors"
                  >
                    Retry
                  </button>
                )}
                {state.status === 'done' && (
                  <>
                    <button
                      onClick={() => runAgent(agent.id, states)}
                      className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      Re-run
                    </button>
                    <button onClick={() => toggleExpand(agent.id)} className="text-gray-500 hover:text-gray-300 transition-colors">
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Error message */}
            {state.status === 'error' && state.error && (
              <div className="px-4 pb-3 text-xs text-red-400">{state.error}</div>
            )}

            {/* Dependency hint */}
            {state.status === 'idle' && !depsReady && deps.length > 0 && (
              <div className="px-4 pb-3 text-[11px] text-gray-700">
                Run {deps.map(d => AGENTS.find(a => a.id === d)?.label).join(' → ')} first
              </div>
            )}

            {/* Output */}
            {state.status === 'done' && isOpen && state.output != null && (
              <div className="px-4 pb-4 border-t border-white/8 pt-3">
                {renderOutput(agent.id, state.output) ?? null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
