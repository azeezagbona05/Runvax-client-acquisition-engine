'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, RefreshCw, MessageCircle, Mail, Loader2, Send, Lock, Check, AlertTriangle } from 'lucide-react';
import { Business } from '@/types';
import { useProspects } from '@/context/ProspectsContext';
import type { OutreachFramework } from '@/app/api/outreach/route';
import type { OfferType } from '@/lib/opportunity/types';
import { detectOpportunities } from '@/lib/opportunity/detect';
import { whatsappLink } from '@/lib/phone';
import { useHandleAIResponse } from '@/context/UpgradeContext';
import EditablePitch from './EditablePitch';
import SaturationBadge from './SaturationBadge';

interface Props {
  business: Business;
  onClose: () => void;
  /** Pre-composed draft (from Rex's autonomous queue) — skips the "Ready to generate" step. */
  initialData?: OutreachData;
  /** When set, sending marks this OutreachDraft as sent so it leaves the queue. */
  draftId?: string;
}

type Tab = 'whatsapp' | 'email';

interface OpportunitySummary {
  type: OfferType;
  title: string;
  score: number;
  band: string;
  confidence: string;
  reason: string;
  evidence: string[];
  components: string[];
}

export interface OutreachData {
  whatsapp: string;
  emailSubject: string;
  emailBody: string;
  framework: OutreachFramework;
  opportunity?: OpportunitySummary | null;
  availableOffers?: Array<{ type: OfferType; title: string; score: number }>;
  /** What Rex recalled about this prospect and used while writing this message. */
  priorContext?: string[];
}

const OFFER_LABEL: Record<OfferType, string> = {
  website: 'Website',
  ai_system: 'AI Automation',
};


function renderWhatsApp(text: string): React.ReactNode {
  return text.split('\n').map((line, i) => {
    // Parse *bold*, _italic_, ~strike~ within each line
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    const push = (str: string, tag?: 'b' | 'i' | 's') => {
      if (!str) return;
      if (tag === 'b') parts.push(<strong key={key++} className="font-bold text-white">{str}</strong>);
      else if (tag === 'i') parts.push(<em key={key++} className="italic text-green-200">{str}</em>);
      else if (tag === 's') parts.push(<s key={key++} className="line-through opacity-60">{str}</s>);
      else parts.push(<span key={key++}>{str}</span>);
    };

    // Simple sequential parser: find first */_/~ marker
    while (remaining.length > 0) {
      const boldIdx   = remaining.indexOf('*');
      const italicIdx = remaining.indexOf('_');
      const strikeIdx = remaining.indexOf('~');

      const candidates = [
        boldIdx   >= 0 ? { idx: boldIdx,   marker: '*', tag: 'b' as const } : null,
        italicIdx >= 0 ? { idx: italicIdx, marker: '_', tag: 'i' as const } : null,
        strikeIdx >= 0 ? { idx: strikeIdx, marker: '~', tag: 's' as const } : null,
      ].filter(Boolean) as { idx: number; marker: string; tag: 'b' | 'i' | 's' }[];

      if (candidates.length === 0) { push(remaining); break; }
      candidates.sort((a, b) => a.idx - b.idx);
      const { idx, marker, tag } = candidates[0];
      push(remaining.slice(0, idx));
      const closeIdx = remaining.indexOf(marker, idx + 1);
      if (closeIdx < 0) { push(remaining.slice(idx)); break; }
      push(remaining.slice(idx + 1, closeIdx), tag);
      remaining = remaining.slice(closeIdx + 1);
    }

    return (
      <span key={i}>
        {parts}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    );
  });
}

export default function OutreachModal({ business, onClose, initialData, draftId }: Props) {
  const router = useRouter();
  const { markOutreachSent, incrementToday, updateStage, isSaved, save } = useProspects();
  const handleAIResponse = useHandleAIResponse();
  const [tab, setTab] = useState<Tab>('whatsapp');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OutreachData | null>(initialData ?? null);
  const [error, setError] = useState('');
  const [recipientEmail, setRecipientEmail] = useState(business.email ?? '');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [signupGate, setSignupGate] = useState(false);
  const [findingEmail, setFindingEmail] = useState(false);
  const [emailNotFound, setEmailNotFound] = useState(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detection is a pure function over the business record, so the modal can show
  // what this business qualifies for before spending an AI call.
  const detected = useMemo(() => detectOpportunities(business), [business]);
  const [offer, setOffer] = useState<OfferType | null>(null);

  // The default is what detection suggests. When nothing qualifies we still have
  // to pick something sensible: pitching a website to a business that already has
  // one is the one answer that is always wrong.
  const defaultOffer: OfferType =
    detected.primary?.type ?? (business.hasWebsite ? 'ai_system' : 'website');
  const activeOffer: OfferType = offer ?? defaultOffer;
  const activeOpportunity = detected.all.find((o) => o.type === activeOffer) ?? null;

  useEffect(() => () => { if (lockTimer.current) clearTimeout(lockTimer.current); }, []);

  // Auto-find email when email tab opens with no email
  useEffect(() => {
    if (tab !== 'email' || recipientEmail || findingEmail) return;
    setEmailNotFound(false);
    setFindingEmail(true);
    fetch('/api/enrich-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        website: business.website,
        name: business.name,
        location: business.address,
        phone: business.phone,
      }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.email) setRecipientEmail(json.email);
        else setEmailNotFound(true);
      })
      .catch(() => setEmailNotFound(true))
      .finally(() => setFindingEmail(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const showDemoAndLock = () => {
    const city = business.address?.split(',')[0] ?? 'your area';
    const niche = (business.category ?? 'business').toLowerCase();
    setData({
      whatsapp: `Hi! I noticed ${business.name} doesn't have a website yet — you're losing customers who search online before they visit. In 2026, even ChatGPT recommends local businesses from their websites. I build digital front doors for ${niche} businesses in ${city}. Can I show you what yours could look like? 🏪`,
      emailSubject: `${business.name} — your customers can't find you online`,
      emailBody: `Hi ${business.name},\n\nI was looking for ${niche} businesses in ${city} and noticed you don't have a website yet.\n\nIn 2026, when someone asks ChatGPT or searches Google for "best ${niche} near me", only businesses with websites show up. Right now, you're invisible to those customers — and they're going to your competitors.\n\nI build digital front doors for local businesses — not just a website, but a 24/7 presence that gets discovered on Google AND by AI tools like ChatGPT and Perplexity.\n\nWould you be open to a quick 5-minute chat this week?\n\nWarm regards,\n[Your Name]`,
      framework: 'PAS' as OutreachFramework,
    });
    lockTimer.current = setTimeout(() => setSignupGate(true), 1000);
  };

  const generate = async () => {
    setLoading(true);
    setError('');
    setSignupGate(false);
    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business, competitors: business.competitors, offer: activeOffer, timeOfDay: (() => { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'; })() }),
      });
      const json = await res.json();
      const handled = handleAIResponse(res, json);
      if (handled === 'auth') { showDemoAndLock(); return; }
      if (handled) return;
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkSent = (channel: 'whatsapp' | 'email' = 'whatsapp') => {
    if (!isSaved(business.id)) save(business);
    const content = channel === 'whatsapp' ? data?.whatsapp : data?.emailBody;
    markOutreachSent(business.id, content ?? '', channel, data?.framework);
    updateStage(business.id, 'contacted');
    incrementToday();
    if (draftId) {
      fetch(`/api/outreach-drafts/${draftId}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      }).catch(() => { /* best-effort — the draft just stays in the queue if this fails */ });
    }
  };

  const sendEmailDirectly = async () => {
    if (!recipientEmail.trim()) { setSendResult({ ok: false, msg: 'Enter recipient email address.' }); return; }
    if (!data) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail.trim(),
          subject: data.emailSubject,
          body: data.emailBody,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setSendResult({ ok: true, msg: `Email sent to ${recipientEmail}!` });
      handleMarkSent('email');
    } catch (e: unknown) {
      setSendResult({ ok: false, msg: e instanceof Error ? e.message : 'Failed to send' });
    } finally {
      setSending(false);
    }
  };

  const whatsappUrl = business.phone
    ? whatsappLink(business, data?.whatsapp)
    : null;

  const updateData = (patch: Partial<OutreachData>) => setData((d) => (d ? { ...d, ...patch } : d));
  const pitchContext = {
    name: business.name,
    category: business.category,
    reviewCount: business.reviewCount,
    rating: business.rating,
    city: business.address?.split(',')[0],
  };;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="font-black text-white text-lg">Outreach Message</h2>
            <p className="text-sm text-gray-500">{business.name} · {business.category}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Content tabs */}
          {data && (
            <div className="flex gap-1 px-4 pt-3">
              <button
                onClick={() => setTab('whatsapp')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  tab === 'whatsapp' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </button>
              <button
                onClick={() => setTab('email')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  tab === 'email' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Mail className="w-4 h-4" /> Email
              </button>
            </div>
          )}

          <div className="p-4 space-y-4 relative">
            {/* Signup gate overlay */}
            {signupGate && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-950/85 backdrop-blur-sm rounded-xl m-0">
                <div className="text-center px-6 py-8 max-w-xs mx-auto">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-purple-900/30">
                    <Lock className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-white font-black text-lg mb-2">Your message is ready!</h3>
                  <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                    Create a free account to copy, send, and save unlimited AI-generated outreach messages.
                  </p>
                  <button
                    onClick={() => router.push('/auth/signup')}
                    className="w-full bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 text-white font-black py-3 rounded-xl text-sm transition-all shadow-lg shadow-purple-900/30 mb-3"
                  >
                    Sign up free — it takes 30 seconds
                  </button>
                  <button
                    onClick={() => router.push('/auth/signin')}
                    className="w-full text-gray-500 hover:text-gray-300 text-sm transition-colors"
                  >
                    Already have an account? Sign in
                  </button>
                </div>
              </div>
            )}

            {/* Competition check — shown before and after generating, so the user
                can decide whether this lead is worth a message at all, and knows
                to sharpen the angle when others have already been here. */}
            <SaturationBadge businessId={business.id} variant="full" />

            {/* What the message drew on from prior contact with this prospect —
                a past reply, an objection, a note. Shown so the sender can check
                it before sending, not just trust it. */}
            {data?.priorContext && data.priorContext.length > 0 && (
              <div className="mb-4 rounded-xl border border-purple-500/20 bg-purple-500/[0.04] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-purple-400 mb-2">
                  What Rex remembers about this prospect
                </p>
                <ul className="space-y-1.5">
                  {data.priorContext.map((fact, i) => (
                    <li key={i} className="text-sm text-gray-300 leading-snug flex gap-2">
                      <span className="text-purple-500 flex-shrink-0">•</span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* What to pitch. Always shown before generating — the user picks the
                offer rather than discovering it in the finished message. */}
            <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-2.5">
                What are you pitching?
              </p>

              <div className="flex gap-2">
                {(['website', 'ai_system'] as OfferType[]).map((type) => {
                  const opp = detected.all.find((o) => o.type === type);
                  const active = type === activeOffer;
                  return (
                    <button
                      key={type}
                      onClick={() => { setOffer(type); setData(null); }}
                      className={`flex-1 rounded-lg px-3 py-2.5 text-left transition-colors border ${
                        active
                          ? 'bg-purple-600/20 border-purple-500/50'
                          : 'bg-white/5 border-transparent hover:bg-white/10'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                          active ? 'bg-purple-500 border-purple-500' : 'border-gray-600'
                        }`}>
                          {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                        </span>
                        <span className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-400'}`}>
                          {OFFER_LABEL[type]}
                        </span>
                      </span>
                      {opp && (
                        <span className="block mt-1 pl-[22px] text-[10px] text-gray-500 capitalize">
                          {opp.band} · {opp.confidence} confidence
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Pitching a website to a business that already has one is the one
                  mistake worth interrupting for. */}
              {activeOffer === 'website' && business.hasWebsite && (
                <p className="mt-2.5 flex items-start gap-2 text-xs leading-snug text-gray-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
                  <span>This business already has a website. Consider pitching AI automation instead.</span>
                </p>
              )}

              {activeOpportunity && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-sm font-bold text-white">{activeOpportunity.title}</p>
                  <p className="text-xs text-gray-400 mt-1">{activeOpportunity.reason}</p>
                  <ul className="mt-2.5 space-y-1">
                    {activeOpportunity.evidence.slice(0, 4).map((e, i) => (
                      <li key={i} className="text-[11px] text-gray-500 flex gap-2">
                        <span className="text-gray-600">•</span>
                        <span>{e}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Generate CTA */}
            {!data && !loading && (
              <div className="text-center py-6">
                <div className="text-4xl mb-3">✍️</div>
                <p className="text-gray-300 font-semibold mb-1">Ready to generate</p>
                <p className="text-gray-500 text-sm mb-5 max-w-xs mx-auto">
                  AI will write a personalised {OFFER_LABEL[activeOffer].toLowerCase()} message for {business.name} — WhatsApp and email.
                </p>
                {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                <button
                  onClick={generate}
                  className="font-bold px-6 py-3 rounded-xl transition-all text-white bg-purple-600 hover:bg-purple-500"
                >
                  Generate Message
                </button>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                <p className="text-gray-400 text-sm">Writing your message…</p>
                <p className="text-gray-600 text-xs">Personalising for {business.name}</p>
              </div>
            )}

            {/* WhatsApp tab */}
            {data && tab === 'whatsapp' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">WhatsApp Message</h3>
                </div>
                <div className={`transition-all ${signupGate ? 'blur-sm select-none pointer-events-none' : ''}`}>
                  <EditablePitch
                    value={data.whatsapp}
                    onChange={(v) => updateData({ whatsapp: v })}
                    kind="whatsapp"
                    context={pitchContext}
                    preview={renderWhatsApp}
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleMarkSent('whatsapp')}
                      className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl text-sm text-center transition-colors flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" /> Open in WhatsApp
                    </a>
                  )}
                  <button onClick={() => handleMarkSent('whatsapp')} className="px-4 py-3 bg-white/8 hover:bg-white/15 text-gray-300 font-semibold rounded-xl text-sm transition-colors border border-white/10">
                    Mark Sent
                  </button>
                  <button onClick={generate} disabled={loading} className="px-3 py-3 bg-white/8 hover:bg-white/15 text-gray-400 rounded-xl transition-colors border border-white/10">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            )}

            {/* Email tab */}
            {data && tab === 'email' && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Subject Line</h3>
                  <input
                    type="text"
                    value={data.emailSubject}
                    onChange={(e) => updateData({ emailSubject: e.target.value })}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-gray-100 text-sm font-semibold focus:outline-none focus:border-purple-500/60 transition-colors"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Email Body</h3>
                  </div>
                  <div className={`transition-all ${signupGate ? 'blur-sm select-none pointer-events-none' : ''}`}>
                    <EditablePitch
                      value={data.emailBody}
                      onChange={(v) => updateData({ emailBody: v })}
                      kind="email"
                      context={pitchContext}
                      minHeight={180}
                    />
                  </div>
                </div>
                {/* Direct send */}
                <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-4 space-y-3">
                  <p className="text-[11px] font-bold text-blue-400 uppercase tracking-widest">Send Directly via SMTP</p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="email"
                        value={recipientEmail}
                        onChange={(e) => { setRecipientEmail(e.target.value); setSendResult(null); setEmailNotFound(false); }}
                        placeholder={findingEmail ? '' : 'recipient@email.com'}
                        disabled={findingEmail}
                        className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500"
                      />
                      {findingEmail && (
                        <div className="absolute inset-0 flex items-center px-3 gap-2 text-gray-500 text-sm pointer-events-none">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Finding email…
                        </div>
                      )}
                    </div>
                    <button
                      onClick={sendEmailDirectly}
                      disabled={sending || findingEmail}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white font-bold rounded-xl text-sm transition-colors whitespace-nowrap"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {sending ? 'Sending…' : 'Send Now'}
                    </button>
                  </div>
                  {emailNotFound && (
                    <p className="text-xs text-gray-600">📭 No email found automatically — enter it manually above.</p>
                  )}
                  {sendResult && (
                    <p className={`text-xs font-semibold ${sendResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                      {sendResult.ok ? '✅ ' : '❌ '}{sendResult.msg}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleMarkSent('email')}
                    className="flex-1 bg-white/8 hover:bg-white/15 text-gray-300 font-semibold py-3 rounded-xl text-sm transition-colors border border-white/10"
                  >
                    Mark Email Sent (manual)
                  </button>
                  <button onClick={generate} disabled={loading} className="px-3 py-3 bg-white/8 hover:bg-white/15 text-gray-400 rounded-xl transition-colors border border-white/10">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
