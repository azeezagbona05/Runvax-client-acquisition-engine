'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Save, TriangleAlert, Undo2 } from 'lucide-react';
import { LIMITS, SITE_DEFAULTS, type BannerTone, type SiteSettings } from '@/lib/siteSettingsShared';

const card = 'bg-gray-900 border border-white/8 rounded-2xl p-5';
const input = 'w-full bg-gray-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60';
const label = 'block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5';

function Toggle({ on, onChange, title, hint, danger }: { on: boolean; onChange: (v: boolean) => void; title: string; hint: string; danger?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 border-b border-white/5 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{hint}</p>
      </div>
      <button
        type="button" role="switch" aria-checked={on} aria-label={title} onClick={() => onChange(!on)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${on ? (danger ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-gray-700'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function Num({ title, hint, value, min, max, onChange }: { title: string; hint: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className={label} htmlFor={`n-${title}`}>{title}</label>
      <input id={`n-${title}`} type="number" inputMode="numeric" min={min} max={max} value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} className={input} />
      <p className="text-[11px] text-gray-600 mt-1">{hint} Allowed {min} to {max}.</p>
    </div>
  );
}

const TONES: Array<{ id: BannerTone; name: string }> = [{ id: 'info', name: 'Info' }, { id: 'success', name: 'Good news' }, { id: 'warning', name: 'Warning' }];

/**
 * Admin "Site controls": the switches, limits, announcement banner and maintenance mode that used to be edited in code.
 * Everything here is enforced by the server, and every change is written to the admin audit log.
 */
export default function SiteControlsPanel() {
  const [saved, setSaved] = useState<SiteSettings | null>(null);
  const [draft, setDraft] = useState<SiteSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string[] | null>(null);

  const load = useCallback(() => {
    fetch('/api/admin/site', { cache: 'no-store' })
      .then(async (r) => { if (!r.ok) throw new Error('Could not load the site controls.'); return r.json() as Promise<{ settings: SiteSettings }>; })
      .then((j) => { setSaved(j.settings); setDraft(j.settings); })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const dirty = useMemo(() => !!saved && !!draft && JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  const numbersOk = !!draft && [draft.trialDays, draft.guestSearchesPerDay, draft.guestPreviewResults].every(Number.isFinite);

  if (error && !draft) return <div role="alert" className="text-sm text-red-400">{error}</div>;
  if (!draft || !saved) return <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={15} className="animate-spin" /> Loading site controls…</div>;

  const set = (patch: Partial<SiteSettings>) => { setDraft({ ...draft, ...patch }); setDone(null); };
  const setBanner = (patch: Partial<SiteSettings['banner']>) => set({ banner: { ...draft.banner, ...patch } });
  const setMaint = (patch: Partial<SiteSettings['maintenance']>) => set({ maintenance: { ...draft.maintenance, ...patch } });

  const save = async () => {
    if (draft.maintenance.on && !saved.maintenance.on
      && !window.confirm('Turn on maintenance mode?\n\nEvery signed-in user except admins will see a "back soon" page and be blocked from the app until you switch it off.')) return;
    setBusy(true); setError(''); setDone(null);
    try {
      const res = await fetch('/api/admin/site', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const j = await res.json().catch(() => ({})) as { settings?: SiteSettings; changes?: string[]; error?: string };
      if (!res.ok || !j.settings) { setError(j.error ?? 'Could not save.'); return; }
      setSaved(j.settings); setDraft(j.settings); setDone(j.changes?.length ? j.changes : ['No changes']);
    } catch { setError('Could not reach the server. Nothing was saved.'); }
    finally { setBusy(false); }
  };

  // Fixed, opaque colours so the preview reads the same in the light and dark admin themes.
  const bannerPreviewTone = { info: 'bg-purple-50 border-purple-200 text-purple-900', success: 'bg-emerald-50 border-emerald-200 text-emerald-900', warning: 'bg-amber-50 border-amber-300 text-amber-900' }[draft.banner.tone];

  return (
    <div className="space-y-5 max-w-3xl pb-24">
      {saved.maintenance.on && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <span><strong>Maintenance mode is ON.</strong> Signed-in users (except admins) are blocked from the app right now.</span>
        </div>
      )}

      <section className={card} aria-labelledby="sc-switches">
        <h2 id="sc-switches" className="text-base font-bold text-white">Feature switches</h2>
        <p className="text-xs text-gray-500 mt-1 mb-2">Take effect within about 15 seconds, with no deploy. Existing users are never locked out by these.</p>
        <Toggle on={draft.signupsOpen} onChange={(v) => set({ signupsOpen: v })} title="New sign-ups" hint="Email sign-up and a first Google sign-in. People who already have an account can always sign in." />
        <Toggle on={draft.trialOpen} onChange={(v) => set({ trialOpen: v })} title="Free Pro trial" hint="Lets free accounts start the trial. The launch-offer end date still applies on top of this switch." />
        <Toggle on={draft.pricingVisible} onChange={(v) => set({ pricingVisible: v })} title="Pricing and checkout" hint="Shows prices, the pricing page and Paystack checkout. Off hides all of them. Turn on only when your prices are ready." />
        <Toggle on={draft.agentBuilderOpen} onChange={(v) => set({ agentBuilderOpen: v })} title="Creating AI agents" hint="Stops new agents being built. Agents that already exist keep running." />
      </section>

      <section className={card} aria-labelledby="sc-limits">
        <h2 id="sc-limits" className="text-base font-bold text-white">Default limits</h2>
        <p className="text-xs text-gray-500 mt-1 mb-4">Plan limits for paying users are under Plan limits. These are the defaults for trials and signed-out visitors.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Num title="Trial length (days)" hint="For trials started from now on." value={draft.trialDays} min={LIMITS.trialDays.min} max={LIMITS.trialDays.max} onChange={(v) => set({ trialDays: v })} />
          <Num title="Guest searches per day" hint="Signed-out visitors. 0 asks everyone to sign up first." value={draft.guestSearchesPerDay} min={LIMITS.guestSearchesPerDay.min} max={LIMITS.guestSearchesPerDay.max} onChange={(v) => set({ guestSearchesPerDay: v })} />
          <Num title="Guest results shown" hint="Results a visitor sees before signing up." value={draft.guestPreviewResults} min={LIMITS.guestPreviewResults.min} max={LIMITS.guestPreviewResults.max} onChange={(v) => set({ guestPreviewResults: v })} />
        </div>
      </section>

      <section className={card} aria-labelledby="sc-banner">
        <h2 id="sc-banner" className="text-base font-bold text-white">Announcement banner</h2>
        <p className="text-xs text-gray-500 mt-1 mb-2">A message across the top of the app. Users can dismiss it; a changed message shows again.</p>
        <Toggle on={draft.banner.on} onChange={(v) => setBanner({ on: v })} title="Show the banner" hint="Needs some text below to appear." />
        <div className="mt-3 grid gap-4">
          <div>
            <label className={label} htmlFor="sc-banner-text">Message</label>
            <textarea id="sc-banner-text" rows={2} maxLength={LIMITS.bannerText} value={draft.banner.text} onChange={(e) => setBanner({ text: e.target.value })} placeholder="e.g. New: AI agents can now be built in minutes." className={input} />
            <p className="text-[11px] text-gray-600 mt-1">{draft.banner.text.length}/{LIMITS.bannerText}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={label} htmlFor="sc-banner-tone">Style</label>
              <select id="sc-banner-tone" value={draft.banner.tone} onChange={(e) => setBanner({ tone: e.target.value as BannerTone })} className={input}>
                {TONES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="sc-banner-ll">Link text (optional)</label>
              <input id="sc-banner-ll" maxLength={LIMITS.linkLabel} value={draft.banner.linkLabel} onChange={(e) => setBanner({ linkLabel: e.target.value })} placeholder="Learn more" className={input} />
            </div>
            <div>
              <label className={label} htmlFor="sc-banner-lu">Link address</label>
              <input id="sc-banner-lu" value={draft.banner.linkUrl} onChange={(e) => setBanner({ linkUrl: e.target.value })} placeholder="/client-acquisition or https://…" className={input} />
            </div>
          </div>
          {draft.banner.text && (
            <div>
              <p className={label}>Preview</p>
              <div className={`rounded-lg border px-4 py-2.5 text-[13px] ${bannerPreviewTone}`}>
                {draft.banner.text}{draft.banner.linkLabel && draft.banner.linkUrl ? <span className="ml-2 font-bold underline underline-offset-2">{draft.banner.linkLabel}</span> : null}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={card} aria-labelledby="sc-maint">
        <h2 id="sc-maint" className="text-base font-bold text-white">Maintenance mode</h2>
        <p className="text-xs text-gray-500 mt-1 mb-2">Blocks the app for everyone except signed-in admins while you work. The marketing pages, sign-in and this admin panel stay available.</p>
        <Toggle danger on={draft.maintenance.on} onChange={(v) => setMaint({ on: v })} title="Maintenance mode" hint="Signed-in users see a “we’ll be right back” page and the API pauses for them." />
        <div className="mt-3">
          <label className={label} htmlFor="sc-maint-msg">Message shown to users</label>
          <textarea id="sc-maint-msg" rows={2} maxLength={LIMITS.maintenanceMessage} value={draft.maintenance.message} onChange={(e) => setMaint({ message: e.target.value })} className={input} />
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-gray-950/95 backdrop-blur px-4 py-3 lg:left-64">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1 text-xs" aria-live="polite">
            {error ? <span className="text-red-400">{error}</span>
              : done ? <span className="inline-flex items-center gap-1.5 text-emerald-400"><CheckCircle2 size={14} /> Saved: {done.join('; ')}</span>
              : dirty ? <span className="text-amber-300">You have unsaved changes.</span>
              : <span className="text-gray-500">Everything shown is live.</span>}
          </div>
          <button type="button" disabled={!dirty || busy} onClick={() => { setDraft(saved); setError(''); setDone(null); }} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-white/5 disabled:opacity-40">
            <Undo2 size={14} /> Discard
          </button>
          <button type="button" disabled={!dirty || busy || !numbersOk} onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-40">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save changes
          </button>
        </div>
      </div>
      <p className="text-[11px] text-gray-600">Built-in defaults if anything here is ever unavailable: sign-ups open, trial open, pricing {String(SITE_DEFAULTS.pricingVisible ? 'on' : 'off')}, agents open, no banner, no maintenance.</p>
    </div>
  );
}
