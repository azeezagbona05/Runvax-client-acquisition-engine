import type { CareerProfileData } from '../types';
import { yearsOfExperience } from '../suggest';

/**
 * Qualification check, run before an application can be approved. Rules only, and it errs on the side of saying nothing:
 * it looks for three hard requirements a job states in plain words (years of experience, degree level, named licences or certificates)
 * and compares them with the confirmed profile. A requirement the profile does not show is a "shortfall", which the candidate must
 * acknowledge before approving. It never decides for the candidate, and a "not shown" can mean "not written on the CV".
 */
export interface Qualification { requirement: string; status: 'met' | 'shortfall' }

const DEGREES: Array<{ rank: number; name: string; job: RegExp; has: RegExp }> = [
  { rank: 3, name: 'a PhD / doctorate', job: /\b(ph\.?d|doctorate|doctoral)\b/i, has: /\b(ph\.?d|doctorate|doctoral)\b/i },
  { rank: 2, name: "a master's degree", job: /\b(master'?s|msc|m\.sc|mba|m\.a\.)\b/i, has: /\b(master'?s|msc|m\.sc|mba|m\.a\.|ph\.?d|doctorate)\b/i },
  { rank: 1, name: "a bachelor's degree", job: /\b(bachelor'?s?|bsc|b\.sc|undergraduate degree|university degree|b\.a\.|bengineering|beng)\b/i, has: /\b(bachelor'?s?|bsc|b\.sc|b\.a\.|beng|b\.eng|degree|honou?rs|master'?s|msc|mba|ph\.?d|doctorate|b\.tech|btech|hnd)\b/i },
];
const CREDENTIALS: Array<{ name: string; job: RegExp; has: RegExp }> = [
  { name: 'a nursing licence (RN / NMC / NCLEX)', job: /\b(registered nurse|nmc|nclex|rn licen[cs]e|nursing licen[cs]e)\b/i, has: /\b(registered nurse|rn|nmc|nclex|nursing licen[cs]e|nursing council)\b/i },
  { name: 'a professional accounting qualification (CPA / ACCA / ICAN)', job: /\b(cpa|acca|icaew|ican|chartered accountant)\b/i, has: /\b(cpa|acca|icaew|ican|chartered accountant|aca)\b/i },
  { name: 'PMP certification', job: /\bpmp\b/i, has: /\bpmp\b|project management professional/i },
  { name: 'a driving licence', job: /\b(driver'?s?|driving) licen[cs]e\b/i, has: /\b(driver'?s?|driving) licen[cs]e\b/i },
  { name: 'a teaching qualification', job: /\b(teaching (licen[cs]e|certificate|qualification)|qts|pgce)\b/i, has: /\b(teaching (licen[cs]e|certificate|qualification)|qts|pgce|bachelor of education|b\.?ed)\b/i },
  { name: 'a cloud certification (AWS / Azure / GCP)', job: /\b(aws|azure|gcp|google cloud) (certified|certification)\b/i, has: /\b(aws|azure|gcp|google cloud)[^.\n]{0,30}(certified|certification|associate|professional)\b/i },
  { name: 'a law licence (bar / solicitor)', job: /\b(called to the bar|admitted to practi[cs]e|solicitor|qualified lawyer)\b/i, has: /\b(called to the bar|admitted|solicitor|barrister|advocate|llb|llm)\b/i },
];

export function profileBlob(p: CareerProfileData): string {
  return [p.headline, p.summary, ...p.experience.flatMap((r) => [r.title, ...r.bullets]), ...p.education.map((e) => `${e.qualification} ${e.institution}`), ...p.skills, ...p.certifications].join('\n');
}

export function checkQualifications(p: CareerProfileData, jobText: string, now = new Date()): Qualification[] {
  const out: Qualification[] = []; const blob = profileBlob(p);

  // Years: only "N years" / "N+ years" near "experience", and the largest such figure up to 20 (smaller ones are usually per-skill).
  const yrs = Array.from(jobText.matchAll(/\b(\d{1,2})\s*\+?\s*(?:or more\s+)?(?:years?|yrs)\b[^.\n]{0,40}\bexperience|experience[^.\n]{0,25}?\b(\d{1,2})\s*\+?\s*(?:years?|yrs)\b/gi)).map((m) => Number(m[1] ?? m[2])).filter((n) => n > 0 && n <= 20);
  if (yrs.length) {
    const need = Math.max(...yrs); const have = yearsOfExperience(p, now);
    if (have === null) out.push({ requirement: `${need}+ years of experience (your profile has no dates to show this)`, status: 'shortfall' });
    else out.push({ requirement: `${need}+ years of experience (your profile shows about ${have})`, status: have >= need ? 'met' : 'shortfall' });
  }

  const degree = DEGREES.find((d) => d.job.test(jobText) && /\b(required|must|essential|degree|qualification)\b/i.test(jobText));
  if (degree) out.push({ requirement: degree.name, status: degree.has.test(blob) ? 'met' : 'shortfall' });

  for (const c of CREDENTIALS) if (c.job.test(jobText)) out.push({ requirement: c.name, status: c.has.test(blob) ? 'met' : 'shortfall' });
  return out;
}

export const shortfalls = (q: Qualification[]) => q.filter((x) => x.status === 'shortfall').map((x) => x.requirement);

export const REQ_PREFIX = 'Requirement not shown in your profile: ';
