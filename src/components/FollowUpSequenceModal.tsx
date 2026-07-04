'use client';

import { useState } from 'react';
import { X, Zap, MessageCircle, Mail, Check, SkipForward, Loader2, RefreshCw } from 'lucide-react';
import { SavedProspect, FollowUpStep } from '@/types';
import { useProspects } from '@/context/ProspectsContext';
import { whatsappLink } from '@/lib/phone';

interface Props {
  prospect: SavedProspect;
  onClose: () => void;
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

function stepStatus(step: FollowUpStep): 'done' | 'skipped' | 'due' | 'overdue' | 'upcoming' {
  if (step.status === 'sent') return 'done';
  if (step.status === 'skipped') return 'skipped';
  const today = todayStr();
  if (step.dueDate < today) return 'overdue';
  if (step.dueDate === today) return 'due';
  return 'upcoming';
}

const STATUS_STYLES = {
  done:     { dot: 'bg-green-500',  card: 'border-green-500/20 bg-green-500/5',   label: 'text-green-400',  text: 'text-green-300' },
  skipped:  { dot: 'bg-gray-600',   card: 'border-white/8 bg-white/3 opacity-50', label: 'text-gray-600',   text: 'text-gray-600'  },
  due:      { dot: 'bg-amber-400',  card: 'border-amber-500/30 bg-amber-500/8',   label: 'text-amber-400',  text: 'text-amber-200' },
  overdue:  { dot: 'bg-red-500',    card: 'border-red-500/30 bg-red-500/8',       label: 'text-red-400',    text: 'text-red-200'   },
  upcoming: { dot: 'bg-gray-700',   card: 'border-white/8 bg-white/3',            label: 'text-gray-500',   text: 'text-gray-400'  },
};

const STATUS_LABELS = {
  done: 'Sent', skipped: 'Skipped', due: 'Due today', overdue: 'Overdue', upcoming: 'Upcoming',
};

export default function FollowUpSequenceModal({ prospect, onClose }: Props) {
  const { generateSequence, updateSequenceStep, incrementToday } = useProspects();
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const steps = prospect.followUpSequence ?? [];
  const hasSequence = steps.length > 0;
  const dueCount = steps.filter((s) => {
    const st = stepStatus(s);
    return st === 'due' || st === 'overdue';
  }).length;

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError('');
    const result = await generateSequence(prospect.business.id);
    setGenerating(false);
    if (result.error) setGenError(result.error);
    else setExpanded(null);
  };

  const handleSend = async (step: FollowUpStep) => {
    setSending(step.id);

    if (step.channel === 'whatsapp') {
      const link = whatsappLink(prospect.business, step.message);
      if (link) {
        window.open(link, '_blank');
        void incrementToday();
      }
    } else {
      // Email: open mailto with message as body
      const subject = encodeURIComponent(`Following up — ${prospect.business.name}`);
      const body = encodeURIComponent(step.message);
      const to = encodeURIComponent(prospect.business.email ?? '');
      window.open(`mailto:${to}?subject=${subject}&body=${body}`, '_blank');
    }

    await updateSequenceStep(prospect.business.id, step.id, 'sent');
    setSending(null);
  };

  const handleSkip = async (step: FollowUpStep) => {
    setSending(step.id);
    await updateSequenceStep(prospect.business.id, step.id, 'skipped');
    setSending(null);
  };

  const sentCount = steps.filter((s) => s.status === 'sent').length;
  const progress = hasSequence ? Math.round((sentCount / steps.length) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="font-black text-white text-sm leading-none">Follow-up Sequence</h2>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-none truncate max-w-[200px]">
                {prospect.business.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasSequence && dueCount > 0 && (
              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                {dueCount} due
              </span>
            )}
            <button onClick={onClose} className="w-8 h-8 bg-white/8 hover:bg-white/15 rounded-full flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {!hasSequence ? (
            /* Empty state */
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-purple-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="font-black text-white text-base mb-2">No sequence yet</h3>
              <p className="text-gray-400 text-sm mb-1 max-w-xs mx-auto">
                AI will generate a 5-step follow-up plan — WhatsApp + email messages timed across 30 days.
              </p>
              <p className="text-gray-600 text-xs mb-6">Each message has a different angle so you never sound repetitive.</p>

              {genError && (
                <p className="text-red-400 text-xs mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  {genError}
                </p>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-xl transition-colors"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {generating ? 'Generating…' : 'Generate Sequence'}
              </button>
            </div>
          ) : (
            <>
              {/* Progress bar */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-gray-500">{sentCount}/{steps.length} steps completed</span>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-400 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${generating ? 'animate-spin' : ''}`} />
                    Regenerate
                  </button>
                </div>
                <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-2.5">
                {steps.map((step, idx) => {
                  const st = stepStatus(step);
                  const styles = STATUS_STYLES[st];
                  const isExpanded = expanded === step.id;
                  const isActionable = st === 'due' || st === 'overdue';

                  return (
                    <div
                      key={step.id}
                      className={`border rounded-xl overflow-hidden transition-all ${styles.card}`}
                    >
                      {/* Step header */}
                      <button
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                        onClick={() => setExpanded(isExpanded ? null : step.id)}
                      >
                        {/* Step number + dot */}
                        <div className="flex-shrink-0 flex flex-col items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${styles.dot}`} />
                          {idx < steps.length - 1 && (
                            <div className="w-px h-3 bg-white/10" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-wider">Day {step.day}</span>
                            {step.channel === 'whatsapp'
                              ? <MessageCircle className="w-3 h-3 text-green-500" />
                              : <Mail className="w-3 h-3 text-blue-400" />}
                            <span className={`text-[10px] font-bold ${styles.label}`}>{STATUS_LABELS[st]}</span>
                          </div>
                          <p className="text-xs font-semibold text-white truncate">{step.label}</p>
                          {!isExpanded && (
                            <p className="text-[11px] text-gray-500 truncate mt-0.5">{step.message.slice(0, 60)}…</p>
                          )}
                        </div>

                        {/* Date */}
                        <div className="flex-shrink-0 text-right">
                          <span className="text-[10px] text-gray-600">{step.dueDate}</span>
                        </div>
                      </button>

                      {/* Expanded message + actions */}
                      {isExpanded && (
                        <div className="px-3 pb-3 border-t border-white/5 pt-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="bg-black/20 rounded-lg px-3 py-2.5 mb-3">
                            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{step.message}</p>
                          </div>

                          {st !== 'done' && st !== 'skipped' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSend(step)}
                                disabled={sending === step.id}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                                  isActionable
                                    ? 'bg-green-600 hover:bg-green-500 text-white'
                                    : 'bg-white/8 hover:bg-white/15 text-gray-300 border border-white/10'
                                } disabled:opacity-60`}
                              >
                                {sending === step.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : step.channel === 'whatsapp'
                                    ? <MessageCircle className="w-3 h-3" />
                                    : <Mail className="w-3 h-3" />}
                                {step.channel === 'whatsapp' ? 'Send WhatsApp' : 'Open Email'}
                              </button>
                              <button
                                onClick={() => handleSkip(step)}
                                disabled={sending === step.id}
                                className="px-3 py-2 rounded-lg text-xs font-bold text-gray-500 hover:text-gray-300 bg-white/5 hover:bg-white/10 border border-white/8 transition-all disabled:opacity-60 flex items-center gap-1"
                              >
                                <SkipForward className="w-3 h-3" /> Skip
                              </button>
                            </div>
                          )}

                          {st === 'done' && (
                            <div className="flex items-center gap-1.5 text-green-400 text-xs font-semibold">
                              <Check className="w-3.5 h-3.5" />
                              Sent {step.sentAt ? `on ${step.sentAt.split('T')[0]}` : ''}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
