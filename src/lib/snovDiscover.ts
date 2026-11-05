/** Pure helpers for "Discover with Snov": the industry list, grouping people by company, and picking who to reveal. */
import { titleRank } from '@/lib/decisionMaker';
import type { DbProspect, ManagementLevel } from '@/lib/snov';

/** Industry names Snov.io accepts (checked against its API). It has no "dental"; "Medical Practice" is the nearest. */
export const SNOV_INDUSTRIES = [
  'Medical Practice', 'Hospital & Health Care', 'Health, Wellness & Fitness', 'Mental Health Care', 'Pharmaceuticals', 'Veterinary',
  'Law Practice', 'Legal Services', 'Accounting', 'Financial Services', 'Banking', 'Insurance', 'Real Estate', 'Construction', 'Building Materials',
  'Architecture & Planning', 'Design', 'Photography', 'Marketing & Advertising', 'Information Technology & Services', 'Telecommunications',
  'Restaurants', 'Food & Beverages', 'Hospitality', 'Events Services', 'Entertainment', 'Sports', 'Retail', 'Apparel & Fashion', 'Cosmetics',
  'Consumer Services', 'Automotive', 'Logistics & Supply Chain', 'Wholesale', 'Oil & Energy', 'Furniture',
  'Education Management', 'Primary/Secondary Education', 'Higher Education', 'Staffing & Recruiting', 'Management Consulting',
  'Security & Investigations', 'Religious Institutions', 'Civic & Social Organization', 'Non-Profit Organization Management', 'Airlines/Aviation',
] as const;

export const LEVELS: Array<{ id: ManagementLevel; label: string }> = [
  { id: 'c_level', label: 'C-level (CEO, founder…)' },
  { id: 'vp_level', label: 'VP' },
  { id: 'director_level', label: 'Director' },
  { id: 'manager_level', label: 'Manager' },
];

export const COMPANY_SIZES = ['Self', '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000'] as const;

export interface CompanyGroup {
  key: string;
  company: DbProspect['company'];
  people: DbProspect[];
}

/** People grouped by company, in the order the companies first appear; the likeliest decision-maker comes first in each. */
export function groupByCompany(prospects: DbProspect[]): CompanyGroup[] {
  const map = new Map<string, CompanyGroup>();
  for (const p of prospects) {
    const key = (p.company.domain || p.company.name).toLowerCase();
    if (!key) continue;
    const g = map.get(key) ?? { key, company: p.company, people: [] };
    g.people.push(p);
    map.set(key, g);
  }
  const rank = (t: string) => { const r = titleRank(t); return r < 0 ? 99 : r; };
  return Array.from(map.values()).map((g) => ({ ...g, people: [...g.people].sort((a, b) => rank(a.jobTitle) - rank(b.jobTitle)) }));
}

/** The reveal links of the top `perCompany` people at every company: the cheap way to reach decision-makers. */
export function autoPick(groups: CompanyGroup[], perCompany = 3): Set<string> {
  const out = new Set<string>();
  for (const g of groups) g.people.slice(0, perCompany).forEach((p) => out.add(p.revealUrl));
  return out;
}

/** A person's name as Snov shows it before the reveal ("Ada Ok***"). */
export const maskedName = (p: Pick<DbProspect, 'firstName' | 'lastName'>) => `${p.firstName} ${p.lastName}`.trim();

/** Short key for a reveal link (the hash at the end). */
export const revealKey = (url: string) => url.split('/').pop() ?? url;
