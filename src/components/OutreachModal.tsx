'use client';

import { useState } from 'react';
import { X, Copy, Check, RefreshCw, MessageCircle, Mail, Loader2, Send } from 'lucide-react';
import { Business } from '@/types';
import { useProspects } from '@/context/ProspectsContext';
import { OutreachFramework } from '@/app/api/outreach/route';
import { whatsappLink } from '@/lib/phone';

interface Props {
  business: Business;
  onClose: () => void;
}

type Tab = 'whatsapp' | 'email';

interface OutreachData {
  whatsapp: string;
  emailSubject: string;
  emailBody: string;
  framework: OutreachFramework;
}

const FRAMEWORKS: Array<{
  id: OutreachFramework;
  label: string;
  short: string;
  color: string;
  activeColor: string;
  desc: string;
}> = [
  {
    id: 'PAS',
    label: 'PAS',
    short: 'Problem → Agitate → Solution',
    color: 'text-gray-400',
    activeColor: 'bg-red-600/20 text-red-300 border-red-500/40',
    desc: 'Identify their pain, make it real, offer the relief',
  },
  {
    id: 'BAB',
    label: 'BAB',
    short: 'Before → After → Bridge',
    color: 'text-gray-400',
    activeColor: 'bg-blue-600/20 text-blue-300 border-blue-500/40',
    desc: 'Paint where they are, where they could be, how to get there',
  },
  {
    id: 'AIDA',
    label: 'AIDA',
    short: 'Attention → Interest → Desire → Action',
    color: 'text-gray-400',
    activeColor: 'bg-purple-600/20 text-purple-300 border-purple-500/40',
    desc: 'Hook them, build interest, create desire, one clear CTA',
  },
  {
    id: 'STORY',
    label: 'Story',
    short: 'Storytelling',
    color: 'text-gray-400',
    activeColor: 'bg-orange-600/20 text-orange-300 border-orange-500/40',
    desc: 'A relatable story about a similar business that made the leap',
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
        copied ? 'bg-green-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'
      }`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function OutreachModal({ business, onClose }: Props) {
  const { markOutreachSent, incrementToday, updateStage, isSaved, save } = useProspects();
  const [tab, setTab] = useState<Tab>('whatsapp');
  const [framework, setFramework] = useState<OutreachFramework>('PAS');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OutreachData | null>(null);
  const [error, setError] = useState('');
  const [recipientEmail, setRecipientEmail] = useState(business.email ?? '');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business, framework }),
      });
      const json = await res.json();
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

  const selectedFw = FRAMEWORKS.find((f) => f.id === framework)!;

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

          {/* Framework selector */}
          <div className="p-4 border-b border-white/8">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Choose Copywriting Framework</p>
            <div className="grid grid-cols-2 gap-2">
              {FRAMEWORKS.map((fw) => (
                <button
                  key={fw.id}
                  onClick={() => { setFramework(fw.id); setData(null); }}
                  className={`px-3 py-2.5 rounded-xl text-left border transition-all ${
                    framework === fw.id
                      ? fw.activeColor
                      : 'bg-white/5 text-gray-500 border-white/8 hover:bg-white/10 hover:text-gray-300'
                  }`}
                >
                  <div className="font-black text-sm">{fw.label}</div>
                  <div className="text-[10px] opacity-70 leading-snug mt-0.5">{fw.short}</div>
                </button>
              ))}
            </div>
            {framework && (
              <p className="text-xs text-gray-500 mt-2 italic">{selectedFw.desc}</p>
            )}
          </div>

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

          <div className="p-4 space-y-4">

            {/* Generate CTA */}
            {!data && !loading && (
              <div className="text-center py-6">
                <div className="text-4xl mb-3">✍️</div>
                <p className="text-gray-300 font-semibold mb-1">
                  {selectedFw.label} Framework Selected
                </p>
                <p className="text-gray-500 text-sm mb-5 max-w-xs mx-auto">{selectedFw.desc}</p>
                {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                <button
                  onClick={generate}
                  className={`font-bold px-6 py-3 rounded-xl transition-all text-white ${
                    framework === 'PAS' ? 'bg-red-600 hover:bg-red-500' :
                    framework === 'BAB' ? 'bg-blue-600 hover:bg-blue-500' :
                    framework === 'AIDA' ? 'bg-purple-600 hover:bg-purple-500' :
                    'bg-orange-600 hover:bg-orange-500'
                  }`}
                >
                  Generate {framework} Message
                </button>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                <p className="text-gray-400 text-sm">Writing your {framework} message…</p>
                <p className="text-gray-600 text-xs">Weaving in SEO, AIEO & GEO angles</p>
              </div>
            )}

            {/* WhatsApp tab */}
            {data && tab === 'whatsapp' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">WhatsApp Message</h3>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 inline-block border ${selectedFw.activeColor}`}>
                      {selectedFw.label} Framework
                    </span>
                  </div>
                  <CopyButton text={data.whatsapp} />
                </div>
                <div className="bg-green-950/40 border border-green-500/20 rounded-xl p-4 text-green-100 text-sm leading-relaxed whitespace-pre-wrap">
                  {data.whatsapp}
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
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Subject Line</h3>
                    <CopyButton text={data.emailSubject} />
                  </div>
                  <div className="bg-blue-950/40 border border-blue-500/20 rounded-xl p-3 text-blue-100 text-sm font-semibold">
                    {data.emailSubject}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Email Body</h3>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 inline-block border ${selectedFw.activeColor}`}>
                        {selectedFw.label}
                      </span>
                    </div>
                    <CopyButton text={`Subject: ${data.emailSubject}\n\n${data.emailBody}`} />
                  </div>
                  <div className="bg-blue-950/20 border border-blue-500/15 rounded-xl p-4 text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {data.emailBody}
                  </div>
                </div>
                {/* Direct send */}
                <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-4 space-y-3">
                  <p className="text-[11px] font-bold text-blue-400 uppercase tracking-widest">Send Directly via SMTP</p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => { setRecipientEmail(e.target.value); setSendResult(null); }}
                      placeholder="recipient@email.com"
                      className="flex-1 bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={sendEmailDirectly}
                      disabled={sending}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white font-bold rounded-xl text-sm transition-colors whitespace-nowrap"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {sending ? 'Sending…' : 'Send Now'}
                    </button>
                  </div>
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
