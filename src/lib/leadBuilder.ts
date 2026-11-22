/**
 * Builds a campaign list from the prospects a user has saved: pick the segment (no website, industry, area, has an email or a phone)
 * and see exactly who would be added. Pure, so the picker and the tests agree. It never guesses: a prospect with no email cannot be
 * emailed, so it is counted separately instead of being silently dropped or padded with a made-up address.
 */
import type { Business } from '@/types';
import { hasRealWebsite } from '@/lib/resultFilters';
import { recipientEmail } from '@/lib/decisionMaker';
import { cleanPhone, type LeadInput } from '@/lib/outreachCampaign';

export interface SegmentFilters {
  /** none = no website of their own (a social page alone counts as none); has = a real site; any = both. */
  website: 'any' | 'none' | 'has';
  /** Lower-cased category ('' = every industry). */
  category: string;
  /** Text the address must contain, e.g. "Lekki" or "Abuja" ('' = anywhere). */
  area: string;
  needPhone: boolean;
  minRating: number;
}
export const DEFAULT_SEGMENT: SegmentFilters = { website: 'any', category: '', area: '', needPhone: false, minRating: 0 };

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const categoryOf = (b: Pick<Business, 'category'>) => (b.category ?? '').trim().toLowerCase();

function passes(b: Business, f: SegmentFilters, ignoreCategory = false): boolean {
  if (f.website === 'none' && hasRealWebsite(b)) return false;
  if (f.website === 'has' && !hasRealWebsite(b)) return false;
  if (!ignoreCategory && f.category && categoryOf(b) !== f.category) return false;
  if (f.area.trim() && !(b.address ?? '').toLowerCase().includes(f.area.trim().toLowerCase())) return false;
  if (f.needPhone && !cleanPhone(b.phoneIntl ?? b.phone ?? '')) return false;
  if (f.minRating > 0 && (b.rating ?? 0) < f.minRating) return false;
  return true;
}

export interface Segment {
  /** Prospects that match the segment. */
  matching: number;
  /** Of those, how many can be emailed (they have an address). These are the leads. */
  leads: LeadInput[];
  /** Matching prospects with no email: they cannot join an email campaign. */
  withoutEmail: number;
  /** Industries present in the segment (ignoring the industry filter itself), biggest first, with how many can be emailed. */
  categories: Array<{ category: string; label: string; total: number; emailable: number }>;
}

export function segmentProspects(businesses: Business[], f: SegmentFilters): Segment {
  const leads: LeadInput[] = [];
  const seen = new Set<string>();
  let matching = 0, withoutEmail = 0;
  for (const b of businesses) {
    if (!passes(b, f)) continue;
    matching++;
    const email = recipientEmail(b).trim().toLowerCase();
    if (!EMAIL_OK.test(email)) { withoutEmail++; continue; }
    if (seen.has(email)) continue;
    seen.add(email);
    const phone = cleanPhone(b.phoneIntl ?? b.phone ?? '');
    leads.push({ email, ...(b.decisionMaker?.name ? { name: b.decisionMaker.name } : {}), business: b.name, ...(b.website ? { website: b.website } : {}), ...(phone ? { phone } : {}) });
  }
  const cat = new Map<string, { label: string; total: number; emailable: number }>();
  for (const b of businesses) {
    if (!passes(b, f, true)) continue;
    const key = categoryOf(b) || 'uncategorised';
    const c = cat.get(key) ?? { label: (b.category ?? '').trim() || 'Uncategorised', total: 0, emailable: 0 };
    c.total++;
    if (EMAIL_OK.test(recipientEmail(b).trim())) c.emailable++;
    cat.set(key, c);
  }
  const categories = Array.from(cat, ([category, v]) => ({ category: category === 'uncategorised' ? '' : category, ...v })).sort((a, b) => b.emailable - a.emailable || b.total - a.total);
  return { matching, leads, withoutEmail, categories };
}
