/** Career Agent shapes and sanitizers. Everything stored is cleaned here, so routes and the UI share one set of rules. */

export interface Role { title: string; company: string; start: string; end: string; location: string; bullets: string[] }
export interface Education { institution: string; qualification: string; start: string; end: string }
export interface CareerProfileData {
  name: string; email: string; phone: string; location: string; headline: string; summary: string;
  experience: Role[]; education: Education[]; skills: string[]; certifications: string[]; achievements: string[];
}

export const WORK_MODES = ['remote', 'hybrid', 'onsite'] as const;
export const LEVELS = ['entry', 'junior', 'mid', 'senior', 'lead', 'executive'] as const;
export const FREQUENCIES = ['daily', 'weekly'] as const;
export const SOURCES = [
  { id: 'company_careers', label: 'Company career pages', note: 'Public vacancies on employers\' own sites' },
  { id: 'job_feeds', label: 'Job board APIs and feeds', note: 'Sources that allow automated access' },
] as const;
export const PERMISSION_MODES = [
  { id: 'prepare', label: 'Prepare applications only', note: 'The agent prepares the CV, cover letter and answers. You apply yourself.' },
  { id: 'batch', label: 'Submit after batch approval', note: 'You approve a batch, then the agent submits those applications.' },
  { id: 'auto', label: 'Automatically submit eligible applications', note: 'Only within the rules you set below. Anything outside them waits for you.' },
] as const;
export type PermissionMode = typeof PERMISSION_MODES[number]['id'];

/** Facts only the candidate can state, entered by them and used ONLY when an application form asks. Never guessed, never derived from the CV. */
export interface Standing { linkedin: string; github: string; website: string; authorizedToWork: '' | 'yes' | 'no'; needsSponsorship: '' | 'yes' | 'no'; residenceCountry: string; howHeard: string }
export interface Preferences { standing: Standing; titles: string[]; industries: string[]; country: string; locations: string[]; workModes: string[]; salaryMin: number | null; salaryMax: number | null; currency: string; level: string }
export interface Discovery { sources: string[]; frequency: string; employers: string[]; minScore: number }
export interface Permissions { mode: PermissionMode; autoMinScore: number; autoMaxPerDay: number; autoBlockedEmployers: string[]; remindByEmail: boolean }

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const list = (v: unknown, n: number, max: number): string[] => {
  const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,\n;]/) : [];
  const out: string[] = []; const seen = new Set<string>();
  for (const x of raw) { const s = str(x, max); const k = s.toLowerCase(); if (s && !seen.has(k)) { seen.add(k); out.push(s); } if (out.length >= n) break; }
  return out;
};
const num = (v: unknown, lo: number, hi: number, dflt: number) => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : dflt; };
const money = (v: unknown): number | null => { if (v === '' || v == null) return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(100_000_000, Math.round(n)) : null; };
const pick = <T extends string>(v: unknown, all: readonly T[], dflt: T): T => (all as readonly string[]).includes(v as string) ? v as T : dflt;

export const emptyProfile = (): CareerProfileData => ({ name: '', email: '', phone: '', location: '', headline: '', summary: '', experience: [], education: [], skills: [], certifications: [], achievements: [] });

export function sanitizeProfile(v: unknown): CareerProfileData {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const arr = (x: unknown) => (Array.isArray(x) ? x : []);
  return {
    name: str(o.name, 120), email: str(o.email, 160), phone: str(o.phone, 40), location: str(o.location, 120), headline: str(o.headline, 160), summary: str(o.summary, 1200),
    experience: arr(o.experience).slice(0, 20).map((r) => { const x = (r ?? {}) as Record<string, unknown>; return { title: str(x.title, 140), company: str(x.company, 140), start: str(x.start, 24), end: str(x.end, 24), location: str(x.location, 100), bullets: list(x.bullets, 12, 400) }; }).filter((r) => r.title || r.company),
    education: arr(o.education).slice(0, 10).map((r) => { const x = (r ?? {}) as Record<string, unknown>; return { institution: str(x.institution, 160), qualification: str(x.qualification, 160), start: str(x.start, 24), end: str(x.end, 24) }; }).filter((r) => r.institution || r.qualification),
    skills: list(o.skills, 60, 60), certifications: list(o.certifications, 20, 160), achievements: list(o.achievements, 20, 300),
  };
}

const url = (v: unknown) => { try { const u = new URL(String(v ?? '').trim()); return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.') ? u.toString().slice(0, 200) : ''; } catch { return ''; } };
const yn = (v: unknown): '' | 'yes' | 'no' => (v === 'yes' || v === 'no' ? v : '');
export function sanitizeStanding(v: unknown): Standing {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { linkedin: url(o.linkedin), github: url(o.github), website: url(o.website), authorizedToWork: yn(o.authorizedToWork), needsSponsorship: yn(o.needsSponsorship), residenceCountry: str(o.residenceCountry, 60), howHeard: str(o.howHeard, 80) };
}

export function sanitizePreferences(v: unknown): Preferences {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const lo = money(o.salaryMin); let hi = money(o.salaryMax); if (lo != null && hi != null && hi < lo) hi = lo;
  const modes = list(o.workModes, 3, 10).map((m) => m.toLowerCase()).filter((m) => (WORK_MODES as readonly string[]).includes(m));
  return { standing: sanitizeStanding(o.standing), titles: list(o.titles, 8, 80), industries: list(o.industries, 8, 60), country: str(o.country, 60), locations: list(o.locations, 10, 80), workModes: modes, salaryMin: lo, salaryMax: hi, currency: str(o.currency, 4).toUpperCase() || 'USD', level: pick(o.level, LEVELS, 'mid') };
}
export function sanitizeDiscovery(v: unknown): Discovery {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const ids = SOURCES.map((s) => s.id) as string[];
  return { sources: list(o.sources, 5, 30).filter((s) => ids.includes(s)), frequency: pick(o.frequency, FREQUENCIES, 'daily'), employers: list(o.employers, 30, 80), minScore: num(o.minScore, 50, 95, 75) };
}
export function sanitizePermissions(v: unknown): Permissions {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { mode: pick(o.mode, PERMISSION_MODES.map((m) => m.id) as readonly PermissionMode[], 'prepare'), autoMinScore: num(o.autoMinScore, 70, 99, 90), autoMaxPerDay: num(o.autoMaxPerDay, 1, 20, 5), autoBlockedEmployers: list(o.autoBlockedEmployers, 30, 80), remindByEmail: o.remindByEmail !== false };
}
export const defaultPreferences = () => sanitizePreferences({});
export const defaultDiscovery = () => sanitizeDiscovery({ sources: ['company_careers', 'job_feeds'] });
export const defaultPermissions = () => sanitizePermissions({});

/** What must be true before the agent can be deployed. Returns plain sentences, empty when ready. */
export function deployIssues(p: { profileConfirmed: boolean; hasProfile: boolean; prefs: Preferences; discovery: Discovery }): string[] {
  const out: string[] = [];
  if (!p.hasProfile) out.push('Upload your CV so the agent has a profile to work from.');
  else if (!p.profileConfirmed) out.push('Review your profile and confirm it is accurate. The agent only uses what you confirm.');
  if (!p.prefs.titles.length) out.push('Add at least one job title you want.');
  if (!p.prefs.workModes.length) out.push('Choose remote, hybrid or onsite (one or more).');
  if (!p.discovery.sources.length) out.push('Choose at least one job source.');
  return out;
}
