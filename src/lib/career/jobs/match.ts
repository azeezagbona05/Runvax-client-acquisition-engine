import type { CareerProfileData, Preferences } from '@/lib/career/types';
import type { Job } from './sources';
import { placeFromLocation } from '@/lib/career/suggest';

/**
 * Deterministic, explainable job fit (0-100). No AI: every point comes from a stated reason the candidate can read.
 * Title 40 + skills 30 + place/work style 15 + level 10 + industry 5.
 */
/** access: can this person actually take the job from where they are? 'open', 'restricted' (only open to other places) or 'unknown' (the listing does not say). */
export interface Fit { score: number; reasons: string[]; access: 'open' | 'restricted' | 'unknown' }

const STOP = new Set(['and', 'the', 'for', 'with', 'of', 'a', 'an', 'in', 'at', 'to', 'sr', 'jr']);
// Titles say the same thing in different words: Front-end / Frontend / Front End, Engineer / Developer.
const canon = (s: string) => s.toLowerCase().replace(/front[\s-]*end/g, 'frontend').replace(/back[\s-]*end/g, 'backend').replace(/full[\s-]*stack/g, 'fullstack').replace(/\b(?:engineers?|programmers?|developers?)\b/g, 'developer').replace(/\bsoftware developer\b/g, 'developer');
const toks = (s: string) => canon(s).replace(/[^a-z0-9+#.\s]/g, ' ').replace(/\.+(?=\s|$)/g, '').split(/\s+/).filter((t) => t && !STOP.has(t));
const has = (hay: string, needle: string) => { const n = toks(needle).join(' '); return n.length > 0 && ` ${toks(hay).join(' ')} `.includes(` ${n} `); };

// "Senior", "Lead" and friends say HOW senior, not WHAT the job is. They must never make "Senior Back-end Developer" look like "Senior Accountant".
const LEVEL_WORDS = new Set(['senior', 'junior', 'lead', 'principal', 'head', 'chief', 'intern', 'internship', 'graduate', 'trainee', 'entry', 'mid', 'middle', 'experienced']);
const core = (s: string) => { const all = toks(s); const c = all.filter((w) => !LEVEL_WORDS.has(w)); return c.length ? c : all; };

// A specialty that contradicts the one wanted (back-end vs front-end) must not look like a near match. Full-stack is compatible with both.
const SPECIALTY = ['frontend', 'backend', 'mobile', 'data', 'devops', 'security', 'qa', 'ios', 'android'];
const specialties = (t: string) => { const w = new Set(toks(t)); return { set: SPECIALTY.filter((x) => w.has(x)), full: w.has('fullstack') }; };

const RANK = ['entry', 'junior', 'mid', 'senior', 'lead', 'executive'];
export function levelOf(title: string): string | null {
  const t = title.toLowerCase();
  if (/\b(?:intern|internship|graduate|trainee|entry|apprentice)\b/.test(t)) return 'entry';
  if (/\b(?:junior|jr)\b/.test(t)) return 'junior';
  if (/\b(?:head of|director|vp|vice president|chief|cto|ceo)\b/.test(t)) return 'executive';
  if (/\b(?:lead|principal|manager)\b/.test(t) || /\bstaff (?:software|engineer|developer|designer|scientist|product|data|architect)/.test(t)) return 'lead';
  if (/\b(?:senior|sr)\b/.test(t)) return 'senior';
  return null;
}


// ── Can this person actually take the job from where they are? ──
const AFRICA = ['nigeria', 'ghana', 'kenya', 'south africa', 'egypt', 'uganda', 'tanzania', 'rwanda', 'ethiopia', 'senegal', 'cameroon', 'zambia', 'zimbabwe', 'morocco', 'tunisia', 'algeria', 'botswana', 'namibia', 'mozambique', 'angola', 'sierra leone', 'liberia', 'malawi', 'ivory coast'];
const EUROPE = ['germany', 'france', 'spain', 'italy', 'netherlands', 'ireland', 'poland', 'portugal', 'austria', 'switzerland', 'belgium', 'sweden', 'norway', 'denmark', 'finland', 'united kingdom', 'uk'];
const WEST_AFRICA = ['nigeria', 'ghana', 'senegal', 'sierra leone', 'liberia', 'ivory coast'], EAST_AFRICA = ['kenya', 'uganda', 'tanzania', 'rwanda', 'ethiopia'];
const OPEN_WORDS = /\b(?:worldwide|anywhere|global|globally|international|all countries|work from anywhere|any location)\b/i;
const HOME_WORDS = /^(?:remote|home ?office|work from home|hybrid|flexible)?$/i;

/** The words that mean "this place" for a person: their country, their cities and the regions that contain them (Nigeria -> West Africa, Africa, EMEA). */
export function ownPlaces(country: string, cities: string[]): string[] {
  const c = country.toLowerCase().trim(); const out = [c, ...cities.map((x) => x.toLowerCase())].filter(Boolean);
  if (AFRICA.includes(c)) out.push('africa', 'emea', 'sub-saharan africa', ...(WEST_AFRICA.includes(c) ? ['west africa'] : []), ...(EAST_AFRICA.includes(c) ? ['east africa'] : []));
  if (EUROPE.includes(c)) out.push('europe', 'emea', 'eu', 'european union');
  if (['usa', 'united states', 'us', 'canada'].includes(c)) out.push('usa', 'us', 'united states', 'north america', 'americas', 'canada');
  return Array.from(new Set(out));
}

export const isEuropeanCountry = (country: string) => EUROPE.includes(country.toLowerCase().trim());

// "South Africa" must not read as "Africa" (a job open only to South Africa is not open to Kenya).
const joinCompound = (s: string) => s.replace(/south africa/gi, 'southafrica').replace(/new zealand/gi, 'newzealand').replace(/united states/gi, 'unitedstates').replace(/united kingdom/gi, 'unitedkingdom');

export function accessFor(job: Pick<Job, 'location' | 'remote'>, country: string, cities: string[]): { access: Fit['access']; note: string } {
  const mine = ownPlaces(country, cities).map(joinCompound); const where = joinCompound(job.location.trim()); const shown = job.location.trim();
  if (!mine.length) return { access: 'unknown', note: '' };                                           // we do not know where the person is
  if (mine.some((m) => has(where, m))) return { access: 'open', note: job.remote ? `Open to ${country || 'your region'}` : `Located in ${shown}` };
  if (job.remote) {
    if (OPEN_WORDS.test(where)) return { access: 'open', note: 'Open worldwide' };
    if (HOME_WORDS.test(where)) return { access: 'unknown', note: 'Remote (the listing does not say where from)' };
    return { access: 'restricted', note: `Only open to: ${shown}` };                                   // a place is named and it is not the person's: not open to them
  }
  if (!where || HOME_WORDS.test(where)) return { access: 'unknown', note: '' };
  return { access: 'restricted', note: `Based in ${shown}, not near you` };
}

export function scoreJob(job: Job, profile: CareerProfileData, prefs: Preferences): Fit {
  const reasons: string[] = []; let score = 0;
  const body = `${job.title}\n${job.description}`;

  // Title (40): against the titles wanted, then (weaker) the latest title held.
  const wanted = prefs.titles.length ? prefs.titles : profile.experience[0]?.title ? [profile.experience[0].title] : [];
  let best = 0, bestT = '';
  for (const t of wanted) {
    const w = core(t); if (!w.length) continue;
    const jt = new Set(core(job.title)); const shared = w.filter((x) => jt.has(x)).length / w.length;
    let s = has(job.title, t) ? 1 : shared >= 0.5 ? 0.45 + shared * 0.4 : shared > 0 ? shared * 0.5 : 0;
    const ws = specialties(t), js = specialties(job.title);
    if (ws.set.length && js.set.length && !ws.set.some((x) => js.set.includes(x)) && !js.full) s = Math.min(s, 0.25);
    if (s > best) { best = s; bestT = t; }
  }
  const tp = Math.round(best * 40); score += tp;
  if (tp >= 30) reasons.push(`Job title matches "${bestT}"`); else if (tp >= 12) reasons.push(`Job title is close to "${bestT}"`);

  // Skills (30): share of the candidate's skills the job text mentions, capped so a long skills list is not punished.
  const mine = profile.skills.filter((s) => has(body, s));
  if (profile.skills.length) {
    const sp = Math.round(Math.min(1, mine.length / Math.min(6, profile.skills.length)) * 30); score += sp;
    if (mine.length) reasons.push(`Mentions ${mine.length} of your skills: ${mine.slice(0, 5).join(', ')}`);
  }

  // Place and work style (15): can the person actually take it from where they are?
  const wantRemote = prefs.workModes.includes('remote'), wantAny = prefs.workModes.length === 0;
  const country = prefs.country || placeFromLocation(profile.location).country;
  const acc = accessFor(job, country, prefs.locations);
  if (acc.access === 'open') { score += 15; reasons.push(acc.note); }
  else if (acc.access === 'restricted') reasons.push(acc.note);                                     // no points, and a cap below
  else if (job.remote && (wantRemote || wantAny)) { score += 9; if (acc.note) reasons.push(acc.note); }
  else if (!job.location) score += 6;
  else if (job.remote && !wantRemote) score += 4;

  // Level (10)
  const jl = levelOf(job.title);
  if (!jl) score += 6;
  else { const d = Math.abs(RANK.indexOf(jl) - RANK.indexOf(prefs.level)); if (d === 0) { score += 10; reasons.push(`Level fits (${jl})`); } else if (d === 1) score += 5; else reasons.push(`Looks ${jl}-level, you chose ${prefs.level}`); }

  // Industry (5)
  const ind = prefs.industries.find((i) => has(body, i)); if (ind) { score += 5; reasons.push(`In your industry: ${ind}`); }

  // A job the person cannot take from where they are is never a good match, however well the title reads.
  if (acc.access === 'restricted') score = Math.min(score, 40);
  return { score: Math.max(0, Math.min(100, score)), reasons, access: acc.access };
}
