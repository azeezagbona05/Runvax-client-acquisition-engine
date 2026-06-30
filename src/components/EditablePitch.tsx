'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Copy, Check, Loader2, ChevronDown,
  Scissors, Flame, Smile, Clock, SpellCheck, Eye, EyeOff,
} from 'lucide-react';
import { pitchTips, type PitchKind } from '@/lib/pitchTips';

interface Props {
  value: string;
  onChange: (v: string) => void;
  kind?: PitchKind;
  /** Extra prospect context passed to the enhancer for sharper rewrites */
  context?: Record<string, unknown>;
  minHeight?: number;
  /** Optional rendered preview (e.g. WhatsApp bold/italic) */
  preview?: (text: string) => React.ReactNode;
  className?: string;
}

const ENHANCE_MODES: Array<{ id: string; label: string; icon: typeof Sparkles }> = [
  { id: 'improve',    label: 'Improve it',       icon: Sparkles },
  { id: 'shorter',    label: 'Make it shorter',  icon: Scissors },
  { id: 'persuasive', label: 'More persuasive',  icon: Flame },
  { id: 'friendlier', label: 'Friendlier / warmer', icon: Smile },
  { id: 'urgency',    label: 'Add urgency',      icon: Clock },
  { id: 'grammar',    label: 'Fix grammar',      icon: SpellCheck },
];

export default function EditablePitch({ value, onChange, kind = 'generic', context, minHeight = 140, preview, className }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(minHeight, ta.scrollHeight)}px`;
  }, [value, minHeight, showPreview]);

  // Close enhance menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const tips = pitchTips(value, kind);
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;

  const enhance = async (mode: string) => {
    setMenuOpen(false);
    setEnhancing(true);
    setError('');
    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value, mode, kind, context }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      if (json.text) onChange(json.text);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not enhance');
    } finally {
      setEnhancing(false);
    }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(value); } catch { /* */ }
    setCopied(true); setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className={className}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[11px] text-gray-500">{words} words · editable</span>
        <div className="ml-auto flex items-center gap-1.5">
          {preview && (
            <button onClick={() => setShowPreview((v) => !v)}
              className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 transition-colors">
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPreview ? 'Edit' : 'Preview'}
            </button>
          )}
          <button onClick={copy}
            className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'}`}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen((v) => !v)} disabled={enhancing}
              className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white transition-colors">
              {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {enhancing ? 'Enhancing…' : 'Enhance'}
              {!enhancing && <ChevronDown className="w-3 h-3" />}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                {ENHANCE_MODES.map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => enhance(id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-200 hover:bg-white/5 transition-colors text-left">
                    <Icon className="w-4 h-4 text-purple-400 flex-shrink-0" /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editor / preview */}
      {showPreview && preview ? (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-sm leading-loose text-gray-200 whitespace-pre-wrap" style={{ minHeight }}>
          {preview(value)}
        </div>
      ) : (
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={enhancing}
          spellCheck
          className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 text-sm leading-relaxed text-gray-100 focus:outline-none focus:border-purple-500/60 resize-none transition-colors disabled:opacity-60"
          style={{ minHeight }}
        />
      )}

      {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}

      {/* Live writing tips */}
      {tips.length > 0 && (
        <div className="mt-2 space-y-1">
          {tips.map((tip, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[11px] text-amber-400/90 leading-snug">
              <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" /> {tip}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
