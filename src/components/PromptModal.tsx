'use client';

import { useState } from 'react';
import { X, Copy, Check, RefreshCw, ExternalLink, Sparkles } from 'lucide-react';

interface Props {
  prompt: string;
  businessName: string;
  onClose: () => void;
  onRegenerate: () => void;
  generating: boolean;
}

export default function PromptModal({ prompt, businessName, onClose, onRegenerate, generating }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for browsers that block clipboard
      const el = document.createElement('textarea');
      el.value = prompt;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/10 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h2 className="font-black text-white text-lg">Website Prompt</h2>
            </div>
            <p className="text-sm text-gray-500">
              For: <span className="text-purple-300 font-medium">{businessName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Prompt text */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="bg-gray-950 border border-white/8 rounded-xl p-4 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-mono text-[13px]">
            {prompt}
          </div>
        </div>

        {/* Instructions + actions */}
        <div className="p-5 border-t border-white/10 flex-shrink-0 space-y-3">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5">
            <p className="text-blue-300 font-semibold text-sm mb-1.5">📋 How to use this prompt:</p>
            <ol className="text-gray-300 text-xs space-y-1.5 list-decimal list-inside">
              <li>Click <strong className="text-white">Copy Prompt</strong> below</li>
              <li>Open your AI website builder — <a href="https://lovable.dev" target="_blank" rel="noopener" className="text-blue-400 underline hover:text-blue-300">Lovable</a>, <a href="https://bolt.new" target="_blank" rel="noopener" className="text-blue-400 underline hover:text-blue-300">Bolt</a>, or <a href="https://v0.dev" target="_blank" rel="noopener" className="text-blue-400 underline hover:text-blue-300">v0</a> — and start a new project</li>
              <li>Paste the prompt into the chat and press Enter</li>
              <li>The builder generates the full website in seconds</li>
              <li>Refine sections, then share the live preview link with your client</li>
            </ol>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className={`flex-1 flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl transition-all text-sm ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Prompt'}
            </button>

            <button
              onClick={onRegenerate}
              disabled={generating}
              title="Regenerate with different variations"
              className="flex items-center gap-2 px-4 py-3.5 bg-white/8 hover:bg-white/15 text-gray-300 font-semibold rounded-xl transition-colors disabled:opacity-50 text-sm border border-white/10"
            >
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              Redo
            </button>

            <a
              href="https://lovable.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 font-semibold rounded-xl transition-colors border border-orange-500/25 text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Builder
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
