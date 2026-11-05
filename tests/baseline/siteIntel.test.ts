import { describe, it, expect } from 'vitest';
import { channelsOf, crawlSite } from '@/lib/siteIntel';

const site: Record<string, string> = {
  'https://clinic.ng': `<a href="/about-us">About</a><a href="/leadership-team">Leadership</a><a href="https://other.com/team">x</a><a href="/brochure.pdf">pdf</a>
    <a href="tel:+2349061234567">Call</a> <a href="https://www.linkedin.com/company/clinic-ng/">LinkedIn</a>`,
  'https://clinic.ng/about-us': `<h2>Dr. Teniola Adedokun</h2><p>Medical Director</p> <p>Email: teniola.adedokun@clinic.ng</p>`,
  'https://clinic.ng/leadership-team': `<div>Opeyemi Ogunbanjo, Practice Manager</div><a href="https://linkedin.com/in/opeyemi-ogunbanjo-1a2b3c">in</a>`,
  'https://clinic.ng/contact': `<form><input type="email" name="email"><textarea name="message"></textarea></form> reach us: info@clinic.ng or 0906 123 4567`,
};

const crawl = (pages = site) => {
  const asked: string[] = [];
  return { asked, run: () => crawlSite('clinic.ng', async (u) => { asked.push(u); return pages[u] ?? ''; }) };
};

describe('website intelligence', () => {
  it('finds people, titles, emails, phones, LinkedIn and the page each came from', async () => {
    const intel = (await crawl().run())!;
    expect(intel.people.map((p) => [p.name, p.title, p.sourcePage])).toEqual(expect.arrayContaining([
      ['Dr. Teniola Adedokun', 'Medical Director', 'https://clinic.ng/about-us'],
      ['Opeyemi Ogunbanjo', 'Practice Manager', 'https://clinic.ng/leadership-team'],
    ]));
    expect(intel.emails.map((e) => e.email).sort()).toEqual(['info@clinic.ng', 'teniola.adedokun@clinic.ng']);
    expect(intel.emails.find((e) => e.email === 'info@clinic.ng')).toMatchObject({ sourcePage: 'https://clinic.ng/contact', personal: false, ownDomain: true });
    expect(intel.phones.map((p) => p.phone.replace(/\D/g, ''))).toEqual(expect.arrayContaining(['2349061234567']));
    expect(intel.linkedin.map((l) => l.kind).sort()).toEqual(['company', 'person']);
    expect(intel.contactForm).toBe('https://clinic.ng/contact');
  });
  it('attaches a person\'s own address and LinkedIn profile to them, and only theirs', async () => {
    const intel = (await crawl().run())!;
    const ada = intel.people.find((p) => p.name.includes('Teniola'))!;
    expect(ada.email).toBe('teniola.adedokun@clinic.ng');
    expect(intel.people.find((p) => p.name === 'Opeyemi Ogunbanjo')).toMatchObject({ linkedin: 'https://linkedin.com/in/opeyemi-ogunbanjo-1a2b3c' });
    expect(intel.people.find((p) => p.name === 'Opeyemi Ogunbanjo')!.email).toBeUndefined();
  });
  it('follows the site\'s own team/about links, stays on the site, skips files, and caps the pages visited', async () => {
    const c = crawl();
    await c.run();
    expect(c.asked).toContain('https://clinic.ng/leadership-team');
    expect(c.asked.some((u) => u.includes('other.com') || u.endsWith('.pdf'))).toBe(false);
    expect(new Set(c.asked).size).toBe(c.asked.length);
    expect(c.asked.length).toBeLessThanOrEqual(10);
  });
  it('keeps the kinds of contact apart, strongest first', async () => {
    const ch = channelsOf((await crawl().run())!);
    expect(ch.map((c) => c.type)).toEqual(['decision_maker_email', 'general_email', 'contact_form', 'business_phone', 'business_phone'].slice(0, ch.length));
    expect(ch[0]).toMatchObject({ type: 'decision_maker_email', value: 'teniola.adedokun@clinic.ng', person: 'Dr. Teniola Adedokun' });
    expect(ch.find((c) => c.type === 'general_email')?.value).toBe('info@clinic.ng');
  });
  it('says so when there is nothing, and survives a dead or invalid site', async () => {
    expect(channelsOf(null)).toEqual([{ type: 'none' }]);
    const empty = (await crawl({}).run())!;
    expect(channelsOf(empty)).toEqual([{ type: 'none' }]);
    expect(await crawlSite('http://', async () => '')).toBeNull();
  });
});
