import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ verify: vi.fn(), on: { v: true } }));
vi.mock('@/lib/snov', async () => {
  const real = await vi.importActual<typeof import('@/lib/snov')>('@/lib/snov');
  return { ...real, snovEnabled: () => m.on.v, verifyEmails: m.verify };
});

import { emailPatterns } from '@/lib/emailPatterns';
import { fillByPattern } from '@/lib/dmFinder';
import type { DmCandidate } from '@/lib/decisionMaker';

const ok = (email: string, smtpStatus: string, disposable = false) => [email, { email, smtpStatus, disposable, webmail: false }] as const;
const person = (name: string, title = 'Owner', over: Partial<DmCandidate> = {}): DmCandidate => ({ name, title, source: 'website', confidence: 'medium', ...over });

beforeEach(() => { m.on.v = true; m.verify.mockReset(); });

describe('emailPatterns', () => {
  it('lists the common address shapes, most likely first, without titles or accents', () => {
    expect(emailPatterns('Dr. Ada Okafor', 'https://www.clinic.ng'.replace('https://', ''))).toEqual(['ada.okafor@clinic.ng', 'ada@clinic.ng', 'aokafor@clinic.ng', 'adaokafor@clinic.ng', 'okafor@clinic.ng']);
    expect(emailPatterns('José Núñez', 'x.com')[0]).toBe('jose.nunez@x.com');
  });
  it('needs a first and last name and a real domain', () => {
    expect(emailPatterns('Madonna', 'x.com')).toEqual([]);
    expect(emailPatterns('Ada Okafor', 'localhost')).toEqual([]);
  });
});

describe('fillByPattern', () => {
  it('keeps the first pattern Snov says exists, and ignores unknown (catch-all) answers', async () => {
    m.verify.mockResolvedValue(new Map([
      ok('ada.okafor@clinic.ng', 'not_valid'), ok('ada@clinic.ng', 'valid'), ok('aokafor@clinic.ng', 'valid'),
      ok('bo.lee@clinic.ng', 'unknown'), ok('bo@clinic.ng', 'unknown'),
    ]));
    const out = await fillByPattern([person('Ada Okafor'), person('Bo Lee', 'Manager')], 'clinic.ng');
    expect(out[0].email).toBe('ada@clinic.ng');
    expect(out[0].emailStatus).toMatch(/Checked: address exists/);
    expect(out[1].email).toBeUndefined();
    expect(m.verify).toHaveBeenCalledTimes(1);
  });
  it('checks everyone in one bulk call and only the top few people', async () => {
    m.verify.mockResolvedValue(new Map());
    await fillByPattern(['A One', 'B Two', 'C Three', 'D Four'].map((n) => person(n)), 'x.com');
    const sent = m.verify.mock.calls[0][0] as string[];
    expect(sent).toHaveLength(15);
    expect(sent.some((e) => e.includes('four'))).toBe(false);
  });
  it('skips people who already have an email or are not decision-makers, and does nothing without Snov or a domain', async () => {
    m.verify.mockResolvedValue(new Map());
    const have = person('Ada Okafor', 'Owner', { email: 'a@x.com' });
    expect(await fillByPattern([have, person('Pat Nurse', 'Receptionist')], 'x.com')).toHaveLength(2);
    expect(m.verify).not.toHaveBeenCalled();
    await fillByPattern([person('Bo Lee')], null);
    m.on.v = false;
    await fillByPattern([person('Bo Lee')], 'x.com');
    expect(m.verify).not.toHaveBeenCalled();
  });
  it('leaves everyone as they were if the verifier fails', async () => {
    m.verify.mockRejectedValue(new Error('down'));
    const c = [person('Ada Okafor')];
    expect(await fillByPattern(c, 'x.com')).toEqual(c);
  });
});
