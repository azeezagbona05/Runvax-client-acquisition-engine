'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useProspects } from '@/context/ProspectsContext';
import { Business, ProspectStage } from '@/types';

const CATEGORIES = [
  'Restaurant / Eatery',
  'Salon / Barber Shop',
  'Hotel / Lodge / Guest House',
  'Clinic / Hospital / Medical Centre',
  'Pharmacy / Chemist',
  'School / Academy / Tutoring',
  'Real Estate / Property Agency',
  'Law Firm / Legal Services',
  'Church / Ministry / Mosque',
  'Gym / Fitness Centre',
  'Photography / Video Studio',
  'Event Planning / Catering',
  'Logistics / Courier / Transport',
  'Supermarket / Grocery Store',
  'Fashion / Clothing / Boutique',
  'Auto Repair / Car Wash',
  'Accounting / Tax Services',
  'Travel / Tour Agency',
  'Printing / Branding Agency',
  'Other Business',
];

const STAGES: Array<{ id: ProspectStage; label: string }> = [
  { id: 'found', label: '🔵 Just Found' },
  { id: 'contacted', label: '📱 Already Contacted' },
  { id: 'interested', label: '🤝 Interested' },
  { id: 'proposal', label: '📄 Proposal Sent' },
];

interface Props {
  onClose: () => void;
}

export default function ManualProspectModal({ onClose }: Props) {
  const { save, updateStage, updateNotes } = useProspects();

  const [form, setForm] = useState({
    name: '',
    category: '',
    phone: '',
    address: '',
    website: '',
    notes: '',
    stage: 'found' as ProspectStage,
    rating: '',
    reviewCount: '',
    source: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Business name is required'); return; }
    if (!form.category) { setError('Please select a category'); return; }

    setSaving(true);

    const business: Business = {
      id: `manual_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: form.name.trim(),
      category: form.category,
      address: form.address.trim(),
      phone: form.phone.trim() || undefined,
      website: form.website.trim() || undefined,
      hasWebsite: !!form.website.trim(),
      rating: form.rating ? parseFloat(form.rating) : undefined,
      reviewCount: form.reviewCount ? parseInt(form.reviewCount) : undefined,
      status: 'OPERATIONAL',
      description: form.source ? `Source: ${form.source}` : undefined,
    };

    save(business);
    if (form.stage !== 'found') updateStage(business.id, form.stage);
    if (form.notes.trim()) updateNotes(business.id, form.notes.trim());

    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl">

        <div className="flex items-center justify-between p-5 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="font-black text-white text-lg flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-400" /> Add Prospect Manually
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">From Instagram, WhatsApp, walking around, referrals…</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Name */}
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5">Business Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Bella Cuisine Restaurant"
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5">Business Type *</label>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className="w-full bg-gray-800 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition-colors"
            >
              <option value="">— Select category —</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Phone + Address */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1.5">Phone / WhatsApp</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+234 801 234 5678"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1.5">Website (if any)</label>
              <input
                type="text"
                value={form.website}
                onChange={(e) => set('website', e.target.value)}
                placeholder="www.example.com"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5">Address / Area</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="e.g. 14 Allen Avenue, Ikeja, Lagos"
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
            />
          </div>

          {/* Rating + Review count */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1.5">Google Rating (if known)</label>
              <input
                type="number"
                min="1" max="5" step="0.1"
                value={form.rating}
                onChange={(e) => set('rating', e.target.value)}
                placeholder="e.g. 4.3"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1.5">No. of Reviews</label>
              <input
                type="number"
                min="0"
                value={form.reviewCount}
                onChange={(e) => set('reviewCount', e.target.value)}
                placeholder="e.g. 47"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Source */}
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5">Where did you find them?</label>
            <input
              type="text"
              value={form.source}
              onChange={(e) => set('source', e.target.value)}
              placeholder="e.g. Instagram, walking by, WhatsApp group, referral"
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
            />
          </div>

          {/* Stage */}
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5">Current Stage</label>
            <div className="grid grid-cols-2 gap-2">
              {STAGES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => set('stage', s.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                    form.stage === s.id
                      ? 'bg-purple-600/30 text-purple-300 border-purple-500/50'
                      : 'bg-white/5 text-gray-500 border-white/8 hover:bg-white/10'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Anything you observed — busy location, owner was friendly, has Instagram…"
              rows={3}
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none transition-colors"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 text-white font-black py-3.5 rounded-xl transition-all disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add to Pipeline'}
          </button>
        </form>
      </div>
    </div>
  );
}
