'use client';

import { useState, useEffect } from 'react';
import { useProspects } from '@/context/ProspectsContext';
import { formatPrice } from '@/lib/scoring';
import { ProspectStage, Business } from '@/types';
import { Bell, Target, TrendingUp, Trophy, Flame, Users, MessageCircle, Zap } from 'lucide-react';
import Link from 'next/link';
import { getTopIndustries } from '@/lib/searchHistory';
import { whatsappLink } from '@/lib/phone';

const STAGES: Array<{ id: ProspectStage; label: string; icon: string; color: string; bar: string }> = [
  { id: 'found',      label: 'Found',      icon: '🔵', color: 'text-blue-400',   bar: 'bg-blue-500' },
  { id: 'contacted',  label: 'Contacted',  icon: '📱', color: 'text-yellow-400', bar: 'bg-yellow-500' },
  { id: 'interested', label: 'Interested', icon: '🤝', color: 'text-orange-400', bar: 'bg-orange-500' },
  { id: 'proposal',   label: 'Proposal',   icon: '📄', color: 'text-purple-400', bar: 'bg-purple-500' },
  { id: 'won',        label: 'Won',        icon: '🏆', color: 'text-green-400',  bar: 'bg-green-500' },
  { id: 'lost',       label: 'Lost',       icon: '❌', color: 'text-red-400',    bar: 'bg-red-500' },
];

function today() { return new Date().toISOString().split('T')[0]; }

function streak(logs: Array<{ date: string; count: number }>, goal: number): number {
  let s = 0;
  const d = new Date();
  for (let i = 0; i < 30; i++) {
    const dt = d.toISOString().split('T')[0];
    const log = logs.find((l) => l.date === dt);
    if (log && log.count >= goal) s++;
    else if (dt !== today()) break;
    d.setDate(d.getDate() - 1);
  }
  return s;
}

function StatCard({ icon, label, value, sub, color = 'text-white' }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-900 border border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3 text-gray-500">{icon}<span className="text-xs font-semibold uppercase tracking-widest">{label}</span></div>
      <div className={`text-3xl font-black ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const { prospects, settings, updateSettings, dailyLogs, todayCount, incrementToday, markOutreachSent, updateStage } = useProspects();
  const [closeRate, setCloseRate] = useState(settings.closeRatePct);
  const [avgDeal, setAvgDeal] = useState(settings.avgDealValue);
  const [dailyGoal, setDailyGoal] = useState(settings.dailyGoal);
  const [topIndustries, setTopIndustries] = useState<Array<{
    industry: string; searches: number; total: number; noWebsite: number; rate: number;
  }>>([]);

  // Browser notifications for reminders
  useEffect(() => {
    getTopIndustries().then(setTopIndustries);
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') checkReminders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkReminders = () => {
    const today = new Date().toISOString().split('T')[0];
    prospects.forEach((p) => {
      if (!p.reminderDate) return;
      if (p.reminderDate <= today && p.stage !== 'won' && p.stage !== 'lost') {
        new Notification(`Follow up: ${p.business.name}`, {
          body: p.reminderNote || `It's time to follow up with ${p.business.name}`,
          icon: '/favicon.ico',
        });
      }
    });
  };

  const requestNotifications = async () => {
    if (!('Notification' in window)) return alert('Notifications not supported in this browser');
    const result = await Notification.requestPermission();
    if (result === 'granted') checkReminders();
  };

  const quickWhatsApp = (business: Business) => {
    const msg = `Hi! 👋 Following up on my earlier message about building a digital front door for ${business.name}.\n\nAre you still interested in growing your online presence? 🌐`;
    const link = whatsappLink(business, msg);
    if (!link) return;
    window.open(link, '_blank');
    markOutreachSent(business.id, msg, 'whatsapp');
    updateStage(business.id, 'contacted');
    incrementToday();
  };

  const saveSettings = () => updateSettings({ closeRatePct: closeRate, avgDealValue: avgDeal, dailyGoal });

  const total = prospects.length;
  const hotLeads = prospects.filter((p) => p.score >= 8 && !p.business.hasWebsite).length;
  const wonCount = prospects.filter((p) => p.stage === 'won').length;
  const wonValue = prospects.filter((p) => p.stage === 'won').reduce((s, p) => s + (p.estimatedPrice?.min ?? 0), 0);

  const pipelineValue = prospects
    .filter((p) => ['contacted', 'interested', 'proposal'].includes(p.stage))
    .reduce((s, p) => s + (p.estimatedPrice?.min ?? 0), 0);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthContacted = prospects.filter(
    (p) => p.outreachSentAt && p.outreachSentAt.startsWith(thisMonth)
  ).length;

  const projected = Math.round((monthContacted * (closeRate / 100)) * avgDeal);
  const currentStreak = streak(dailyLogs, dailyGoal);
  const goalPct = Math.min(Math.round((todayCount / dailyGoal) * 100), 100);

  const upcoming = prospects
    .filter((p) => p.reminderDate && p.stage !== 'won' && p.stage !== 'lost')
    .sort((a, b) => new Date(a.reminderDate!).getTime() - new Date(b.reminderDate!).getTime())
    .slice(0, 5);

  if (prospects.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-4">📊</div>
        <h1 className="text-2xl font-black text-white mb-2">Dashboard</h1>
        <p className="text-gray-400 mb-6">Save some prospects to see your stats here</p>
        <Link href="/" className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-xl transition-colors">
          Start Prospecting →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

      <div>
        <h1 className="text-2xl font-black text-white mb-1">Dashboard</h1>
        <p className="text-gray-500 text-sm">Your AI Prospect Finder stats at a glance</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-4 h-4" />} label="Total Prospects" value={total} sub={`${hotLeads} hot leads`} />
        <StatCard icon={<Flame className="w-4 h-4 text-red-400" />} label="Hot Leads" value={hotLeads} sub="Score ≥ 8 · No website" color="text-red-400" />
        <StatCard icon={<Trophy className="w-4 h-4 text-green-400" />} label="Won" value={wonCount} sub={formatPrice(wonValue)} color="text-green-400" />
        <StatCard icon={<TrendingUp className="w-4 h-4 text-purple-400" />} label="Pipeline Value" value={formatPrice(pipelineValue)} sub="Active stages" color="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Pipeline funnel */}
        <div className="lg:col-span-2 bg-gray-900 border border-white/10 rounded-2xl p-5">
          <h2 className="font-black text-white mb-4 flex items-center gap-2">
            <span>📊</span> Pipeline Breakdown
          </h2>
          <div className="space-y-3">
            {STAGES.map((s) => {
              const count = prospects.filter((p) => p.stage === s.id).length;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const value = prospects.filter((p) => p.stage === s.id).reduce((sum, p) => sum + (p.estimatedPrice?.min ?? 0), 0);
              return (
                <div key={s.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className={`font-semibold ${s.color}`}>{s.icon} {s.label}</span>
                    <span className="text-gray-400">{count} {value > 0 && <span className="text-gray-600">· {formatPrice(value)}</span>}</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${s.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily tracker */}
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 space-y-4">
          <h2 className="font-black text-white flex items-center gap-2"><Target className="w-5 h-5 text-orange-400" /> Daily Tracker</h2>

          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-400">Today's outreach</span>
              <span className="font-bold text-white">{todayCount} / {dailyGoal}</span>
            </div>
            <div className="h-3 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${goalPct >= 100 ? 'bg-green-500' : 'bg-orange-500'}`}
                style={{ width: `${goalPct}%` }}
              />
            </div>
            {goalPct >= 100 && <p className="text-green-400 text-xs mt-1 font-semibold">🎉 Goal reached!</p>}
          </div>

          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400 flex-shrink-0" />
            <div>
              <div className="text-2xl font-black text-white">{currentStreak}</div>
              <div className="text-xs text-gray-500">day streak</div>
            </div>
          </div>

          <button
            onClick={incrementToday}
            className="w-full bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/20 font-bold py-2.5 rounded-xl text-sm transition-colors"
          >
            + Log Outreach
          </button>

          {/* Goal setting */}
          <div className="border-t border-white/5 pt-3">
            <label className="text-xs text-gray-500 font-semibold block mb-1">Daily goal</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={dailyGoal}
                min={1}
                max={100}
                onChange={(e) => setDailyGoal(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              />
              <button onClick={saveSettings} className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-colors">
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue projection */}
      <div className="bg-gradient-to-br from-purple-900/30 to-orange-900/20 border border-purple-500/20 rounded-2xl p-6">
        <h2 className="font-black text-white mb-1 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-purple-400" /> Revenue Projection</h2>
        <p className="text-gray-500 text-sm mb-5">Based on prospects contacted this month and your close rate</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/5 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Contacted this month</div>
            <div className="text-2xl font-black text-white">{monthContacted}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <label className="text-xs text-gray-500 block mb-1">Close rate (%)</label>
            <input
              type="number"
              value={closeRate}
              min={1} max={100}
              onChange={(e) => setCloseRate(Number(e.target.value))}
              onBlur={saveSettings}
              className="bg-transparent text-2xl font-black text-white w-full focus:outline-none"
            />
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <label className="text-xs text-gray-500 block mb-1">Avg deal value (₦)</label>
            <input
              type="number"
              value={avgDeal}
              min={0} step={50000}
              onChange={(e) => setAvgDeal(Number(e.target.value))}
              onBlur={saveSettings}
              className="bg-transparent text-2xl font-black text-white w-full focus:outline-none"
            />
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
          <div className="text-xs text-gray-500 mb-1">Projected Monthly Revenue</div>
          <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-orange-400">
            {formatPrice(projected)}
          </div>
          <p className="text-gray-500 text-xs mt-2">
            {monthContacted} contacts × {closeRate}% close rate × {formatPrice(avgDeal)} avg deal
          </p>
        </div>
      </div>

      {/* Daily outreach queue + industry tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Daily queue — unsent high-score prospects */}
        {(() => {
          const queue = prospects
            .filter((p) => p.stage === 'found' && p.business.phone && !p.business.hasWebsite)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);
          return queue.length > 0 ? (
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-black text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" /> Outreach Queue
                </h2>
                <span className="text-xs text-gray-500">{queue.length} ready to contact</span>
              </div>
              <div className="space-y-2">
                {queue.map((p) => (
                  <div key={p.business.id} className="flex items-center gap-3 p-2.5 bg-white/[0.03] border border-white/8 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white text-sm truncate">{p.business.name}</div>
                      <div className="text-xs text-gray-500 truncate">{p.business.category}</div>
                    </div>
                    <span className="text-[10px] font-bold text-orange-400 flex-shrink-0">{p.score}/10</span>
                    {p.business.phone && (
                      <button
                        onClick={() => quickWhatsApp(p.business)}
                        className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition-colors flex-shrink-0"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Send
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null;
        })()}

        {/* Industry performance tracker */}
        {topIndustries.length > 0 && (
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-400" /> Best Industries
              </h2>
              <span className="text-xs text-gray-500">By no-website hit rate</span>
            </div>
            <div className="space-y-3">
              {topIndustries.map((ind, i) => (
                <div key={ind.industry}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-300 font-medium flex items-center gap-2">
                      <span className="text-[11px] font-black text-gray-600">#{i + 1}</span>
                      {ind.industry}
                    </span>
                    <span className="font-bold text-orange-400">{ind.rate}% 🎯</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full"
                      style={{ width: `${ind.rate}%` }} />
                  </div>
                  <div className="text-[10px] text-gray-600 mt-0.5">{ind.noWebsite} no-website from {ind.total} total</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Notification prompt */}
      {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && (
        <div className="bg-orange-900/20 border border-orange-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-orange-400 flex-shrink-0" />
            <div>
              <div className="text-white font-semibold text-sm">Enable reminder notifications</div>
              <div className="text-gray-400 text-xs">Get browser alerts when a follow-up is due</div>
            </div>
          </div>
          <button onClick={requestNotifications}
            className="flex-shrink-0 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/25 rounded-xl text-sm font-bold transition-colors">
            Enable
          </button>
        </div>
      )}

      {/* Upcoming reminders */}
      {upcoming.length > 0 && (
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-5">
          <h2 className="font-black text-white mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-orange-400" /> Upcoming Follow-ups
          </h2>
          <div className="space-y-3">
            {upcoming.map((p) => {
              const isOverdue = new Date(p.reminderDate!) < new Date();
              const daysAway = Math.ceil((new Date(p.reminderDate!).getTime() - Date.now()) / 86400000);
              return (
                <div key={p.business.id} className={`flex items-start gap-3 p-3 rounded-xl border ${isOverdue ? 'bg-red-500/10 border-red-500/20' : 'bg-white/[0.03] border-white/8'}`}>
                  <Bell className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isOverdue ? 'text-red-400' : 'text-orange-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm">{p.business.name}</div>
                    {p.reminderNote && <div className="text-xs text-gray-400 mt-0.5">{p.reminderNote}</div>}
                    <div className={`text-xs mt-1 font-semibold ${isOverdue ? 'text-red-400' : 'text-orange-300'}`}>
                      {isOverdue ? `Overdue by ${Math.abs(daysAway)} day(s)` : daysAway === 0 ? 'Today!' : `In ${daysAway} day(s)`}
                    </div>
                  </div>
                  <span className="text-xs text-gray-600">{p.reminderDate}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
