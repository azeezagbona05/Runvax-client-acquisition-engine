import { describe, it, expect } from 'vitest';
import { pickSiteEmail, revealEmails } from '@/lib/siteEmail';

const cf = (email: string, key = 0x2a) => key.toString(16).padStart(2, '0') + Array.from(email).map((c) => (c.charCodeAt(0) ^ key).toString(16).padStart(2, '0')).join('');

describe('email from a business\'s own website', () => {
  it("keeps an address on the site's own domain (the bug: these were thrown away)", () => {
    expect(pickSiteEmail('<a href="mailto:info@brightsmile.ng">Email us</a>')).toBe('info@brightsmile.ng');
  });
  it('prefers a role address over a personal one, and ignores platform noise', () => {
    expect(pickSiteEmail('ada.obi@brightsmile.ng contact@brightsmile.ng abc@sentry.io noreply@brightsmile.ng')).toBe('contact@brightsmile.ng');
  });
  it('reads Cloudflare-protected addresses', () => {
    expect(pickSiteEmail(`<a class="__cf_email__" data-cfemail="${cf('hello@clinic.com')}">[email&#160;protected]</a>`)).toBe('hello@clinic.com');
  });
  it('reads entity-encoded and spelled-out addresses', () => {
    expect(pickSiteEmail('write to sales&#64;shop.ng')).toBe('sales@shop.ng');
    expect(revealEmails('info [at] hotel [dot] com')).toContain('info@hotel.com');
  });
  it('returns null when the page has nothing usable', () => {
    expect(pickSiteEmail('<p>Call us</p> logo@2x.png')).toBeNull();
  });
});
