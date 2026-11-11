import { describe, it, expect, vi } from 'vitest';
import { domainOf, emailStateOf, findPeople, tidyPeople, type PeopleDeps } from '@/lib/acqPeople';

const input = { name: 'Bright Dental', address: '12 Admiralty Way, Lekki, Lagos', website: 'https://www.brightdental.ng/contact', category: 'Dentist', max: 5 };
const cand = (name: string, title = 'Owner', extra = {}) => ({ name, title, source: 'website' as const, confidence: 'medium' as const, ...extra });

describe('domainOf', () => {
  it('reads the business domain and ignores social pages', () => {
    expect(domainOf('https://www.brightdental.ng/contact')).toBe('brightdental.ng');
    expect(domainOf('brightdental.ng')).toBe('brightdental.ng');
    expect(domainOf('https://facebook.com/brightdental')).toBeNull();
    expect(domainOf('https://instagram.com/x')).toBeNull();
    expect(domainOf('')).toBeNull();
    expect(domainOf('not a url')).toBeNull();
  });
});

describe('emailStateOf', () => {
  it('only a checked address is confirmed', () => {
    expect(emailStateOf('valid')).toBe('confirmed');
    expect(emailStateOf('Checked: address exists')).toBe('confirmed');
    expect(emailStateOf('not_valid')).toBe('unconfirmed');
    expect(emailStateOf('unknown')).toBe('unconfirmed');
    expect(emailStateOf(undefined)).toBe('unconfirmed');
  });
});

describe('findPeople', () => {
  const fallback = vi.fn(async () => ({ candidates: [cand('Ada Obi', 'Founder', { email: 'ada@brightdental.ng', emailStatus: 'exists' })] }));

  it('uses the first source when it finds people, and does not touch the fallback', async () => {
    const f = vi.fn(fallback);
    const deps: PeopleDeps = { primary: { enabled: () => true, contacts: async () => [{ name: 'Tolu Bello', position: 'Practice Manager', email: 'tolu@brightdental.ng', smtpStatus: 'valid' }, { name: 'Dr Eze', position: 'Dentist' }] }, fallback: f };
    const r = await findPeople(input, deps);
    expect(r.via).toBe('primary');
    expect(r.people).toHaveLength(2);
    expect(r.people[0]).toMatchObject({ name: 'Tolu Bello', emailState: 'confirmed' });
    expect(r.people[1].email).toBeUndefined();
    expect(f).not.toHaveBeenCalled();
  });
  it('falls back when the first source finds nobody', async () => {
    const r = await findPeople(input, { primary: { enabled: () => true, contacts: async () => [] }, fallback });
    expect(r.via).toBe('fallback');
    expect(r.people[0]).toMatchObject({ name: 'Ada Obi', email: 'ada@brightdental.ng', emailState: 'confirmed' });
  });
  it('falls back when the first source fails or is not available', async () => {
    expect((await findPeople(input, { primary: { enabled: () => true, contacts: async () => { throw new Error('out of credits'); } }, fallback })).via).toBe('fallback');
    expect((await findPeople(input, { primary: null, fallback })).via).toBe('fallback');
    expect((await findPeople(input, { primary: { enabled: () => false, contacts: async () => [] }, fallback })).via).toBe('fallback');
  });
  it('skips the first source when the business has no website of its own', async () => {
    const contacts = vi.fn(async () => []);
    await findPeople({ ...input, website: 'https://facebook.com/brightdental' }, { primary: { enabled: () => true, contacts }, fallback });
    expect(contacts).not.toHaveBeenCalled();
  });
  it('says so when nobody is found anywhere', async () => {
    const r = await findPeople(input, { primary: null, fallback: async () => ({ candidates: [] }) });
    expect(r).toMatchObject({ via: 'none', people: [] });
    expect(r.note).toBeTruthy();
    expect((await findPeople({ ...input, website: '' }, { primary: null, fallback: async () => { throw new Error('x'); } })).note).toMatch(/no website/i);
  });
  it('passes the city and category to the fallback', async () => {
    const f = vi.fn(async () => ({ candidates: [] }));
    await findPeople(input, { primary: null, fallback: f });
    expect(f).toHaveBeenCalledWith(expect.objectContaining({ businessName: 'Bright Dental', city: 'Lekki', category: 'Dentist' }));
  });
});

describe('tidyPeople', () => {
  it('merges duplicates keeping the one with an email, drops bad emails and blanks, and caps the list', () => {
    const out = tidyPeople([{ name: 'Ada Obi', title: 'Founder' }, { name: 'ada obi', title: 'Founder', email: 'ADA@x.com' }, { name: '  ', title: 'x' }, { name: 'Bob', title: '', email: 'not-an-email' }]);
    expect(out).toHaveLength(2);
    expect(out[0].email).toBe('ada@x.com');
    expect(out[1].email).toBeUndefined();
    expect(tidyPeople(Array.from({ length: 20 }, (_, i) => ({ name: `P${i}`, title: '' })), 3)).toHaveLength(3);
  });
});

describe('findPeople: contact channels from the fallback', () => {
  it('keeps the general contact when nobody is named', async () => {
    const r = await findPeople(input, { primary: null, fallback: async () => ({ candidates: [], channels: [{ type: 'general_email' as const, value: 'info@brightdental.ng' }, { type: 'none' as const }] }) });
    expect(r.via).toBe('none');
    expect(r.channels?.[0].value).toBe('info@brightdental.ng');
  });
  it('passes the channels and source page through when people are found', async () => {
    const r = await findPeople(input, { primary: null, fallback: async () => ({ candidates: [cand('Ada Obi', 'Founder', { sourcePage: 'https://brightdental.ng/team' })], channels: [{ type: 'contact_form' as const, value: 'https://brightdental.ng/contact' }] }) });
    expect(r.via).toBe('fallback');
    expect(r.people[0].sourcePage).toBe('https://brightdental.ng/team');
    expect(r.channels?.[0].type).toBe('contact_form');
  });
});

describe('mergePeople + engine', () => {
  const eng = [
    { name: 'Dr. Seun Akinbobola', title: 'MD/CEO', email: 'seun.akinbobola@x.com', emailBasis: 'inferred' as const, status: 'UNVERIFIED' },
    { name: 'Dr. Uku Nketim', title: 'Aesthetic Dentist', email: 'uku.nketim@x.com', emailBasis: 'guess' as const, status: 'UNVERIFIED' },
  ];
  it('keeps the finder\'s email, adds team members only the engine saw', async () => {
    const { mergePeople } = await import('@/lib/acqPeople');
    const r = mergePeople([{ name: 'Seun Akinbobola', title: 'CEO', email: 'seun@x.com' }], eng);
    expect(r).toHaveLength(2);
    expect(r[0].email).toBe('seun@x.com');
    expect(r[1].name).toBe('Dr. Uku Nketim');
  });
  it('findPeople returns the whole team with statuses when the finder finds nobody', async () => {
    const r = await findPeople({ name: 'X', website: 'https://brightdental.com', max: 5 }, { primary: null, fallback: async () => ({ candidates: [] }), engine: async () => eng });
    expect(r.people.map((p) => p.name)).toEqual(['Dr. Seun Akinbobola', 'Dr. Uku Nketim']);
    expect(r.people[1].status).toBe('UNVERIFIED');
  });
  it('survives the engine failing', async () => {
    const r = await findPeople({ name: 'X', website: 'https://brightdental.com', max: 5 }, { primary: null, fallback: async () => ({ candidates: [{ name: 'A B', title: 'Owner', source: 'x', confidence: 'high' } as never] }), engine: async () => { throw new Error('boom'); } });
    expect(r.people).toHaveLength(1);
  });
});
