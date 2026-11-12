import type { CareerProfileData, Preferences } from '@/lib/career/types';
import type { Job } from './sources';

/**
 * Deterministic, explainable job fit (0-100). No AI: every point comes from a stated reason the candidate can read.
 * Title 40 + skills 30 + place/work style 15 + level 10 + industry 5.
 */
export interface Fit { score: number; reasons: string[] }

const STOP = new Set(['and', 'the', 'for', 'with', 'of', 'a', 'an', 'in', 'at', 'to', 'sr', 'jr']);
// Titles say the same thing in different words: Front-end / Frontend / Front End, Engineer / Developer.
const canon = (s: string) => s.toLowerCase().replace(/front[\s-]*end/g, 'frontend').replace(/back[\s-]*end/g, 'backend').replace(/full[\s-]*stack/g, 'fullstack').replace(/\b(?:engineers?|programmers?|developers?)\b/g, 'developer').replace(/\bsoftware developer\b/g, 'developer');
const toks = (s: string) => canon(s).replace(/[^a-z0-9+#.\s]/g, ' ').replace(/\.+(?=\s|$)/g, '').split(/\s+/).filter((t) => t && !STOP.has(t));
const has = (hay: string, needle: string) => { const n = toks(needle).join(' '); return n.length > 0 && ` ${toks(hay).join(' ')} `.includes(` ${n} `); };

// A specialty that contradicts the one wanted (back-end vs front-end) must not look like a near match. Full-stack is compatible with both.
const SPECIALTY = ['frontend', 'backend', 'mobile', 'data', 'devops', 'security', 'qa', 'ios', 'android'];
const specialties = (t: string) => { const w = new Set(toks(t)); return { set: SPECIALTY.filter((x) => w.has(x)), full: w.has('fullstack') }; };

const RANK = ['entry', 'junior', 'mid', 'senior', 'lead', 'executive'];
export function levelOf(title: string): string | null {
  const t = title.toLowerCase();
  if (/\b(?:intern|internship|graduate|trainee|entry|apprentice)\b/.test(t)) return 'entry';
  if (/\b(?:junior|jr)\b/.test(t)) return 'junior';
  if (/\b(?:head of|director|vp|vice president|chief|cto|ceo)\b/.test(t)) return 'executive';
  if (/\b(?:lead|principal|staff|manager)\b/.test(t)) return 'lead';
  if (/\b(?:senior|sr)\b/.test(t)) return 'senior';
  return null;
}

export function scoreJob(job: Job, profile: CareerProfileData, prefs: Preferences): Fit {
  const reasons: string[] = []; let score = 0;
  const body = `${job.title}\n${job.description}`;

  // Title (40): against the titles wanted, then (weaker) the latest title held.
  const wanted = prefs.titles.length ? prefs.titles : profile.experience[0]?.title ? [profile.experience[0].title] : [];
  let best = 0, bestT = '';
  for (const t of wanted) {
    const w = toks(t); if (!w.length) continue;
    const jt = new Set(toks(job.title)); const shared = w.filter((x) => jt.has(x)).length / w.length;
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

  // Place and work style (15)
  const wantRemote = prefs.workModes.includes('remote'), wantAny = prefs.workModes.length === 0;
  const places = [prefs.country, ...prefs.locations].filter(Boolean);
  const inPlace = places.some((p) => has(job.location, p));
  if (job.remote && (wantRemote || wantAny)) { score += 15; reasons.push('Remote, as you prefer'); }
  else if (inPlace) { score += 15; reasons.push(`Located in ${job.location}`); }
  else if (!job.location) score += 6;
  else if (job.remote && !wantRemote) score += 4;

  // Level (10)
  const jl = levelOf(job.title);
  if (!jl) score += 6;
  else { const d = Math.abs(RANK.indexOf(jl) - RANK.indexOf(prefs.level)); if (d === 0) { score += 10; reasons.push(`Level fits (${jl})`); } else if (d === 1) score += 5; else reasons.push(`Looks ${jl}-level, you chose ${prefs.level}`); }

  // Industry (5)
  const ind = prefs.industries.find((i) => has(body, i)); if (ind) { score += 5; reasons.push(`In your industry: ${ind}`); }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}
