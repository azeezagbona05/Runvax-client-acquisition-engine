'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Loader2, ChevronDown, Scissors, Crown, Baby, Shield,
  TrendingUp, SpellCheck, Flame, Undo2, Wand2, X,
} from 'lucide-react';
import { useHandleAIResponse } from '@/context/UpgradeContext';

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Client details passed through so rewrites can stay specific. */
  context?: Record<string, unknown>;
  disabled?: boolean;
}

const MODES: Array<{ id: string; label: string; desc: string; icon: typeof Sparkles }> = [
  { id: 'improve',    label: 'Improve it',        desc: 'Sharper writing, better flow',        icon: Sparkles   },
  { id: 'persuasive', label: 'More persuasive',   desc: 'Stronger problem and payoff',         icon: Flame      },
  { id: 'premium',    label: 'More premium',      desc: 'Justify the price, less eager',       icon: Crown      },
  { id: 'roi',        label: 'Strengthen the ROI',desc: 'Harder business case',                icon: TrendingUp },
  { id: 'objections', label: 'Handle objections', desc: 'Pre-empt "too expensive", "not now"', icon: Shield     },
  { id: 'simpler',    label: 'Plainer language',  desc: 'For a non-technical owner',           icon: Baby       },
  { id: 'shorter',    label: 'Make it shorter',   desc: 'Skimmable in two minutes',            icon: Scissors   },
  { id: 'grammar',    label: 'Fix grammar only',  desc: 'No tone or structure changes',        icon: SpellCheck },
];

export default function ProposalEnhanceBar({ value, onChange, context, disabled }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  // Single-level undo. A bad rewrite of a long proposal is otherwise unrecoverable
  // short of regenerating and losing every hand edit.
  const [previous, setPrevious] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const handleAIResponse = useHandleAIResponse();

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const run = async (mode: string, freeText?: string) => {
    setMenuOpen(false);
    setBusy(mode);
    setError('');
    const before = value;
    try {
      const res = await fetch('/api/proposal/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value, mode, instruction: freeText, context }),
      });
      const json = await res.json();
      // Routes upgrade/limit responses through the shared handler so the user
      // gets the upgrade modal rather than a raw error string.
      if (handleAIResponse(res, json)) return;
      if (!res.ok) throw new Error(json.error || 'Failed to enhance');
      if (json.text) {
        setPrevious(before);
        onChange(json.text);
        setCustomOpen(false);
        setInstruction('');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not enhance the proposal');
    } finally {
      setBusy('');
    }
  };

  const undo = () => {
    if (previous == null) return;
    onChange(previous);
    setPrevious(null);
  };

  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const working = !!busy;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-gray-500">{words} words</span>

        <div className="ml-auto flex items-center gap-1.5">
          {previous != null && !working && (
            <button
              onClick={undo}
              className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5" /> Undo
            </button>
          )}

          <button
            onClick={() => { setCustomOpen((v) => !v); setMenuOpen(false); }}
            disabled={disabled || working}
            className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 text-gray-300 transition-colors"
          >
            <Wand2 className="w-3.5 h-3.5" /> Tell it what to change
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => { setMenuOpen((v) => !v); setCustomOpen(false); }}
              disabled={disabled || working}
              className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white transition-colors"
            >
              {working ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {working ? 'Rewriting…' : 'Enhance'}
              {!working && <ChevronDown className="w-3 h-3" />}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                {MODES.map(({ id, label, desc, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => run(id)}
                    className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                  >
                    <Icon className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <span className="block text-sm text-gray-200 font-semibold">{label}</span>
                      <span className="block text-[11px] text-gray-500">{desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {customOpen && (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">What should change?</p>
            <button onClick={() => setCustomOpen(false)} className="text-gray-500 hover:text-gray-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Add a short section on ongoing maintenance, and make the intro less formal"
            rows={2}
            className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-purple-500/60 resize-none"
          />
          <button
            onClick={() => run('custom', instruction)}
            disabled={!instruction.trim() || working}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-sm transition-colors"
          >
            {working ? 'Rewriting…' : 'Apply change'}
          </button>
          <p className="text-[10px] text-gray-600 leading-relaxed">
            Prices, bank details, timelines and package contents are locked and will not be changed.
          </p>
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
