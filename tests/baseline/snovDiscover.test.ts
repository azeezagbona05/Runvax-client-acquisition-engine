import { describe, it, expect } from 'vitest';
import { autoPick, groupByCompany, maskedName, SNOV_INDUSTRIES } from '@/lib/snovDiscover';
import type { DbProspect } from '@/lib/snov';

const p = (name: string, title: string, domain: string, n = 1): DbProspect => ({
  firstName: name, lastName: 'X***', jobTitle: title, location: 'Lagos', industry: 'Medical Practice',
  company: { name: domain.toUpperCase(), domain, location: 'Lagos', industry: 'Medical Practice', size: '11-50' },
  revealUrl: `https://api.snov.io/v2/database-search/prospects/search-emails/start/${name}${n}`,
});

describe('Discover helpers', () => {
  const people = [p('Ann', 'receptionist', 'a.ng'), p('Bo', 'manager', 'a.ng'), p('Cy', 'ceo & co-founder', 'a.ng'), p('Di', 'director', 'a.ng'), p('Ed', 'owner', 'b.ng'), p('Flo', 'staff nurse', 'b.ng')];
  it('groups people by company, strongest decision-maker first', () => {
    const g = groupByCompany(people);
    expect(g.map((x) => x.company.domain)).toEqual(['a.ng', 'b.ng']);
    expect(g[0].people.map((x) => x.firstName)).toEqual(['Cy', 'Di', 'Bo', 'Ann']);
    expect(g[1].people.map((x) => x.firstName)).toEqual(['Ed', 'Flo']);
  });
  it('picks the top few per company and no more', () => {
    const picked = autoPick(groupByCompany(people), 2);
    expect(picked.size).toBe(4);
    expect(Array.from(picked).map((u) => u.split('/').pop())).toEqual(expect.arrayContaining(['Cy1', 'Di1', 'Ed1', 'Flo1']));
  });
  it('shows a masked name and offers only industries Snov accepts', () => {
    expect(maskedName(people[0])).toBe('Ann X***');
    expect(SNOV_INDUSTRIES).toContain('Medical Practice');
    expect(SNOV_INDUSTRIES.length).toBeGreaterThan(30);
  });
});
