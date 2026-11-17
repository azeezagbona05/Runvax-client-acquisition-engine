import type { CareerProfileData } from '../types';
import { profileBlob } from '../apply/qualify';

/** Weekly career recommendations. Rules over the candidate's own data. Every line says what it is based on, and none of them is applied automatically. */
export interface Recommendation { id: string; title: string; detail: string }
export interface RecommendInput {
  profile: CareerProfileData; titles: string[]; minScore: number;
  jobs: Array<{ title: string; text: string; score: number; restricted: boolean }>;
  applied: number; replied: number; waitingApprovals: number; appliedLast7Days: number;
}

const SKILLS = ['sql', 'python', 'javascript', 'typescript', 'react', 'node.js', 'java', 'aws', 'azure', 'docker', 'kubernetes', 'excel', 'power bi', 'tableau', 'figma', 'seo', 'google analytics', 'crm', 'salesforce', 'hubspot', 'project management', 'agile', 'scrum', 'stakeholder management', 'budgeting', 'forecasting', 'financial reporting', 'bookkeeping', 'quickbooks', 'payroll', 'recruitment', 'customer service', 'negotiation', 'public speaking', 'content writing', 'copywriting', 'social media', 'patient care', 'triage', 'wound care', 'iv therapy', 'phlebotomy', 'lesson planning', 'classroom management', 'logistics', 'procurement', 'supply chain', 'inventory management', 'health and safety', 'quality assurance', 'data analysis', 'machine learning', 'api', 'git', 'ci/cd', 'linux', 'cybersecurity', 'customer support', 'sales', 'cold calling', 'lead generation', 'photoshop', 'video editing'];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const mentions = (text: string, term: string) => new RegExp(`(^|[^a-z0-9])${esc(term)}([^a-z0-9]|$)`, 'i').test(text);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function recommend(i: RecommendInput): Recommendation[] {
  const out: Recommendation[] = []; const blob = profileBlob(i.profile);
  const good = i.jobs.filter((j) => j.score >= i.minScore);

  // 1. Skills the best matches ask for and the profile does not show.
  if (good.length >= 5) {
    const gaps = SKILLS.map((s) => ({ s, n: good.filter((j) => mentions(j.text, s)).length })).filter((x) => x.n >= Math.max(3, Math.ceil(good.length * 0.25)) && !mentions(blob, x.s)).sort((a, b) => b.n - a.n).slice(0, 4);
    if (gaps.length) out.push({ id: 'skills', title: 'Skills your best matches ask for', detail: `${gaps.map((g) => `${g.s} (${g.n} of ${good.length})`).join(', ')}. They are not on your profile. Add one only if you really have it; otherwise it is a good thing to learn.` });
  }

  // 2. Job titles that keep appearing among good matches and are not in the preferences.
  const wanted = i.titles.map(norm); const seen = new Map<string, number>();
  for (const j of good) { const t = norm(j.title.replace(/\(.*?\)|[-,|].*$/g, '')); if (t && !wanted.some((w) => t.includes(w) || w.includes(t))) seen.set(t, (seen.get(t) ?? 0) + 1); }
  const titles = Array.from(seen.entries()).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (titles.length) out.push({ id: 'titles', title: 'Other job titles that fit you', detail: `${titles.map(([t, n]) => `"${t}" (${n} matches)`).join(', ')}. You do not search for these yet. Add them to your job titles if you would take them.` });

  // 3. Too many jobs closed to the candidate's country.
  if (i.jobs.length >= 10) {
    const r = i.jobs.filter((j) => j.restricted).length;
    if (r / i.jobs.length >= 0.4) out.push({ id: 'restricted', title: 'Many jobs are not open to where you live', detail: `${r} of ${i.jobs.length} recent jobs name another country. Add nearer cities or choose on-site and hybrid work, and check the Employers near you source.` });
  }

  // 4. The match bar.
  if (i.jobs.length >= 20 && good.length < 5) out.push({ id: 'bar-low', title: 'Your match bar may be too high', detail: `Only ${good.length} of ${i.jobs.length} recent jobs reach ${i.minScore}. Try ${Math.max(40, i.minScore - 10)} for a week.` });
  if (good.length > 120) out.push({ id: 'bar-high', title: 'Your match bar may be too low', detail: `${good.length} jobs reach ${i.minScore}, more than you can review. Try ${Math.min(90, i.minScore + 10)}.` });

  // 5. Outcomes.
  if (i.applied >= 5 && i.replied === 0) out.push({ id: 'silence', title: 'No replies yet', detail: `You applied to ${i.applied} jobs and no employer has replied. Send the follow-ups that are due, and try open applications to employers near you.` });
  if (i.waitingApprovals > 0 && i.appliedLast7Days === 0) out.push({ id: 'stalled', title: 'Applications are waiting for you', detail: `${i.waitingApprovals} prepared application${i.waitingApprovals === 1 ? ' is' : 's are'} waiting for your decision and you sent none this week.` });

  if (!out.length) out.push({ id: 'steady', title: 'Nothing to change this week', detail: 'Keep reviewing matches and replying to employers. The numbers here do not suggest a change yet.' });
  return out;
}
