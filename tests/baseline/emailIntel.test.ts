import { describe, expect, it, vi } from 'vitest';
import { applyPattern, belongsTo, detectPattern, emailsIn, isRoleAddress, pickEmail } from '@/lib/emailIntel';
import { enrichEmails } from '@/lib/emailEnrich';
import { mergeCandidates, samePerson, type DmCandidate } from '@/lib/decisionMaker';

describe('reading addresses out of text', () => {
  it('finds addresses at the domain only, lower-cased, once each, without trailing punctuation', () => {
    const t = 'Email Femi.Aluko@Chowdeck.com, or info@chowdeck.com. Not me@gmail.com or x@other-chowdeck.com. femi.aluko@chowdeck.com)';
    expect(emailsIn(t, 'chowdeck.com')).toEqual(['femi.aluko@chowdeck.com', 'info@chowdeck.com']);
    expect(emailsIn(t, 'www.chowdeck.com')).toHaveLength(2);
    expect(emailsIn('nothing here', 'chowdeck.com')).toEqual([]);
  });
  it('knows role inboxes from personal addresses', () => {
    for (const a of ['info@x.com', 'hello@x.com', 'reservations@x.com', 'sales@x.com']) expect(isRoleAddress(a)).toBe(true);
    expect(isRoleAddress('ada.obi@x.com')).toBe(false);
  });
  it('an address belongs to a person when it carries their name, and never when it is a role inbox', () => {
    expect(belongsTo('ada.okafor@x.com', 'Ada Okafor')).toBe(true);
    expect(belongsTo('aokafor@x.com', 'Ada Okafor')).toBe(true);
    expect(belongsTo('okafor@x.com', 'Dr. Ada Okafor')).toBe(true);
    expect(belongsTo('ada@x.com', 'Ada Okafor')).toBe(false); // too short a first name to be sure
    expect(belongsTo('chidi@x.com', 'Chidi Eze')).toBe(true);
    expect(belongsTo('info@x.com', 'Info Manager')).toBe(false);
    expect(belongsTo('someone.else@x.com', 'Ada Okafor')).toBe(false);
    expect(belongsTo('ada.okafor@x.com', 'Madonna')).toBe(false); // a one-word name cannot be matched
  });
});

describe('how a company writes its addresses', () => {
  it('applies each pattern to a name, ignoring accents and punctuation', () => {
    expect(applyPattern('first.last', 'Ada Okafor', 'x.com')).toBe('ada.okafor@x.com');
    expect(applyPattern('flast', 'Ada Okafor', 'www.X.com')).toBe('aokafor@x.com');
    expect(applyPattern('first', 'Chíamaka Eze-Obi', 'x.com')).toBe('chiamaka@x.com');
    expect(applyPattern('first.last', 'Madonna', 'x.com')).toBeNull();
    expect(applyPattern('first.last', 'Ada Okafor', 'nodot')).toBeNull();
  });
  it('learns the pattern from addresses tied to named people, and refuses when the examples disagree', () => {
    expect(detectPattern([{ name: 'Ada Okafor', email: 'ada.okafor@x.com' }])).toBe('first.last');
    expect(detectPattern([{ name: 'Ada Okafor', email: 'aokafor@x.com' }, { name: 'Tunde Bello', email: 'tbello@x.com' }])).toBe('flast');
    expect(detectPattern([{ name: 'Ada Okafor', email: 'ada.okafor@x.com' }, { name: 'Tunde Bello', email: 'tbello@x.com' }])).toBeNull();
    expect(detectPattern([{ name: 'Ada Okafor', email: 'info@x.com' }])).toBeNull();
    expect(detectPattern([])).toBeNull();
  });
  it('picks published first, then the pattern, then a guess only if allowed', () => {
    const seen = [{ email: 'ada.okafor@x.com', source: 'https://x.com/team' }];
    expect(pickEmail('Ada Okafor', { domain: 'x.com', seen, pattern: null, allowGuess: false })).toEqual({ email: 'ada.okafor@x.com', basis: 'published', source: 'https://x.com/team' });
    expect(pickEmail('Tunde Bello', { domain: 'x.com', seen, pattern: 'first.last', allowGuess: false })).toEqual({ email: 'tunde.bello@x.com', basis: 'inferred' });
    expect(pickEmail('Tunde Bello', { domain: 'x.com', seen: [], pattern: null, allowGuess: false })).toBeNull();
    expect(pickEmail('Tunde Bello', { domain: 'x.com', seen: [], pattern: null, allowGuess: true })).toEqual({ email: 'tunde.bello@x.com', basis: 'guess' });
  });
});

// A confident match by default; the tests about doubtful people say so.
const cand = (name: string, title: string, over: Partial<DmCandidate> = {}): DmCandidate => ({ name, title, source: 'search', confidence: 'medium', match: 'confirmed', ...over });
const site = (email: string) => ({ email, sourcePage: 'https://x.com/contact', ownDomain: true });

describe('giving the people we found an email', () => {
  it('uses an address the company published, labelled as such', async () => {
    const out = await enrichEmails([cand('Ada Okafor', 'CEO')], { domain: 'x.com', siteEmails: [site('ada.okafor@x.com'), site('info@x.com')], allowGuess: false, hasMx: async () => true });
    expect(out[0]).toMatchObject({ email: 'ada.okafor@x.com', emailBasis: 'published', emailSource: 'https://x.com/contact' });
  });
  it('finds an address in a search result and attributes it to the page it was on', async () => {
    const search = vi.fn(async (q: string) => (q.includes('Ada Okafor') ? [{ title: 'Contact', description: 'Reach Ada at ada.okafor@x.com today', url: 'https://news.example/post?utm=1' }] : []));
    const out = await enrichEmails([cand('Ada Okafor', 'CEO')], { domain: 'x.com', siteEmails: [], allowGuess: false, search, hasMx: async () => true });
    expect(out[0]).toMatchObject({ email: 'ada.okafor@x.com', emailBasis: 'published', emailSource: 'https://news.example/post' });
    expect(search.mock.calls[0][0]).toBe('"Ada Okafor" "@x.com"');
  });
  it('applies the company pattern, seen on one person, to another', async () => {
    const out = await enrichEmails([cand('Ada Okafor', 'CEO'), cand('Tunde Bello', 'Managing Director')], { domain: 'x.com', siteEmails: [site('ada.okafor@x.com')], allowGuess: false, hasMx: async () => true });
    expect(out[0].emailBasis).toBe('published');
    expect(out[1]).toMatchObject({ email: 'tunde.bello@x.com', emailBasis: 'inferred' });
  });
  it('offers one labelled guess only when allowed, and nothing when not', async () => {
    const people = [cand('Tunde Bello', 'Managing Director')];
    const on = await enrichEmails(people, { domain: 'x.com', siteEmails: [], allowGuess: true, hasMx: async () => true });
    expect(on[0]).toMatchObject({ email: 'tunde.bello@x.com', emailBasis: 'guess', emailStatus: 'Best guess' });
    const off = await enrichEmails(people, { domain: 'x.com', siteEmails: [], allowGuess: false, hasMx: async () => true });
    expect(off[0].email).toBeUndefined();
  });
  it('gives nothing when the domain cannot receive mail, or there is no website', async () => {
    const people = [cand('Tunde Bello', 'Managing Director')];
    expect((await enrichEmails(people, { domain: 'dead.example', siteEmails: [], allowGuess: true, hasMx: async () => false }))[0].email).toBeUndefined();
    expect((await enrichEmails(people, { domain: null, siteEmails: [], allowGuess: true }))[0].email).toBeUndefined();
  });
  it('never touches someone who already has an email, a role inbox, or people without a real title; and stops at three people', async () => {
    const search = vi.fn(async () => []);
    const people = [cand('Ada Okafor', 'CEO', { email: 'ada@paid.example', emailStatus: 'valid' }), cand('Info Desk', 'Receptionist'), cand('A One', 'Owner'), cand('B Two', 'Owner'), cand('C Three', 'Owner'), cand('D Four', 'Owner')];
    const out = await enrichEmails(people, { domain: 'x.com', siteEmails: [site('info@x.com')], allowGuess: true, search, hasMx: async () => true });
    expect(out[0].email).toBe('ada@paid.example');
    expect(out[0].emailBasis).toBeUndefined();
    expect(out[2].email).toBe('a.one@x.com'); expect(out[3].email).toBe('b.two@x.com'); expect(out[4].email).toBe('c.three@x.com');
    expect(out[5].email).toBeUndefined();
    expect(out.every((c) => c.email !== 'info@x.com')).toBe(true);
  });
  it('does not search for a person whose address is already published, and works without search', async () => {
    const search = vi.fn(async () => []);
    await enrichEmails([cand('Ada Okafor', 'CEO')], { domain: 'x.com', siteEmails: [site('ada.okafor@x.com')], allowGuess: false, search, hasMx: async () => true });
    expect(search).not.toHaveBeenCalled();
    const none = await enrichEmails([cand('Tunde Bello', 'CEO')], { domain: 'x.com', siteEmails: [], allowGuess: false, hasMx: async () => true });
    expect(none[0].email).toBeUndefined();
  });
});

describe('who is trusted with a built address', () => {
  const opts = { domain: 'x.com', siteEmails: [site('ada.okafor@x.com')], allowGuess: true, hasMx: async () => true };
  it('a doubtful match gets no pattern or guess, but a published address is still theirs', async () => {
    const out = await enrichEmails([cand('Ada Okafor', 'CEO', { match: 'confirmed' }), cand('Tunde Bello', 'Vice President', { match: 'likely' })], opts);
    expect(out[0].emailBasis).toBe('published');
    expect(out[1].email).toBeUndefined();
    const published = await enrichEmails([cand('Ada Okafor', 'CEO', { match: 'likely' })], opts);
    expect(published[0]).toMatchObject({ email: 'ada.okafor@x.com', emailBasis: 'published' });
  });
  it('named by the company site, or by two sources, counts as trusted', async () => {
    const out = await enrichEmails([cand('Ada Okafor', 'CEO'), cand('Tunde Bello', 'CEO', { source: 'website', match: undefined }), cand('Chidi Eze', 'Director', { match: 'likely', sources: ['website', 'search'] })], opts);
    expect(out.map((c) => c.emailBasis)).toEqual(['published', 'inferred', 'inferred']);
  });
});

describe('the same person under two names', () => {
  it('Femi Aluko and Babafemi Aluko are one person; different people stay different', () => {
    expect(samePerson('Babafemi Aluko', 'Femi Aluko')).toBe(true);
    expect(samePerson('Ada Obi', 'Ada Okafor')).toBe(false);
    expect(samePerson('Ada Obi', 'Tunde Obi')).toBe(false);
    expect(samePerson('Dr. Ada Obi', 'ada obi')).toBe(true);
  });
  it('are merged into one entry that keeps the best of both', () => {
    const merged = mergeCandidates([cand('Babafemi Aluko', 'ceo / co-founder', { source: 'website', email: 'femi@x.com', emailBasis: 'published' }), cand('Femi Aluko', 'CEO and co-founder', { match: 'likely' })]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ email: 'femi@x.com', emailBasis: 'published' });
    expect(merged[0].sources).toEqual(['website', 'search']);
  });
});
