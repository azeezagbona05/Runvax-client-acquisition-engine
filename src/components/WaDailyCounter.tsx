'use client';

import { useMemo, useState } from 'react';
import { MessageCircle, X, AlertTriangle, Sprout, MessageSquareWarning } from 'lucide-react';
import { useProspects } from '@/context/ProspectsContext';
import {
  useWaPaceTimer, activeSendingDays, dailyCapFor, nextWarmupStep, replyHealth,
} from '@/lib/waRateLimit';

export default function WaDailyCounter() {
  const { todayCount, dailyLogs, prospects } = useProspects();
  const { waitSecs } = useWaPaceTimer();
  const [dismissed, setDismissed] = useState(false);

  // Warm-up state is derived entirely from data the context already holds —
  // no extra request just to render a counter.
  const activeDays = useMemo(() => activeSendingDays(dailyLogs), [dailyLogs]);
  const cap = dailyCapFor(activeDays);
  const nextStep = nextWarmupStep(activeDays);

  const health = useMemo(() => {
    let sent = 0;
    let received = 0;
    for (const p of prospects) {
      for (const c of p.conversations ?? []) {
        if (c.type === 'sent') sent++;
        else if (c.type === 'received') received++;
      }
    }
    return replyHealth(sent, received);
  }, [prospects]);

  if (todayCount === 0 || dismissed) return null;

  const pct = Math.min(100, (todayCount / cap) * 100);
  const isLimit = todayCount >= cap;
  const isDanger = todayCount >= cap * 0.9;
  const isWarning = todayCount >= cap * 0.7;

  const barColor = isLimit ? 'bg-red-500' : isDanger ? 'bg-red-400' : isWarning ? 'bg-orange-400' : 'bg-green-500';
  const textColor = isLimit || isDanger ? 'text-red-400' : isWarning ? 'text-orange-400' : 'text-green-400';
  const borderColor = isLimit || isDanger ? 'border-red-500/30' : isWarning ? 'border-orange-400/30' : 'border-green-500/20';

  return (
    <div className={`fixed bottom-20 right-3 z-40 w-56 bg-gray-900/95 backdrop-blur border ${borderColor} rounded-2xl p-3 shadow-2xl`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <MessageCircle className={`w-3.5 h-3.5 ${textColor}`} />
          <span className={`text-xs font-bold ${textColor}`}>
            {isLimit ? 'Daily limit hit' : `${todayCount} of ${cap} sent today`}
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
          : `${cap - todayCount} remaining before restriction risk`}
      </div>

      {waitSecs > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1">
          <span>⏱</span>
          <span>Wait {waitSecs}s before next send</span>
        </div>
      )}

      {/* Warm-up ramp — explains why the cap is low rather than just enforcing it,
          so a new user doesn't read it as the product being broken. */}
      {nextStep && (
        <div className="mt-2 flex items-start gap-1.5 text-[10px] text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1.5">
          <Sprout className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>
            Warming up your number — day {activeDays}. Cap rises to {nextStep.cap}/day
            after {nextStep.inDays} more active {nextStep.inDays === 1 ? 'day' : 'days'}.
          </span>
        </div>
      )}

      {/* Reply health — a prompt, never a block. Replies are logged by hand, so
          a zero here is as likely to mean "not logged" as "not replying". */}
      {health.level === 'low' && health.message && (
        <div className="mt-2 flex items-start gap-1.5 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1.5">
          <MessageSquareWarning className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>{health.message}</span>
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
