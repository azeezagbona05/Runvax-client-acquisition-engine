import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/safeFetch', () => ({ safeFetch: vi.fn(async () => new Response('', { status: 404 })) }));
vi.mock('@/lib/apollo', () => ({
  apolloEnabled: () => false,
  findDecisionMaker: vi.fn(),
  domainFromUrl: (u?: string) => (u ? new URL(u).hostname.replace(/^www\./, '') : null),
}));

import { assessReach, cleanPhone, isStrong, recipientEmail, sameName } from '@/lib/decisionMaker';
import { findDecisionMakers } from '@/lib/dmFinder';

describe('contact helpers', () => {
  it('prefers the decision-maker email over the shared inbox', () => {
    expect(recipientEmail({ email: 'info@clinic.com', decisionMaker: { name: 'Ada Obi', title: 'Owner', source: 'hunter', email: 'ada@clinic.com' } })).toBe('ada@clinic.com');
    expect(recipientEmail({ email: 'info@clinic.com' })).toBe('info@clinic.com');
    expect(recipientEmail({})).toBe('');
  });
  it('treats a found personal email as reaching the person, not the front desk', () => {
    const r = assessReach({ email: 'info@clinic.com', decisionMaker: { name: 'Ada Obi', title: 'Principal dentist', source: 'hunter', email: 'ada@clinic.com' } });
    expect(r.level).toBe('direct');
    expect(r.nextStep).toContain('ada@clinic.com');
  });
  it('cleans phone numbers', () => {
    expect(cleanPhone('+234 (803) 123-4567')).toBe('+2348031234567');
    expect(cleanPhone('12')).toBeUndefined();
    expect(cleanPhone(undefined)).toBeUndefined();
  });
  it('matches names across honorifics', () => {
    expect(sameName('Dr. Ada Obi', 'ada obi')).toBe(true);
    expect(sameName('Ada Obi', 'Ada Okafor')).toBe(false);
  });
  it('needs an email to count as strong for paid searches', () => {
    const c = { name: 'Ada Obi', title: 'Owner', source: 'website' as const, confidence: 'medium' as const };
    expect(isStrong(c)).toBe(true);
    expect(isStrong(c, true)).toBe(false);
    expect(isStrong({ ...c, email: 'ada@x.com' }, true)).toBe(true);
  });
});

describe('deep search with Hunter', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('looks up the named person with Email Finder and returns their contact', async () => {
    vi.stubEnv('HUNTER_API_KEY', 'test-key');
    vi.stubEnv('BRAVE_SEARCH_KEY', '');
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes('/email-finder')) {
        return new Response(JSON.stringify({ data: { email: 'Ada@BrightSmile.com', score: 91, position: 'Principal Dentist', phone_number: '+234 803 123 4567', verification: { status: 'valid' } } }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    }));
    const r = await findDecisionMakers(
      { businessName: 'Bright Smile Dental', city: 'Lagos', website: 'https://brightsmile.com', knownPerson: { name: 'Dr Ada Obi', title: 'Principal dentist' } },
      { deep: true },
    );
    expect(calls.some((u) => u.includes('email-finder') && u.includes('first_name=Ada') && u.includes('last_name=Obi'))).toBe(true);
    expect(calls.some((u) => u.includes('domain-search'))).toBe(false);
    expect(r.best).toMatchObject({ email: 'ada@brightsmile.com', phone: '+2348031234567', source: 'hunter', confidence: 'high' });
    expect(r.ran).toContain('hunter');
  });

  it('falls back to Domain Search when no one is named yet', async () => {
    vi.stubEnv('HUNTER_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/domain-search')) {
        return new Response(JSON.stringify({ data: { emails: [
          { value: 'reception@brightsmile.com', first_name: 'Tolu', last_name: 'Ade', position: 'Receptionist', confidence: 95 },
          { value: 'ada@brightsmile.com', first_name: 'Ada', last_name: 'Obi', position: 'Owner', confidence: 85 },
        ] } }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    }));
    const r = await findDecisionMakers({ businessName: 'Bright Smile Dental', city: 'Lagos', website: 'https://brightsmile.com' }, { deep: true });
    expect(r.best).toMatchObject({ name: 'Ada Obi', email: 'ada@brightsmile.com' });
    expect(r.candidates.some((c) => c.name === 'Tolu Ade')).toBe(false);
  });
});
