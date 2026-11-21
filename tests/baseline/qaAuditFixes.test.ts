import { describe, it, expect, afterEach } from 'vitest';
import { buildEmail, hasPlaceholder, stripPlaceholderLines } from '@/lib/outreachCampaign';
import { tidyPeople } from '@/lib/acqPeople';
import { getAppName } from '@/lib/url';
import { isPublicMailHost, openSecret, sealSecret } from '@/lib/integrations/crypto';

const lead = { email: 'a@b.test', name: 'Dr Amaka', business: 'Lekki Teeth Care' };
const mail = (body: string, sender: { name?: string; business?: string } = {}) =>
  buildEmail({ subject: 'Hi', body, lead, sender, unsubscribeUrl: 'https://x.test/u' });

describe('placeholder signatures never reach a prospect', () => {
  it('removes a [Your Name] line from the body', () => {
    const out = mail('Hi there,\n\nWould you like a website?\n\nBest regards,\n[Your Name]');
    expect(out.text).not.toMatch(/\[Your Name\]/);
    expect(out.html).not.toMatch(/\[Your Name\]/);
    expect(out.text).toContain('Best regards,');
  });
  it('uses the real sender signature instead', () => {
    const out = mail('Hello\n\nBest regards,\n[Your Name]', { name: 'Ada Okafor', business: 'Ada Web Studio' });
    expect(out.text).toContain('Ada Okafor | Ada Web Studio');
    expect(out.text).not.toContain('[Your');
  });
  it('detects placeholders and leaves ordinary brackets alone', () => {
    expect(hasPlaceholder('Thanks, [Your Name]')).toBe(true);
    expect(hasPlaceholder('Call us (Mon-Fri) [see site]')).toBe(false);
    expect(stripPlaceholderLines('Keep [see site] here')).toBe('Keep [see site] here');
  });
});

describe('decision-makers come first', () => {
  const p = (name: string, title: string) => ({ name, title });
  it('ranks owners above managers and drops assistants when someone senior exists', () => {
    const out = tidyPeople([p('Amoo K', 'Registered Dental Assistant'), p('Ops Person', 'Operations Manager'), p('Dr Boss', 'Founder and Principal Dentist'), p('Nnadi P', 'Dental Nurse')]);
    expect(out.map((x) => x.name)).toEqual(['Dr Boss', 'Ops Person']);
  });
  it('keeps assistants when nobody senior was found', () => {
    expect(tidyPeople([p('Amoo K', 'Dental Assistant')]).map((x) => x.name)).toEqual(['Amoo K']);
  });
});

describe('brand name', () => {
  const old = process.env.APP_NAME;
  afterEach(() => { if (old === undefined) delete process.env.APP_NAME; else process.env.APP_NAME = old; });
  it('ignores a stale APP_NAME environment value', () => {
    process.env.APP_NAME = 'Beam AI Team';
    expect(getAppName()).toBe('Runvax');
  });
});

describe('mailbox secrets', () => {
  const oldSecret = process.env.NEXTAUTH_SECRET; const oldEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NEXTAUTH_SECRET = oldSecret; (process.env as Record<string, string>).NODE_ENV = oldEnv ?? 'test'; });
  it('encrypts and decrypts a password, and still reads legacy plain text', () => {
    process.env.NEXTAUTH_SECRET = 'test-secret';
    const sealed = sealSecret('app-password-123');
    expect(sealed).not.toContain('app-password-123');
    expect(openSecret(sealed)).toBe('app-password-123');
    expect(openSecret('legacy-plain')).toBe('legacy-plain');
    expect(openSecret(null)).toBeNull();
  });
  it('refuses private and loopback mail hosts in production only', () => {
    (process.env as Record<string, string>).NODE_ENV = 'production';
    for (const h of ['localhost', '127.0.0.1', '10.0.0.5', '192.168.1.9', '172.20.0.1', '169.254.169.254', 'db.internal', '::1']) expect(isPublicMailHost(h), h).toBe(false);
    for (const h of ['smtp.gmail.com', 'mail.example.com', '8.8.8.8']) expect(isPublicMailHost(h), h).toBe(true);
    (process.env as Record<string, string>).NODE_ENV = 'development';
    expect(isPublicMailHost('127.0.0.1')).toBe(true);
  });
});
