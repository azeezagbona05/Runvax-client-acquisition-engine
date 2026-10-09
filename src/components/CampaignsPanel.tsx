'use client';

import { useEffect, useState } from 'react';

interface Campaign {
  id: string;
  name: string;
  industry: string;
  location: string;
  dailyCap: number;
  status: 'active' | 'paused';
  totalImported: number;
  lastRunAt: string | null;
}

// Standing prospecting instructions: the daily runner imports up to dailyCap
// prospects per campaign and hands them to the agents. Paid plans only —
// free-plan campaigns are saved but never run.
export default function CampaignsPanel() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [open, setOpen] = useState(false);
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [dailyCap, setDailyCap] = useState(20);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    fetch('/api/campaigns').then((r) => r.json()).then((json) => {
      if (Array.isArray(json.campaigns)) setCampaigns(json.campaigns);
    }).catch(() => { /* */ });
  };
  useEffect(load, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry, location, dailyCap }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not create campaign');
      setIndustry(''); setLocation(''); setOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create campaign');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: Campaign) => {
    await fetch(`/api/campaigns/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: c.status === 'active' ? 'paused' : 'active' }),
    });
    load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="bg-gray-800/60 border border-white/5 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Campaigns</h2>
        <button onClick={() => setOpen((v) => !v)} className="text-xs font-bold text-purple-400 hover:text-purple-300">
          {open ? 'Cancel' : '+ New campaign'}
        </button>
      </div>

      {open && (
        <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
          <input
            required value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry, e.g. dental clinics"
            className="sm:col-span-1 bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200"
          />
          <input
            required value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location, e.g. Lagos"
            className="sm:col-span-1 bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200"
          />
          <input
            type="number" min={1} max={30} value={dailyCap} onChange={(e) => setDailyCap(Number(e.target.value))}
            aria-label="Prospects per day"
            className="sm:col-span-1 bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200"
          />
          <button
            type="submit" disabled={saving}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg px-3 py-2"
          >
            {saving ? 'Saving…' : 'Start'}
          </button>
          {error && <p className="sm:col-span-4 text-xs text-red-400">{error}</p>}
        </form>
      )}

      {campaigns.length === 0 && !open && (
        <div>
          <p className="text-xs text-gray-400 mb-2.5">
            A campaign finds and prepares new prospects for you every day. Pick a niche and a location to start one.
          </p>
          <button onClick={() => setOpen(true)} className="text-xs font-bold px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-200">
            Create your first campaign
          </button>
        </div>
      )}

      <div className="space-y-2">
        {campaigns.map((c) => (
          <div key={c.id} className="flex items-center gap-3 text-sm">
            <span className={`text-[10px] font-bold uppercase w-14 flex-shrink-0 ${c.status === 'active' ? 'text-green-400' : 'text-gray-500'}`}>
              {c.status}
            </span>
            <span className="text-gray-200 truncate">{c.name}</span>
            <span className="text-xs text-gray-500 flex-shrink-0">{c.totalImported} imported · {c.dailyCap}/day</span>
            <span className="ml-auto flex gap-3 flex-shrink-0">
              <button onClick={() => toggle(c)} className="text-xs font-bold text-gray-400 hover:text-gray-200">
                {c.status === 'active' ? 'Pause' : 'Resume'}
              </button>
              <button onClick={() => remove(c.id)} className="text-xs font-bold text-gray-600 hover:text-red-400">Delete</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
