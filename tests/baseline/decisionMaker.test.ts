import { describe, it, expect } from 'vitest';
import { assessReach, classifyEmail, extractDecisionMaker, firstNameOf, isDecisionTitle } from '@/lib/decisionMaker';

describe('classifyEmail', () => {
  it('flags shared inboxes as generic', () => {
    for (const e of ['info@clinic.ng', 'contact@x.com', 'Admin@x.com', 'reception@x.com', 'bookings@x.com']) {
      expect(classifyEmail(e)).toBe('generic');
    }
  });
  it('recognises role and named addresses', () => {
    expect(classifyEmail('ceo@x.com')).toBe('decision_role');
    expect(classifyEmail('md@x.com')).toBe('decision_role');
    expect(classifyEmail('ade.bello@x.com')).toBe('named');
    expect(classifyEmail('chidi@gmail.com')).toBe('named');
  });
  it('treats opaque or missing addresses safely', () => {
    expect(classifyEmail('')).toBe('none');
    expect(classifyEmail(undefined)).toBe('none');
    expect(classifyEmail('xk92847@gmail.com')).toBe('generic');
  });
});

describe('titles and names', () => {
  it('ranks decision titles and rejects relayers', () => {
    expect(isDecisionTitle('Owner')).toBe(true);
    expect(isDecisionTitle('Managing Director')).toBe(true);
    expect(isDecisionTitle('Principal Dentist')).toBe(true);
    expect(isDecisionTitle('Assistant to the CEO')).toBe(false);
    expect(isDecisionTitle('Receptionist')).toBe(false);
    expect(isDecisionTitle('Manager')).toBe(false); // weak on its own
  });
  it('picks a natural greeting name', () => {
    expect(firstNameOf('Ade Bello')).toBe('Ade');
    expect(firstNameOf('Dr. Ade Bello')).toBe('Ade');
    expect(firstNameOf('Dr. Bello')).toBe('Dr. Bello');
  });
});

describe('assessReach', () => {
  it('direct when a named owner is known', () => {
    const r = assessReach({ email: 'info@x.com', decisionMaker: { name: 'Ade Bello', title: 'Owner', source: 'website' } });
    expect(r.level).toBe('direct');
    expect(r.person?.firstName).toBe('Ade');
  });
  it('a named non-decision title is only likely', () => {
    const r = assessReach({ decisionMaker: { name: 'Tolu Ade', title: 'Receptionist', source: 'website' } });
    expect(r.level).toBe('likely');
  });
  it('manual names with no title count as direct', () => {
    expect(assessReach({ decisionMaker: { name: 'Ade Bello', title: '', source: 'manual' } }).level).toBe('direct');
  });
  it('gatekeeper on shared inbox, unknown with nothing', () => {
    expect(assessReach({ email: 'info@x.com' }).level).toBe('gatekeeper');
    expect(assessReach({}).level).toBe('unknown');
    expect(assessReach({ email: 'ceo@x.com' }).level).toBe('likely');
  });
});

describe('extractDecisionMaker', () => {
  it('reads schema.org founder', () => {
    const html = `<script type="application/ld+json">{"@type":"Dentist","name":"Smile","founder":{"@type":"Person","name":"Dr. Ade Bello"}}</script>`;
    expect(extractDecisionMaker(html)).toMatchObject({ name: 'Dr. Ade Bello', title: 'Founder' });
  });
  it('reads a Person with jobTitle', () => {
    const html = `<script type="application/ld+json">{"@graph":[{"@type":"Person","name":"Funke Alade","jobTitle":"Managing Director"}]}</script>`;
    expect(extractDecisionMaker(html)).toMatchObject({ name: 'Funke Alade', title: 'Managing Director' });
  });
  it('reads "Name, Title" and "Title: Name" text', () => {
    expect(extractDecisionMaker('<p>Chidi Okafor, Founder & CEO</p>')).toMatchObject({ name: 'Chidi Okafor' });
    expect(extractDecisionMaker('<p>Managing Director: Funke Alade</p>')).toMatchObject({ name: 'Funke Alade', title: 'Managing Director' });
  });
  it('reads team-card layout and prefers the strongest title', () => {
    const html = `<div><h3>Tolu Ade</h3><p>Office Manager</p></div><div><h3>Chidi Okafor</h3><p>Owner</p></div>`;
    expect(extractDecisionMaker(html)).toMatchObject({ name: 'Chidi Okafor', title: 'Owner' });
  });
  it('does not invent people from marketing copy', () => {
    expect(extractDecisionMaker('<h1>Our Team</h1><p>Meet Our Director</p><p>Contact Us</p>')).toBeNull();
    expect(extractDecisionMaker('<p>Get a Free Quote, Owner</p>')).toBeNull();
    expect(extractDecisionMaker('')).toBeNull();
  });
});

describe('recipient-aware prompt', async () => {
  const { composePrompt } = await import('@/lib/outreach/composer');
  const { selectFrameworks } = await import('@/lib/outreach/router');
  type Ctx = Parameters<typeof composePrompt>[0];
  const profile = { senderName: 'Sam', businessName: 'Acme', whatsapp: '', replyEmail: '', city: 'Lagos', tagline: '', services: '' };
  const base: Ctx = {
    businessName: 'Smile Dental', industry: 'Dentist', city: 'Lagos', country: 'NG', hasWebsite: false, socialOnly: true,
    leadScore: 7, temperature: 'warm', stage: 'found', channel: 'whatsapp', intent: 'cold_first_touch',
  };
  const build = (recipient?: Ctx['recipient']) => {
    const ctx = { ...base, recipient };
    return composePrompt(ctx, selectFrameworks(ctx), profile);
  };

  it('greets a known decision-maker by first name', () => {
    const { system, user } = build({ level: 'direct', firstName: 'Ade', name: 'Ade Bello', title: 'Owner' });
    expect(system).toContain('Greet them by first name ("Ade")');
    expect(user).toContain('"recipientFirstName": "Ade"');
  });
  it('asks a routing question for a gatekeeper inbox', () => {
    expect(build({ level: 'gatekeeper' }).system).toContain('ONE routing question');
  });
  it('adds a forwarding line when unknown, and nothing when omitted', () => {
    expect(build({ level: 'unknown' }).system).toContain('point you to the right person');
    expect(build(undefined).system).not.toContain('RECIPIENT');
  });
});

import { companyMatches, parseLinkedInResult, parseSnippetResult, mapApifyItem, mergeCandidates, isStrong } from '@/lib/decisionMaker';

describe('multi-source parsing', () => {
  it('matches business names loosely but not wrongly', () => {
    expect(companyMatches('Owner at Smile Dental Clinic Lagos', 'Smile Dental Clinic')).toBe(true);
    expect(companyMatches('Owner at Bright Dental', 'Smile Dental Clinic')).toBe(false);
    expect(companyMatches('anything', '')).toBe(false);
  });
  it('reads a LinkedIn profile hit from search results', () => {
    const r = parseLinkedInResult({ title: 'Ade Bello - Owner - Smile Dental Clinic | LinkedIn', url: 'https://ng.linkedin.com/in/ade-bello-123?trk=x' }, 'Smile Dental Clinic');
    expect(r).toMatchObject({ name: 'Ade Bello', title: 'Owner', linkedin: 'https://ng.linkedin.com/in/ade-bello-123', source: 'search' });
    const at = parseLinkedInResult({ title: 'Funke Alade – Managing Director at Smile Dental | LinkedIn', url: 'https://www.linkedin.com/in/funke' }, 'Smile Dental Clinic');
    expect(at).toMatchObject({ name: 'Funke Alade', title: 'Managing Director' });
  });
  it('rejects LinkedIn hits for another company, non-profiles, or non-decision titles', () => {
    expect(parseLinkedInResult({ title: 'Ade Bello - Owner - Bright Dental | LinkedIn', url: 'https://www.linkedin.com/in/x' }, 'Smile Dental Clinic')).toBeNull();
    expect(parseLinkedInResult({ title: 'Smile Dental Clinic | LinkedIn', url: 'https://www.linkedin.com/company/smile' }, 'Smile Dental Clinic')).toBeNull();
    expect(parseLinkedInResult({ title: 'Tolu Ade - Receptionist - Smile Dental Clinic | LinkedIn', url: 'https://www.linkedin.com/in/t' }, 'Smile Dental Clinic')).toBeNull();
  });
  it('only trusts plain snippets that name the business', () => {
    expect(parseSnippetResult({ title: 'Smile Dental Clinic Lagos', description: 'Chidi Okafor, Founder of Smile Dental Clinic' }, 'Smile Dental Clinic')).toMatchObject({ name: 'Chidi Okafor', confidence: 'low' });
    expect(parseSnippetResult({ title: 'Other Co', description: 'Chidi Okafor, Founder' }, 'Smile Dental Clinic')).toBeNull();
  });
  it('maps differently-shaped Apify items', () => {
    expect(mapApifyItem({ fullName: 'Ade Bello', position: 'CEO', linkedinUrl: 'https://linkedin.com/in/a', email: 'ADE@x.com' }))
      .toMatchObject({ name: 'Ade Bello', title: 'CEO', email: 'ade@x.com', source: 'apify' });
    expect(mapApifyItem({ firstName: 'Funke', lastName: 'Alade', jobTitle: 'Director' })).toMatchObject({ name: 'Funke Alade' });
    expect(mapApifyItem({ name: 'Tolu Ade', title: 'Intern' })).toBeNull();
  });
});

describe('mergeCandidates', () => {
  it('raises confidence when independent sources agree and keeps the best title', () => {
    const merged = mergeCandidates([
      { name: 'Dr. Ade Bello', title: 'Director', source: 'website', confidence: 'medium' },
      { name: 'Ade Bello', title: 'Owner', source: 'search', confidence: 'low', linkedin: 'https://linkedin.com/in/ade' },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ title: 'Owner', confidence: 'high', linkedin: 'https://linkedin.com/in/ade' });
    expect(merged[0].sources).toEqual(['website', 'search']);
  });
  it('orders by title strength and flags when to stop spending credits', () => {
    const merged = mergeCandidates([
      { name: 'Tolu Ade', title: 'Operations Manager', source: 'apollo', confidence: 'high' },
      { name: 'Chidi Okafor', title: 'Founder', source: 'hunter', confidence: 'medium' },
    ]);
    expect(merged[0].name).toBe('Chidi Okafor');
    expect(isStrong(merged[0])).toBe(true);
    expect(isStrong(merged[1])).toBe(false);
    expect(isStrong({ name: 'X Y', title: 'Owner', source: 'search', confidence: 'low' })).toBe(false);
  });
});

import { industryTitles, titleQuery } from '@/lib/decisionMaker';

describe('industryTitles', () => {
  it('uses dental titles for dental clinics', () => {
    const t = industryTitles('Dental clinic', ['dentist', 'health']);
    expect(t[0]).toBe('principal dentist');
    expect(t).toContain('owner');
  });
  it('matches on place types when the category is generic', () => {
    expect(industryTitles('Establishment', ['lawyer'])[0]).toBe('managing partner');
    expect(industryTitles('', ['beauty_salon'])).toContain('salon owner');
  });
  it('does not mistake care, lawn or space for car, law or spa', () => {
    expect(industryTitles('Child care agency')[0]).not.toBe('dealer principal');
    expect(industryTitles('Lawn care service')[0]).not.toBe('managing partner');
    expect(industryTitles('Co-working space')[0]).not.toBe('salon owner');
  });
  it('falls back to generic titles, deduplicated and capped', () => {
    expect(industryTitles('Widget maker')).toEqual(['owner', 'founder', 'managing director', 'CEO']);
    const t = industryTitles('Restaurant');
    expect(new Set(t.map((x) => x.toLowerCase())).size).toBe(t.length);
    expect(t.length).toBeLessThanOrEqual(6);
  });
  it('quotes multi-word titles in the query', () => {
    expect(titleQuery(['owner', 'principal dentist'])).toBe('(owner OR "principal dentist")');
  });
});
