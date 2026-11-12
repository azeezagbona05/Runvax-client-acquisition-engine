import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { docxToText } from '@/lib/career/cvText';
import { ground, parseByRules } from '@/lib/career/parse';
import { guard, tailorByRules } from '@/lib/career/tailor';
import { deployIssues, sanitizeDiscovery, sanitizePermissions, sanitizePreferences, sanitizeProfile } from '@/lib/career/types';

const CV = `Ada Obi
ada.obi@example.com | +234 801 234 5678 | Lagos, Nigeria

Professional Summary
Frontend developer with five years building React applications.

Experience

Frontend Developer | Bright Labs
Jan 2021 - Present
- Built a React dashboard used by 300 customers
- Cut page load time by 40%

Junior Developer, Pixel House
2019 - 2020
- Maintained marketing websites

Education
BSc Computer Science
University of Lagos, 2018

Skills
React, TypeScript, Node.js, CSS

Certifications
- AWS Cloud Practitioner
`;

describe('rules reader', () => {
  const p = parseByRules(CV);
  it('reads contact details, roles, education, skills and certifications', () => {
    expect(p.name).toBe('Ada Obi');
    expect(p.email).toBe('ada.obi@example.com');
    expect(p.experience.map((r) => r.company)).toEqual(['Bright Labs', 'Pixel House']);
    expect(p.experience[0].bullets).toContain('Cut page load time by 40%');
    expect(p.education[0].qualification).toMatch(/BSc/);
    expect(p.skills).toEqual(expect.arrayContaining(['React', 'TypeScript', 'Node.js']));
    expect(p.certifications).toContain('AWS Cloud Practitioner');
  });
  it('everything it read is grounded in the CV', () => { expect(ground(p, CV).removed).toEqual([]); });
});

describe('never invents experience (grounding)', () => {
  it('drops an employer, skill, certification, number and degree that the CV does not contain', () => {
    const forged = sanitizeProfile({
      name: 'Ada Obi', skills: ['React', 'Java', 'Kubernetes'], certifications: ['AWS Cloud Practitioner', 'PMP'],
      experience: [{ title: 'Frontend Developer', company: 'Bright Labs', bullets: ['Built a React dashboard used by 300 customers', 'Grew revenue by 250% at Google'] }, { title: 'CTO', company: 'Google', bullets: [] }],
      education: [{ institution: 'Harvard', qualification: 'MBA' }, { institution: 'University of Lagos', qualification: 'BSc Computer Science' }],
    });
    const { profile, removed } = ground(forged, CV);
    expect(profile.skills).toEqual(['React']);            // "Java" must not match "JavaScript"-style substrings, Kubernetes absent
    expect(profile.certifications).toEqual(['AWS Cloud Practitioner']);
    expect(profile.experience.map((r) => r.company)).toEqual(['Bright Labs']);
    expect(profile.experience[0].bullets).toEqual(['Built a React dashboard used by 300 customers']);
    expect(profile.education.map((e) => e.institution)).toEqual(['University of Lagos']);
    expect(removed.length).toBeGreaterThanOrEqual(6);
  });
  it('a number that is not in the CV is never kept', () => {
    const { profile } = ground(sanitizeProfile({ experience: [{ title: 'Frontend Developer', company: 'Bright Labs', bullets: ['Cut page load time by 90%'] }] }), CV);
    expect(profile.experience[0].bullets).toEqual([]);
  });
});

describe('tailoring guard', () => {
  const p = parseByRules(CV);
  it('removes claims about years, employers and numbers the profile lacks', () => {
    const g = guard('I built a React dashboard used by 300 customers. I have 12 years of experience. I worked at Google leading 50 engineers.', p, 'React developer wanted');
    expect(g.text).toContain('300 customers');
    expect(g.text).not.toMatch(/12 years|Google|50 engineers/);
    expect(g.flags.length).toBe(2);
  });
  it('keeps greetings and sign-offs, and paragraphs', () => {
    expect(guard('Dear Hiring Manager,\n\nI build React applications.\n\nKind regards,\nAda Obi', p, 'React').text).toBe('Dear Hiring Manager,\n\nI build React applications.\n\nKind regards,\nAda Obi');
  });
  it('the basic writer uses only profile content', () => {
    const t = tailorByRules(p, 'We need someone with React and TypeScript for a frontend role', 'Frontend Developer');
    expect(t.matchedSkills).toEqual(expect.arrayContaining(['React', 'TypeScript']));
    expect(t.coverLetter).toContain('Bright Labs');
    expect(guard(t.coverLetter, p, '').flags).toEqual([]);
  });
});

describe('docx reading', () => {
  const docx = (xml: string) => zipSync({ 'word/document.xml': strToU8(xml) });
  it('extracts paragraph text', () => {
    const t = docxToText(docx('<w:document><w:body><w:p><w:r><w:t>Ada Obi</w:t></w:r></w:p><w:p><w:r><w:t>React &amp; Node</w:t></w:r></w:p></w:body></w:document>'));
    expect(t).toBe('Ada Obi\nReact & Node\n');
  });
  it('refuses a zip that is not a Word file', () => { expect(() => docxToText(zipSync({ 'x.txt': strToU8('hi') }))).toThrow(/Word/); });
});

describe('settings sanitizers', () => {
  it('clamps and cleans', () => {
    expect(sanitizePreferences({ titles: ' A ,A, B', workModes: ['remote', 'moon'], salaryMin: 5000, salaryMax: 100, level: 'wizard' })).toMatchObject({ titles: ['A', 'B'], workModes: ['remote'], salaryMax: 5000, level: 'mid' });
    expect(sanitizeDiscovery({ sources: ['company_careers', 'evil'], minScore: 5, frequency: 'hourly' })).toMatchObject({ sources: ['company_careers'], minScore: 50, frequency: 'daily' });
    expect(sanitizePermissions({ mode: 'yolo', autoMinScore: 10, autoMaxPerDay: 500 })).toMatchObject({ mode: 'prepare', autoMinScore: 70, autoMaxPerDay: 20 });
  });
  it('cannot deploy until the profile is confirmed and basics are set', () => {
    const ok = { hasProfile: true, profileConfirmed: true, prefs: sanitizePreferences({ titles: ['Dev'], workModes: ['remote'] }), discovery: sanitizeDiscovery({ sources: ['job_feeds'] }) };
    expect(deployIssues(ok)).toEqual([]);
    expect(deployIssues({ ...ok, profileConfirmed: false })[0]).toMatch(/confirm/i);
    expect(deployIssues({ ...ok, hasProfile: false })[0]).toMatch(/Upload/);
  });
});

import { buildTailoredCv } from '@/lib/career/apply/prepare';
describe('tailored CV (Phase 3)', () => {
  const profile = sanitizeProfile({
    name: 'Ada Obi', summary: 'Frontend developer with five years building React applications.', skills: ['CSS', 'React', 'SQL'],
    experience: [{ title: 'Frontend Developer', company: 'Bright Labs', start: '2021', end: 'Present', bullets: ['Maintained legacy forms', 'Built a React dashboard used by 300 customers', 'Cut page load time by 40%'] }],
  });
  it('puts relevant skills and bullets first and keeps everything from the profile', () => {
    const { cv } = buildTailoredCv(profile, { summary: '', matchedSkills: ['React'] }, 'We need React dashboards');
    expect(cv.skills[0]).toBe('React'); expect(cv.skills.sort()).toEqual(['CSS', 'React', 'SQL']);
    expect(cv.experience[0].bullets[0]).toBe('Built a React dashboard used by 300 customers');
    expect(cv.experience[0].bullets).toHaveLength(3); expect(cv.summary).toBe(profile.summary);
  });
  it('never lets an invented claim into the tailored CV', () => {
    const { cv, dropped } = buildTailoredCv(profile, { summary: 'Principal architect with 15 years at Google leading 200 engineers.', matchedSkills: ['Kubernetes'] }, 'Kubernetes');
    expect(cv.summary).toBe(profile.summary);        // unbacked summary falls back to the candidate's own
    expect(cv.skills).not.toContain('Kubernetes'); expect(JSON.stringify(cv)).not.toMatch(/Google|15 years|200/);
    expect(dropped.length).toBeGreaterThan(0);
  });
});
