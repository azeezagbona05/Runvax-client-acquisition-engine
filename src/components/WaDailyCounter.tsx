'use client';

import { useState } from 'react';
import { MessageCircle, X, AlertTriangle } from 'lucide-react';
import { useProspects } from '@/context/ProspectsContext';
import { useWaPaceTimer, WARN_AT, DANGER_AT, LIMIT } from '@/lib/waRateLimit';

export default function WaDailyCounter() {
  const { todayCount } = useProspects();
  const { waitSecs } = useWaPaceTimer();
  const [dismissed, setDismissed] = useState(false);

  if (todayCount === 0 || dismissed) return null;

  const pct = Math.min(100, (todayCount / LIMIT) * 100);
  const isLimit   = todayCount >= LIMIT;
  const isDanger  = todayCount >= DANGER_AT;
  const isWarning = todayCount >= WARN_AT;

  const barColor    = isLimit ? 'bg-red-500' : isDanger ? 'bg-red-400' : isWarning ? 'bg-orange-400' : 'bg-green-500';
  const textColor   = isLimit || isDanger ? 'text-red-400' : isWarning ? 'text-orange-400' : 'text-green-400';
  const borderColor = isLimit || isDanger ? 'border-red-500/30' : isWarning ? 'border-orange-400/30' : 'border-green-500/20';

  return (
    <div className={`fixed bottom-20 right-3 z-40 w-52 bg-gray-900/95 backdrop-blur border ${borderColor} rounded-2xl p-3 shadow-2xl`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <MessageCircle className={`w-3.5 h-3.5 ${textColor}`} />
          <span className={`text-xs font-bold ${textColor}`}>
            {isLimit ? 'Daily limit hit' : `${todayCount} WA sent today`}
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-600 hover:text-gray-400 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="text-[10px] text-gray-500">
        {isLimit
          ? 'Stop now — resume tomorrow'
          : `${LIMIT - todayCount} remaining before restriction risk`}
      </div>

      {waitSecs > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1">
          <span>⏱</span>
          <span>Wait {waitSecs}s before next send</span>
        </div>
      )}

      {isWarning && !isLimit && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-orange-400">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          <span>Slow down to stay safe</span>
        </div>
      )}

      {isLimit && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-red-400">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          <span>WhatsApp may restrict your number</span>
        </div>
      )}
    </div>
  );
}
