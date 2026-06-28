'use client';

import { useState } from 'react';
import {
  X, MapPin, Phone, Globe, Star, Clock, Loader2, Sparkles,
  ExternalLink, MessageCircle, FileText, AlertTriangle,
  Bookmark, BookmarkX, TrendingUp, MessageSquare,
} from 'lucide-react';
import { Business } from '@/types';
import { useProspects } from '@/context/ProspectsContext';
import { scoreProspect, scoreLabel, estimatePrice, formatPrice } from '@/lib/scoring';
import OutreachModal from './OutreachModal';
import ProposalModal from './ProposalModal';
import WeaknessModal from './WeaknessModal';
import ConversationPanel from './ConversationPanel';

type DrawerTab = 'details' | 'outreach' | 'conversation';

type ProspectStage = 'found' | 'contacted' | 'interested' | 'proposal' | 'won' | 'lost';

const STAGES: Array<{ id: ProspectStage; icon: string; label: string; color: string }> = [
  { id: 'found',      icon: '🔵', label: 'Found',     color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { id: 'contacted',  icon: '📱', label: 'Contacted', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { id: 'interested', icon: '🤝', label: 'Interested',color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { id: 'proposal',   icon: '📄', label: 'Proposal',  color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { id: 'won',        icon: '🏆', label: 'Won',       color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  { id: 'lost',       icon: '❌', label: 'Lost',      color: 'bg-red-500/20 text-red-300 border-red-500/30' },
];

interface Props {
  business: Business;
  onClose: () => void;
  onGenerate: () => void;
  generating: boolean;
  generateError?: string | null;
}

export default function BusinessDrawer({ business, onClose, onGenerate, generating, generateError }: Props) {
  const { isSaved, save, remove, get, updateStage, updateNotes, setReminder, clearReminder } = useProspects();
  const saved = isSaved(business.id);
  const prospect = get(business.id);

  const [activeTab, setActiveTab] = useState<DrawerTab>('details');
  const [localNotes, setLocalNotes] = useState(prospect?.notes ?? '');
  const [reminderDate, setReminderDate] = useState(prospect?.reminderDate ?? '');
  const [reminderNote, setReminderNote] = useState(prospect?.reminderNote ?? '');
  const [showOutreach, setShowOutreach] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  const [showWeakness, setShowWeakness] = useState(false);

  const conversationCount = prospect?.conversations?.length ?? 0;

  const score = scoreProspect(business);
  const { label: scoreText, color: scoreColor } = scoreLabel(score);
  const price = estimatePrice(business.category, business.categoryTypes);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.name)}&query_place_id=${business.id}`;

  const handleSaveToggle = () => {
    saved ? remove(business.id) : save(business);
    setLocalNotes('');
  };

  const handleStage = (stage: ProspectStage) => {
    if (!saved) save(business);
    updateStage(business.id, stage);
  };

  const handleNotesBlur = () => {
    if (!saved && localNotes) save(business);
    updateNotes(business.id, localNotes);
  };

  const handleReminderSave = () => {
    if (!reminderDate) { clearReminder(business.id); return; }
    if (!saved) save(business);
    setReminder(business.id, reminderDate, reminderNote);
  };

  const currentStage = prospect?.stage ?? 'found';

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-gray-900 border-l border-white/10 z-50 flex flex-col animate-slide-in-right shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gray-900/95 backdrop-blur border-b border-white/10 px-5 py-4 flex items-start justify-between gap-4 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-white text-lg leading-tight line-clamp-2 mb-0.5">{business.name}</h2>
            <span className="text-sm text-purple-400 font-medium">{business.category}</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 flex-shrink-0">
          {(['details', 'outreach', 'conversation'] as const).map((tabId) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${
                activeTab === tabId
                  ? 'text-purple-400 border-purple-400'
                  : 'text-gray-600 border-transparent hover:text-gray-400'
              }`}
            >
              {tabId === 'details' ? 'Details' : tabId === 'outreach' ? 'Outreach' : 'Convo'}
              {tabId === 'conversation' && conversationCount > 0 && (
                <span className="bg-purple-500/20 text-purple-300 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  {conversationCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── OUTREACH TAB ── */}
          {activeTab === 'outreach' && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Choose an action</p>
              <button
                onClick={() => setShowOutreach(true)}
                className="w-full flex items-center gap-3 px-4 py-4 bg-green-600/15 hover:bg-green-600/25 text-green-400 border border-green-500/20 rounded-xl text-sm font-semibold transition-colors"
              >
                <MessageCircle className="w-5 h-5 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-bold">Cold Outreach Message</div>
                  <div className="text-xs text-green-400/60 mt-0.5">Generate BAB / AIDA / PAS / Story message</div>
                </div>
              </button>
              <button
                onClick={() => setShowProposal(true)}
                className="w-full flex items-center gap-3 px-4 py-4 bg-purple-600/15 hover:bg-purple-600/25 text-purple-400 border border-purple-500/20 rounded-xl text-sm font-semibold transition-colors"
              >
                <FileText className="w-5 h-5 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-bold">Generate Proposal</div>
                  <div className="text-xs text-purple-400/60 mt-0.5">Full project proposal with pricing</div>
                </div>
              </button>
              {!business.hasWebsite && (
                <>
                  <button
                    onClick={onGenerate}
                    disabled={generating}
                    className="w-full flex items-center gap-3 px-4 py-4 bg-orange-600/15 hover:bg-orange-600/25 text-orange-400 border border-orange-500/20 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {generating ? <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" /> : <Sparkles className="w-5 h-5 flex-shrink-0" />}
                    <div className="text-left">
                      <div className="font-bold">Generate Lovable Website Prompt</div>
                      <div className="text-xs text-orange-400/60 mt-0.5">AI prompt to build their website</div>
                    </div>
                  </button>
                  {generateError && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                      ⚠ {generateError}
                    </p>
                  )}
                </>
              )}
              {business.hasWebsite && (
                <button
                  onClick={() => setShowWeakness(true)}
                  className="w-full flex items-center gap-3 px-4 py-4 bg-yellow-600/15 hover:bg-yellow-600/25 text-yellow-400 border border-yellow-500/20 rounded-xl text-sm font-semibold transition-colors"
                >
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <div className="text-left">
                    <div className="font-bold">Website Weakness Report</div>
                    <div className="text-xs text-yellow-400/60 mt-0.5">Analyse what&apos;s wrong with their site</div>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* ── CONVERSATION TAB ── */}
          {activeTab === 'conversation' && (
            <div>
              {!saved && (
                <div className="mb-4 bg-yellow-900/30 border border-yellow-500/20 rounded-xl px-4 py-3 text-yellow-300 text-sm">
                  <span className="font-bold">Save to pipeline first</span> to track conversations.
                  <button onClick={() => save(business)} className="ml-2 underline hover:no-underline">Save now</button>
                </div>
              )}
              {saved && <ConversationPanel business={business} />}
              {!saved && (
                <div className="text-center py-8 border border-dashed border-white/10 rounded-2xl">
                  <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Save this prospect to start tracking conversations</p>
                </div>
              )}
            </div>
          )}

          {/* ── DETAILS TAB ── */}
          {activeTab === 'details' && <>

          {/* Status banner */}
          {business.hasWebsite ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3">
              <Globe className="w-5 h-5 text-green-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-green-400 font-bold text-sm">Has a Website</div>
                <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-green-300/60 text-xs hover:underline truncate block">
                  {business.website}
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-orange-500/10 border border-orange-500/25 rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl">🎯</span>
              <div>
                <div className="text-orange-400 font-bold">No Website Found</div>
                <div className="text-orange-300/60 text-xs">This is a hot prospect — they need you!</div>
              </div>
            </div>
          )}

          {/* Score + Price row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Prospect Score</div>
              <div className={`text-sm font-bold px-2 py-0.5 rounded-full border inline-block ${scoreColor}`}>
                {scoreText} — {score}/10
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Price Estimate</div>
              <div className="text-sm font-bold text-white">
                {formatPrice(price.min)} <span className="text-gray-500">–</span> {formatPrice(price.max)}
              </div>
            </div>
          </div>

          {/* "What You're Missing" card — only for no-website businesses */}
          {!business.hasWebsite && (
            <div className="bg-gradient-to-br from-orange-900/30 to-red-900/20 border border-orange-500/20 rounded-xl p-4">
              <div className="text-orange-400 font-bold text-sm mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" /> What They're Missing Without a Website
              </div>
              <ul className="space-y-1.5">
                {[
                  "❌ Customers can't find them when searching online",
                  '❌ No way to accept bookings or orders 24/7',
                  '❌ Lost to competitors who do have a website',
                  '❌ No professional presence to build trust',
                ].map((item) => (
                  <li key={item} className="text-gray-300 text-xs leading-snug">{item}</li>
                ))}
              </ul>
              {business.rating && business.reviewCount && business.reviewCount > 20 && (
                <div className="mt-3 text-xs text-orange-300/70 bg-orange-500/10 rounded-lg px-3 py-2">
                  ⭐ With {business.reviewCount} reviews, they have a strong reputation — a website would turn that trust into real sales.
                </div>
              )}
            </div>
          )}

          {/* Contact info */}
          <div className="space-y-2.5">
            {business.address && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-300 text-sm leading-snug">{business.address}</span>
              </div>
            )}
            {business.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <a href={`tel:${business.phone}`} className="text-gray-300 text-sm hover:text-white transition-colors">
                  {business.phone}
                </a>
              </div>
            )}
            {business.rating ? (
              <div className="flex items-center gap-3">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                <span className="text-gray-300 text-sm">{business.rating} / 5 &nbsp;·&nbsp; {business.reviewCount} reviews</span>
              </div>
            ) : null}
          </div>

          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> View on Google Maps
          </a>

          {/* ── Pipeline Stage ── */}
          <div>
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Pipeline Stage</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {STAGES.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => handleStage(stage.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    currentStage === stage.id && saved
                      ? stage.color
                      : 'bg-white/5 text-gray-500 border-white/8 hover:bg-white/10 hover:text-gray-300'
                  }`}
                >
                  <span>{stage.icon}</span> {stage.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Notes ── */}
          <div>
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Notes</h3>
            <textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add notes about this prospect…"
              rows={3}
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none transition-colors"
            />
          </div>

          {/* ── Reminder ── */}
          <div>
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Follow-up Reminder</h3>
            <div className="space-y-2">
              <input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors"
              />
              <input
                type="text"
                value={reminderNote}
                onChange={(e) => setReminderNote(e.target.value)}
                placeholder="Reminder note (e.g. Call back, Send proposal)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
              />
              <button
                onClick={handleReminderSave}
                className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
              >
                {reminderDate ? '💾 Save Reminder' : '🗑 Clear Reminder'}
              </button>
            </div>
          </div>

          {/* ── Description ── */}
          {business.description && (
            <div>
              <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">About</h3>
              <p className="text-gray-300 text-sm leading-relaxed">{business.description}</p>
            </div>
          )}

          {/* ── Opening hours ── */}
          {business.openingHours && business.openingHours.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Opening Hours
              </h3>
              <div className="space-y-1">
                {business.openingHours.map((h, i) => (
                  <div key={i} className="text-sm text-gray-400">{h}</div>
                ))}
              </div>
            </div>
          )}

          {/* ── Reviews ── */}
          {business.reviews && business.reviews.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">Customer Reviews</h3>
              <div className="space-y-3">
                {business.reviews.map((r, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-gray-300">{r.author}</span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Star key={j} className={`w-3 h-3 ${j < r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-700'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{r.text}</p>
                    <p className="text-[11px] text-gray-600 mt-1.5">{r.time}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          </> /* end details tab */}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-gray-900/95 backdrop-blur border-t border-white/10 p-4">
          <button
            onClick={handleSaveToggle}
            className={`w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl transition-all text-sm ${
              saved
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/25'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {saved ? (
              <><BookmarkX className="w-4 h-4" /> Remove from Pipeline</>
            ) : (
              <><Bookmark className="w-4 h-4" /> Save to Pipeline</>
            )}
          </button>
        </div>
      </div>

      {showOutreach && <OutreachModal business={business} onClose={() => setShowOutreach(false)} />}
      {showProposal && <ProposalModal business={business} onClose={() => setShowProposal(false)} />}
      {showWeakness && <WeaknessModal business={business} onClose={() => setShowWeakness(false)} />}
    </>
  );
}
