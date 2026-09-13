'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles, X, Minus, Send, Loader2, RotateCcw, Mail, ArrowRight, AlertCircle,
} from 'lucide-react';

const STORAGE_KEY = 'aip_assistant_chat';
const SUPPORT_EMAIL = 'softlineazeez123@gmail.com';
/** Trim persisted history so a long-running chat can't bloat localStorage. */
const MAX_STORED = 20;

interface Action {
  label: string;
  href: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  actions?: Action[];
  escalate?: boolean;
  failed?: boolean;
}

/** Starter questions, tuned to whatever page the user opened the assistant from. */
function suggestionsFor(pathname: string): string[] {
  if (pathname.startsWith('/pipeline')) {
    return [
      'How do I stop prospects going cold?',
      'What should I do when someone says it is too expensive?',
      'How do follow-up sequences work?',
    ];
  }
  if (pathname.startsWith('/settings')) {
    return [
      'What is still missing from my setup?',
      'How do I connect my own email?',
      'How should I price my packages?',
    ];
  }
  if (pathname.startsWith('/pricing')) {
    return [
      'What is the difference between Pro and Agency?',
      'What happens when I hit my daily limit?',
      'How do I cancel?',
    ];
  }
  if (pathname.startsWith('/dashboard')) {
    return [
      'How do I read my win rate?',
      'Why am I getting no replies?',
      'What should my daily routine look like?',
    ];
  }
  return [
    'How do I find businesses with no website?',
    'Why do my messages sound generic?',
    'What is still missing from my setup?',
  ];
}

/**
 * Minimal markdown renderer — the model is asked for **bold**, "- " bullets and
 * "1." numbering, so a full markdown dependency would be dead weight here.
 * Everything is rendered as React nodes; no HTML is ever injected.
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={key} className="px-1 py-0.5 rounded bg-white/10 text-[0.85em] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

function RichText({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="space-y-1.5 my-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-purple-400 flex-shrink-0 mt-[3px] text-[10px]">●</span>
            <span className="flex-1">{renderInline(item, `li-${i}`)}</span>
          </li>
        ))}
      </ul>,
    );
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) { flushBullets(); return; }

    const bullet = line.match(/^[-*·]\s+(.*)$/);
    if (bullet) { bullets.push(bullet[1]); return; }

    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      flushBullets();
      blocks.push(
        <div key={`n-${i}`} className="flex gap-2.5 my-1.5">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-600/20 text-purple-300 text-[11px] font-bold flex items-center justify-center mt-px">
            {numbered[1]}
          </span>
          <span className="flex-1">{renderInline(numbered[2], `n-${i}`)}</span>
        </div>,
      );
      return;
    }

    flushBullets();
    blocks.push(<p key={`p-${i}`} className="my-1.5 first:mt-0 last:mb-0">{renderInline(line, `p-${i}`)}</p>);
  });

  flushBullets();
  return <>{blocks}</>;
}

export default function AssistantWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Restore the previous conversation so a page navigation doesn't lose context.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved) as Message[]);
    } catch { /* corrupt or unavailable storage — start fresh */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
    } catch { /* quota or private mode — the chat still works in memory */ }
  }, [messages]);

  // Let anything in the app open the assistant: window.dispatchEvent(new Event('runvax:assistant-open'))
  useEffect(() => {
    const openAssistant = () => setOpen(true);
    window.addEventListener('runvax:assistant-open', openAssistant);
    return () => window.removeEventListener('runvax:assistant-open', openAssistant);
  }, []);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [messages, sending, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = useCallback(async (text: string) => {
    const question = text.trim();
    if (!question || sending) return;

    setError('');
    setInput('');
    // Snapshot the history the API should see, including this new turn.
    const nextMessages: Message[] = [...messages, { role: 'user', content: question }];
    setMessages(nextMessages);
    setSending(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.answer,
        actions: Array.isArray(data.actions) ? data.actions : [],
        escalate: data.escalate === true,
      }]);
    } catch {
      setError('Could not reach the assistant. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }, [messages, sending]);

  const clearChat = () => {
    setMessages([]);
    setError('');
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
  };

  const suggestions = suggestionsFor(pathname);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open the Runvax Assistant"
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-2xl shadow-purple-900/40 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
      >
        <Sparkles className="w-6 h-6" />
      </button>
    );
  }

  return (
    <>
      {/* Mobile scrim — the panel is a full-height sheet on small screens */}
      <div
        className="sm:hidden fixed inset-0 z-50 bg-black/60 animate-fade-in"
        onClick={() => setOpen(false)}
      />

      <div className="fixed z-50 inset-x-0 bottom-0 top-0 sm:inset-auto sm:bottom-4 sm:right-4 sm:top-auto sm:w-[400px] sm:h-[620px] sm:max-h-[calc(100dvh-2rem)] flex flex-col bg-gray-900 sm:border sm:border-white/10 sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-in-up">

        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/8 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white leading-tight">Runvax Assistant</div>
            <div className="text-[11px] text-gray-500">Ask me anything about Runvax</div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              title="Start a new conversation"
              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/8 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            title="Minimise"
            className="hidden sm:flex w-7 h-7 items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/8 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setOpen(false)}
            title="Close"
            className="sm:hidden w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/8 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="animate-fade-in">
              <div className="text-sm text-gray-300 leading-relaxed">
                Hi — I know Runvax inside out: searching, outreach, WhatsApp, proposals,
                pricing, your pipeline and your account settings. What can I help with?
              </div>
              <div className="mt-4 space-y-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-left text-[13px] text-gray-300 bg-white/[0.03] hover:bg-white/8 border border-white/8 rounded-xl px-3 py-2.5 transition-colors flex items-center gap-2 group"
                  >
                    <span className="flex-1">{s}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-purple-400 transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] bg-purple-600 text-white text-sm rounded-2xl rounded-br-md px-3.5 py-2.5 whitespace-pre-wrap break-words">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex flex-col gap-2 animate-fade-in">
                <div className="max-w-[92%] bg-white/[0.04] border border-white/8 text-sm text-gray-300 rounded-2xl rounded-bl-md px-3.5 py-3 leading-relaxed break-words">
                  <RichText text={m.content} />
                </div>

                {m.actions && m.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {m.actions.map((a) => (
                      <Link
                        key={a.href}
                        href={a.href}
                        onClick={() => setOpen(false)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-300 bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/25 rounded-lg px-2.5 py-1.5 transition-colors"
                      >
                        {a.label}
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    ))}
                  </div>
                )}

                {m.escalate && (
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/25 rounded-lg px-2.5 py-1.5 transition-colors self-start"
                  >
                    <Mail className="w-3 h-3" />
                    Email support
                  </a>
                )}
              </div>
            )
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
              Thinking…
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
              <span className="flex-1">{error}</span>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-white/8 p-3 flex-shrink-0">
          <div className="flex items-end gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 focus-within:border-purple-500/50 transition-colors">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask a question…"
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 resize-none outline-none max-h-[120px] py-1"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || sending}
              className="w-8 h-8 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-white/8 disabled:text-gray-600 text-white flex items-center justify-center transition-colors flex-shrink-0 mb-0.5"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-gray-600 text-center mt-2">
            AI answers can be imperfect — check anything critical with{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-gray-500 hover:text-gray-400 underline">support</a>.
          </p>
        </div>
      </div>
    </>
  );
}
