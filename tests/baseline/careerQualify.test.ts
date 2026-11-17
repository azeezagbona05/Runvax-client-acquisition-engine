import { describe, it, expect } from 'vitest';
import { checkQualifications, shortfalls } from '@/lib/career/apply/qualify';
import { emptyProfile } from '@/lib/career/types';

const now = new Date('2026-06-01T00:00:00Z');
const p = { ...emptyProfile(), skills: ['Triage'], education: [{ institution: 'UNILAG', qualification: 'BSc Nursing', start: '', end: '' }],
  experience: [{ title: 'Staff Nurse', company: 'Lagoon', start: '2021', end: 'Present', location: '', bullets: ['Cared for ward patients'] }] };

describe('qualification check', () => {
  it('flags too few years and meets enough years', () => {
    expect(shortfalls(checkQualifications(p, 'Requires 8+ years of experience in nursing', now))[0]).toMatch(/8\+ years.*about 5/);
    expect(checkQualifications(p, '3 years of relevant experience required', now)[0].status).toBe('met');
  });
  it('flags a missing degree and a missing licence, and accepts ones the profile shows', () => {
    expect(shortfalls(checkQualifications(p, "A master's degree is required", now))).toEqual(["a master's degree"]);
    expect(checkQualifications(p, "Bachelor's degree required", now)[0].status).toBe('met');
    expect(shortfalls(checkQualifications(p, 'You must hold PMP certification', now))).toEqual(['PMP certification']);
    expect(shortfalls(checkQualifications({ ...p, certifications: ['PMP'] }, 'PMP required', now))).toEqual([]);
  });
  it('says nothing when the job states no hard requirement', () => {
    expect(checkQualifications(p, 'Join our friendly team. Great benefits.', now)).toEqual([]);
  });
  it('no dates in the profile is a shortfall for a years requirement, not a pass', () => {
    expect(shortfalls(checkQualifications({ ...p, experience: [] }, '5 years experience required', now)).length).toBe(1);
  });
});
