/**
 * Admin-controlled site settings: the shape, the built-in defaults and the validation. Pure (no server imports), so the
 * admin screen and client components can use it. The server side (database, cache) is in siteSettings.ts.
 *
 * Every value has a safe default, so a missing row, a missing table or a bad value always falls back to how the app
 * behaved before this existed.
 */
import { PRICING_ENABLED, TRIAL_DAYS } from './promo';

export type BannerTone = 'info' | 'success' | 'warning';

export interface SiteSettings {
  /** New accounts (email sign-up and first Google sign-in). Existing users can always sign in. */
  signupsOpen: boolean;
  /** The free Pro trial. The launch-offer end date in promo.ts still applies on top of this. */
  trialOpen: boolean;
  /** Prices, the pricing page and checkout. */
  pricingVisible: boolean;
  /** Creating new AI agents. Agents that already exist keep running. */
  agentBuilderOpen: boolean;
  /** Length of the free Pro trial for trials started from now on. */
  trialDays: number;
  /** Free searches a signed-out visitor gets per day, and how many results they see. */
  guestSearchesPerDay: number;
  guestPreviewResults: number;
  banner: { on: boolean; text: string; tone: BannerTone; linkLabel: string; linkUrl: string };
  /** Signed-in users see a "back soon" page instead of the app. Admins and the public marketing pages are unaffected. */
  maintenance: { on: boolean; message: string };
}

export const SITE_DEFAULTS: SiteSettings = {
  signupsOpen: true,
  trialOpen: true,
  pricingVisible: PRICING_ENABLED,
  agentBuilderOpen: true,
  trialDays: TRIAL_DAYS,
  guestSearchesPerDay: 2,
  guestPreviewResults: 5,
  banner: { on: false, text: '', tone: 'info', linkLabel: '', linkUrl: '' },
  maintenance: { on: false, message: 'RUNVAX is being updated and will be back shortly. Your data is safe.' },
};

export const LIMITS = {
  trialDays: { min: 1, max: 60 },
  guestSearchesPerDay: { min: 0, max: 20 },
  guestPreviewResults: { min: 1, max: 20 },
  bannerText: 240,
  linkLabel: 40,
  maintenanceMessage: 300,
} as const;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const str = (v: unknown, fallback: string, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : fallback);
function int(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}
/** Only an on-site path or an https link: never javascript:, data: and the like. */
function safeLink(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback;
  const s = v.trim().slice(0, 300);
  if (s === '') return '';
  return /^\/(?!\/)/.test(s) || /^https:\/\/[^\s]+$/i.test(s) ? s : fallback;
}

/** Merge a partial/untrusted input over `base`, clamping every value. Unknown keys are dropped. */
export function sanitizeSettings(input: unknown, base: SiteSettings = SITE_DEFAULTS): SiteSettings {
  const i = isObj(input) ? input : {};
  const b = isObj(i.banner) ? i.banner : {};
  const m = isObj(i.maintenance) ? i.maintenance : {};
  const tone = b.tone === 'success' || b.tone === 'warning' || b.tone === 'info' ? b.tone : base.banner.tone;
  return {
    signupsOpen: bool(i.signupsOpen, base.signupsOpen),
    trialOpen: bool(i.trialOpen, base.trialOpen),
    pricingVisible: bool(i.pricingVisible, base.pricingVisible),
    agentBuilderOpen: bool(i.agentBuilderOpen, base.agentBuilderOpen),
    trialDays: int(i.trialDays, base.trialDays, LIMITS.trialDays.min, LIMITS.trialDays.max),
    guestSearchesPerDay: int(i.guestSearchesPerDay, base.guestSearchesPerDay, LIMITS.guestSearchesPerDay.min, LIMITS.guestSearchesPerDay.max),
    guestPreviewResults: int(i.guestPreviewResults, base.guestPreviewResults, LIMITS.guestPreviewResults.min, LIMITS.guestPreviewResults.max),
    banner: {
      on: bool(b.on, base.banner.on),
      text: str(b.text, base.banner.text, LIMITS.bannerText),
      tone,
      linkLabel: str(b.linkLabel, base.banner.linkLabel, LIMITS.linkLabel),
      linkUrl: safeLink(b.linkUrl, base.banner.linkUrl),
    },
    maintenance: {
      on: bool(m.on, base.maintenance.on),
      message: str(m.message, base.maintenance.message, LIMITS.maintenanceMessage) || SITE_DEFAULTS.maintenance.message,
    },
  };
}

/** A banner with no text is never shown, even if it is switched on. */
export const bannerVisible = (s: SiteSettings) => s.banner.on && s.banner.text.length > 0;

/** One line per changed setting, for the admin audit log. */
export function describeChanges(before: SiteSettings, after: SiteSettings): string[] {
  const out: string[] = [];
  const onOff = (v: boolean) => (v ? 'on' : 'off');
  if (before.signupsOpen !== after.signupsOpen) out.push(`New sign-ups ${onOff(after.signupsOpen)}`);
  if (before.trialOpen !== after.trialOpen) out.push(`Free Pro trial ${onOff(after.trialOpen)}`);
  if (before.pricingVisible !== after.pricingVisible) out.push(`Pricing and checkout ${onOff(after.pricingVisible)}`);
  if (before.agentBuilderOpen !== after.agentBuilderOpen) out.push(`Creating AI agents ${onOff(after.agentBuilderOpen)}`);
  if (before.trialDays !== after.trialDays) out.push(`Trial length ${before.trialDays} to ${after.trialDays} days`);
  if (before.guestSearchesPerDay !== after.guestSearchesPerDay) out.push(`Guest searches per day ${before.guestSearchesPerDay} to ${after.guestSearchesPerDay}`);
  if (before.guestPreviewResults !== after.guestPreviewResults) out.push(`Guest preview results ${before.guestPreviewResults} to ${after.guestPreviewResults}`);
  if (JSON.stringify(before.banner) !== JSON.stringify(after.banner)) out.push(after.banner.on ? `Banner on: "${after.banner.text}"` : 'Banner off');
  if (before.maintenance.on !== after.maintenance.on) out.push(`Maintenance mode ${onOff(after.maintenance.on)}`);
  else if (before.maintenance.message !== after.maintenance.message) out.push('Maintenance message changed');
  return out;
}
