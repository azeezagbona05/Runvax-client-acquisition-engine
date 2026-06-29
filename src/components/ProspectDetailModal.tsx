'use client';

import { useState } from 'react';
import {
  X, Star, Phone, Globe, MapPin, MessageCircle, ChevronLeft, ChevronRight,
  Trash2, Bell, BellOff, StickyNote, Clock, Send, FileText, Zap, Check,
} from 'lucide-react';
import { useProspects } from '@/context/ProspectsContext';
import { SavedProspect, ProspectStage, ConversationEntry, FollowUpStep } from '@/types';
import { scoreLabel, formatPrice } from '@/lib/scoring';
import { whatsappLink } from '@/lib/phone';

const STAGES: Array<{ id: ProspectStage; icon: string; label: string; color: string }> = [
  { id: 'found',      icon: '🔵', label: 'Found',      color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
  { id: 'contacted',  icon: '📱', label: 'Contacted',  color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
  { id: 'interested', icon: '🤝', label: 'Interested', color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
  { id: 'proposal',   icon: '📄', label: 'Proposal',   color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
  { id: 'won',        icon: '🏆', label: 'Won',        color: 'text-green-400 border-green-500/30 bg-green-500/10' },
  { id: 'lost',       icon: '❌', label: 'Lost',       color: 'text-red-400 border-red-500/30 bg-red-500/10' },
];

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: '💬 WhatsApp', email: '✉️ Email', call: '📞 Call', note: '📝 Note',
};

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (d < 1) return 'just now';
  if (d < 60) return `${d}m ago`;
  if (d < 1440) return `${Math.floor(d / 60)}h ago`;
  return `${Math.floor(d / 1440)}d ago`;
}

interface Props {
  prospect: SavedProspect;
  onClose: () => void;
}

export default function ProspectDetailModal({ prospect, onClose }: Props) {
  const { updateStage, updateNotes, setReminder, clearReminder, setFollowUpSequence, remove, addConversationEntry } = useProspects();
  const { business, stage, score, estimatedPrice, notes: initNotes, reminderDate, reminderNote, outreachSentAt, followUpSequence, conversations = [], savedAt } = prospect;
  const { label: scoreText, color: scoreColor } = scoreLabel(score);

  const [notes, setNotes] = useState(initNotes ?? '');
  const [notesDirty, setNotesDirty] = useState(false);
  const [remDate, setRemDate] = useState(reminderDate ?? '');
  const [remNote, setRemNote] = useState(reminderNote ?? '');
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [seqState, setSeqState] = useState<FollowUpStep[]>(followUpSequence ?? []);

  function addOffsetDays(startIso: string, days: number): string {
    const d = new Date(startIso);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  const startSequence = async () => {
    const now = new Date().toISOString();
    const steps: FollowUpStep[] = [
      { day: 1, channel: 'whatsapp', label: 'Initial outreach',    dueDate: addOffsetDays(now, 1) },
      { day: 3, channel: 'whatsapp', label: 'Follow-up check-in',  dueDate: addOffsetDays(now, 3) },
      { day: 7, channel: 'email',    label: 'Final angle (email)',  dueDate: addOffsetDays(now, 7) },
    ];
    setSeqState(steps);
    await setFollowUpSequence(business.id, steps);
  };

  const markStepSent = async (dayNum: number) => {
    const updated = seqState.map((s) =>
      s.day === dayNum ? { ...s, sentAt: new Date().toISOString() } : s
    );
    setSeqState(updated);
    await setFollowUpSequence(business.id, updated);
  };

  const clearSequence = async () => {
    setSeqState([]);
    await setFollowUpSequence(business.id, []);
  };

  const stageIdx = STAGES.findIndex((s) => s.id === stage);
  const currentStage = STAGES[stageIdx];
  const isOverdue = reminderDate && new Date(reminderDate) < new Date() && stage !== 'won' && stage !== 'lost';

  const saveNotes = async () => {
    if (!notesDirty) return;
    await updateNotes(business.id, notes);
    setNotesDirty(false);
  };

  const saveReminder = async () => {
    if (!remDate) return;
    setSaving(true);
    await setReminder(business.id, remDate, remNote);
    setSaving(false);
    setShowReminderForm(false);
  };

  const handleClearReminder = async () => {
    await clearReminder(business.id);
    setRemDate('');
    setRemNote('');
    setShowReminderForm(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Remove ${business.name} from your pipeline?`)) return;
    await remove(business.id);
    onClose();
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    await addConversationEntry(business.id, { type: 'note', channel: 'note', content: newNote.trim() });
    setNewNote('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-white/8 flex-shrink-0">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600/40 to-orange-500/30 rounded-xl flex items-center justify-center text-lg font-black text-white flex-shrink-0">
            {business.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-white text-base leading-tight truncate">{business.name}</h2>
            <p className="text-xs text-purple-400 font-medium mt-0.5">{business.category}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs font-black px-2 py-1 rounded-lg border ${scoreColor}`}>{score}/10 · {scoreText}</span>
            <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Stage selector */}
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Stage</p>
            <div className="flex gap-1.5 flex-wrap">
              {STAGES.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => updateStage(business.id, s.id)}
                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                    stage === s.id ? s.color : 'text-gray-600 border-white/8 hover:border-white/20 hover:text-gray-400'
                  }`}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
            {/* Move arrows */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => stageIdx > 0 && updateStage(business.id, STAGES[stageIdx - 1].id)}
                disabled={stageIdx === 0}
                className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-3 h-3" /> Previous
              </button>
              <button
                onClick={() => stageIdx < STAGES.length - 1 && updateStage(business.id, STAGES[stageIdx + 1].id)}
                disabled={stageIdx === STAGES.length - 1}
                className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 disabled:opacity-30 transition-colors"
              >
                Next <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Business info */}
          <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 space-y-2.5">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Business Info</p>
            {business.address && (
              <div className="flex items-start gap-2 text-sm text-gray-300">
                <MapPin className="w-3.5 h-3.5 text-gray-600 flex-shrink-0 mt-0.5" /> {business.address}
              </div>
            )}
            {business.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                <a href={`tel:${business.phone}`} className="text-sm text-blue-400 hover:underline">{business.phone}</a>
                <a href={whatsappLink(business) ?? '#'} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full hover:bg-green-500/20 transition-colors flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> WhatsApp
                </a>
              </div>
            )}
            {business.website ? (
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                <a href={business.website} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:underline truncate">{business.website}</a>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-red-500/60 flex-shrink-0" />
                <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full font-semibold">No website — prime prospect</span>
              </div>
            )}
            {business.rating && (
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                {business.rating} · {business.reviewCount} reviews
              </div>
            )}
            {estimatedPrice && (
              <div className="text-sm text-gray-300 font-semibold">
                💰 Est. {formatPrice(estimatedPrice.min)} – {formatPrice(estimatedPrice.max)}
              </div>
            )}
            {outreachSentAt && (
              <div className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-lg inline-block">
                ✉ Outreach sent {timeAgo(outreachSentAt)}
              </div>
            )}
          </div>

          {/* AI quick actions */}
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Quick Actions</p>
            <div className="flex gap-2 flex-wrap">
              <a href={`/?prefill=${encodeURIComponent(business.name)}`}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-purple-600/15 text-purple-400 border border-purple-500/20 hover:bg-purple-600/25 transition-colors">
                <Send className="w-3.5 h-3.5" /> Generate Outreach
              </a>
              <a href={`/?prefill=${encodeURIComponent(business.name)}&tab=proposal`}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-colors">
                <FileText className="w-3.5 h-3.5" /> Generate Proposal
              </a>
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5" /> Notes
            </p>
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
              onBlur={saveNotes}
              placeholder="Add notes about this prospect…"
              rows={3}
              className="w-full bg-gray-800/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 resize-none transition-colors"
            />
            {notesDirty && (
              <button onClick={saveNotes} className="text-xs text-purple-400 hover:text-purple-300 mt-1 font-semibold">Save notes</button>
            )}
          </div>

          {/* Follow-up Sequence */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Follow-up Sequence
              </p>
              {seqState.length > 0 && (
                <button onClick={clearSequence} className="text-[11px] text-red-400 hover:text-red-300 transition-colors">
                  Clear
                </button>
              )}
            </div>

            {seqState.length === 0 ? (
              <button
                onClick={startSequence}
                className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors w-full justify-center"
              >
                <Zap className="w-3.5 h-3.5" /> Start 3-Step Sequence
              </button>
            ) : (
              <div className="space-y-2">
                {seqState.map((step) => {
                  const isToday = step.dueDate === new Date().toISOString().split('T')[0];
                  const isPast = !step.sentAt && step.dueDate < new Date().toISOString().split('T')[0];
                  return (
                    <div
                      key={step.day}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
                        step.sentAt
                          ? 'bg-green-500/5 border-green-500/15 opacity-60'
                          : isPast
                          ? 'bg-red-500/10 border-red-500/20'
                          : isToday
                          ? 'bg-amber-500/10 border-amber-500/25'
                          : 'bg-white/[0.03] border-white/8'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black ${
                        step.sentAt ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-gray-400'
                      }`}>
                        {step.sentAt ? <Check className="w-3.5 h-3.5" /> : step.day}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-white">{step.label}</div>
                        <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                          {step.channel === 'whatsapp' ? '💬' : '✉️'} {step.channel}
                          {' · '}
                          {step.sentAt ? (
                            <span className="text-green-400">Sent {new Date(step.sentAt).toLocaleDateString('en-GB')}</span>
                          ) : isPast ? (
                            <span className="text-red-400">Overdue · was {step.dueDate}</span>
                          ) : isToday ? (
                            <span className="text-amber-400 font-bold">Due today</span>
                          ) : (
                            <span>Due {step.dueDate}</span>
                          )}
                        </div>
                      </div>
                      {!step.sentAt && (
                        <button
                          onClick={() => markStepSent(step.day)}
                          className="flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-white/5 hover:bg-green-500/20 text-gray-400 hover:text-green-400 border border-white/10 transition-colors"
                        >
                          Mark sent
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reminder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" /> Reminder
              </p>
              {reminderDate && (
                <button onClick={handleClearReminder} className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1">
                  <BellOff className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            {reminderDate && !showReminderForm ? (
              <div
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer hover:border-white/20 transition-colors ${isOverdue ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-orange-500/10 border-orange-500/20 text-orange-400'}`}
                onClick={() => setShowReminderForm(true)}
              >
                <div>
                  <div className="text-sm font-bold">{isOverdue ? '⚠️ Overdue' : '🔔'} {reminderDate}</div>
                  {reminderNote && <div className="text-xs text-gray-400 mt-0.5">{reminderNote}</div>}
                </div>
                <span className="text-[10px] text-gray-600">Edit</span>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="date" value={remDate} onChange={(e) => setRemDate(e.target.value)}
                  className="w-full bg-gray-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
                />
                <input
                  type="text" value={remNote} onChange={(e) => setRemNote(e.target.value)}
                  placeholder="Reminder note (optional)"
                  className="w-full bg-gray-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                />
                <div className="flex gap-2">
                  <button onClick={saveReminder} disabled={!remDate || saving}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-sm transition-colors">
                    {saving ? 'Saving…' : 'Set reminder'}
                  </button>
                  {reminderDate && (
                    <button onClick={() => setShowReminderForm(false)} className="px-4 text-gray-500 hover:text-gray-300 text-sm">Cancel</button>
                  )}
                </div>
              </div>
            )}

            {!reminderDate && !showReminderForm && (
              <button onClick={() => setShowReminderForm(true)}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5 transition-colors">
                <Bell className="w-3.5 h-3.5" /> Set a follow-up reminder
              </button>
            )}
          </div>

          {/* Conversation / activity log */}
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Activity ({conversations.length})
            </p>

            {/* Add note */}
            <div className="flex gap-2 mb-3">
              <input
                type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNote()}
                placeholder="Log a call, note, or update…"
                className="flex-1 bg-gray-800/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
              />
              <button onClick={addNote} disabled={!newNote.trim()}
                className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/35 text-purple-400 rounded-xl border border-purple-500/20 disabled:opacity-30 transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </div>

            {conversations.length === 0 ? (
              <p className="text-xs text-gray-700 text-center py-4">No activity yet</p>
            ) : (
              <div className="space-y-2">
                {[...conversations].reverse().map((c: ConversationEntry) => (
                  <div key={c.id} className="flex items-start gap-2.5 p-2.5 bg-white/[0.02] border border-white/6 rounded-xl">
                    <div className="text-[11px] text-gray-600 flex-shrink-0 w-20 pt-0.5">{CHANNEL_LABELS[c.channel] ?? c.channel}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300 line-clamp-3">{c.content}</p>
                    </div>
                    <span className="text-[10px] text-gray-700 flex-shrink-0">{timeAgo(c.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Meta + danger */}
          <div className="border-t border-white/8 pt-4 flex items-center justify-between">
            <span className="text-[11px] text-gray-700">
              Saved {new Date(savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 text-[11px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors">
              <Trash2 className="w-3 h-3" /> Remove prospect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
