import { sanitizeProfile, type CareerProfileData } from '../types';
import { EMPLOYER_KINDS } from './classify';

/** The six pilot indicators, worked out from what users actually did. Each one says how it is measured, so the numbers are not over-read. */
export interface PilotInput {
  baseline: CareerProfileData | null;
  profile: CareerProfileData | null;
  /** One row per discovered job that has a match. `source` is the job source id; `applicationStatus` is null when nothing was prepared. */
  matches: Array<{ source: string; status: string; applicationStatus: string | null }>;
  /** Employer reply kinds per applied application (empty array = no reply). */
  appliedReplies: string[][];
  interviews: number;
}
export interface Ratio { value: number | null; of: number; basis: string }
export interface PilotIndicators {
  cvAccuracy: Ratio; relevance: Ratio; usefulEmployers: { useful: number; found: number; basis: string };
  applicationsSent: number; responseRate: Ratio; interviews: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Facts the reader pulled out of the CV: name, contact, each role, each school, each skill. */
export function profileFacts(p: CareerProfileData): string[] {
  const out: string[] = [p.name, p.email, p.phone];
  for (const r of p.experience) out.push(`${r.title} | ${r.company}`);
  for (const e of p.education) out.push(`${e.qualification} | ${e.institution}`);
  for (const s of p.skills) out.push(s);
  return out.map(norm).filter(Boolean);
}

/** Share of the reader's facts the candidate left alone. A proxy: a fact they kept was right, or they did not notice it was wrong. */
export function cvAccuracy(baseline: CareerProfileData | null, current: CareerProfileData | null): Ratio {
  const basis = 'Share of what the CV reader found that the candidate kept unchanged (a proxy: check a sample by hand).';
  if (!baseline || !current) return { value: null, of: 0, basis };
  const base = profileFacts(sanitizeProfile(baseline)); const now = new Set(profileFacts(sanitizeProfile(current)));
  if (!base.length) return { value: null, of: 0, basis };
  return { value: Math.round((base.filter((f) => now.has(f)).length / base.length) * 100), of: base.length, basis };
}

const GOOD = new Set(['prepared', 'approved', 'applied']); const BAD = new Set(['rejected']);

export function pilotIndicators(i: PilotInput): PilotIndicators {
  const decided = i.matches.filter((m) => m.status === 'saved' || m.status === 'dismissed' || m.applicationStatus);
  const liked = decided.filter((m) => (m.status === 'saved' || (m.applicationStatus && GOOD.has(m.applicationStatus))) && m.status !== 'dismissed');
  const relevance: Ratio = { value: decided.length ? Math.round((liked.length / decided.length) * 100) : null, of: decided.length, basis: 'Of the jobs the candidate acted on, the share they saved or prepared rather than dismissed or rejected.' };
  const places = i.matches.filter((m) => m.source === 'places');
  const useful = places.filter((m) => m.status === 'saved' || (m.applicationStatus && GOOD.has(m.applicationStatus) && !BAD.has(m.applicationStatus)));
  const replied = i.appliedReplies.filter((r) => r.some((k) => EMPLOYER_KINDS.includes(k as never))).length;
  return {
    cvAccuracy: cvAccuracy(i.baseline, i.profile), relevance,
    usefulEmployers: { useful: useful.length, found: places.length, basis: 'Employers near the candidate that they saved or prepared an application for, out of all found.' },
    applicationsSent: i.appliedReplies.length,
    responseRate: { value: i.appliedReplies.length ? Math.round((replied / i.appliedReplies.length) * 100) : null, of: i.appliedReplies.length, basis: 'Applied applications with at least one employer reply (replies are recorded only when the candidate or Gmail logs them).' },
    interviews: i.interviews,
  };
}

/** Roll many users up. Ratios are pooled by their denominators, not averaged, so one big user is not hidden. */
export function pooled(list: PilotIndicators[]): PilotIndicators {
  const ratio = (pick: (p: PilotIndicators) => Ratio): Ratio => {
    const rows = list.map(pick).filter((r) => r.value !== null && r.of > 0); const of = rows.reduce((a, r) => a + r.of, 0);
    return { value: of ? Math.round(rows.reduce((a, r) => a + (r.value as number) * r.of, 0) / of) : null, of, basis: list[0] ? pick(list[0]).basis : '' };
  };
  return {
    cvAccuracy: ratio((p) => p.cvAccuracy), relevance: ratio((p) => p.relevance), responseRate: ratio((p) => p.responseRate),
    usefulEmployers: { useful: list.reduce((a, p) => a + p.usefulEmployers.useful, 0), found: list.reduce((a, p) => a + p.usefulEmployers.found, 0), basis: list[0]?.usefulEmployers.basis ?? '' },
    applicationsSent: list.reduce((a, p) => a + p.applicationsSent, 0), interviews: list.reduce((a, p) => a + p.interviews, 0),
  };
}
