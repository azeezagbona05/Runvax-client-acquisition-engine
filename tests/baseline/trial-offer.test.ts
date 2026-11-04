import { describe, it, expect, afterEach } from 'vitest';
import { priceToKobo, priceToCharge } from '@/lib/planDefaults';
import { PRICING_ENABLED, TRIAL_DAYS, TRIAL_PLAN, trialOfferEndsAt, trialOfferOpen, trialOfferLastDayLabel, daysUntilLaunch } from '@/lib/promo';
import { launchCampaignEmailHtml, launchCountdownEmailHtml, launchEmail2Subject, LAUNCH_EMAIL_1_SUBJECT, planExpiredHtml, paymentConfirmationHtml } from '@/lib/email';

describe('pricing switch and dollar prices', () => {
  it('pricing is off and a dollar price never becomes a naira charge', () => {
    expect(PRICING_ENABLED).toBe(false);
    expect(priceToKobo('$6')).toBeNull();
    expect(priceToKobo('₦9,999')).toBe(999900);
    expect(priceToKobo(null)).toBeNull();
  });
});

describe('subscription currency', () => {
  it('charges dollar prices in US cents and keeps naira working', () => {
    expect(priceToCharge('$6')).toEqual({ amount: 600, currency: 'USD' });
    expect(priceToCharge('$15')).toEqual({ amount: 1500, currency: 'USD' });
    expect(priceToCharge('$9.99')).toEqual({ amount: 999, currency: 'USD' });
    expect(priceToCharge('₦9,999')).toEqual({ amount: 999900, currency: 'NGN' });
    expect(priceToCharge(null)).toBeNull();
    expect(priceToCharge('free')).toBeNull();
  });
  it('shows the receipt amount in the charged currency', () => {
    process.env.NEXTAUTH_URL = 'https://runvax.com';
    const usd = paymentConfirmationHtml('Ada', 'pro', 600, '1 Dec 2026', 'https://runvax.com', 'Runvax', 'USD');
    expect(usd).toContain('$6');
    expect(usd).not.toContain('₦');
    expect(paymentConfirmationHtml('Ada', 'pro', 999900, '1 Dec 2026', 'https://runvax.com', 'Runvax', 'NGN')).toContain('NGN');
  });
});

describe('trial offer window', () => {
  afterEach(() => { delete process.env.NEXT_PUBLIC_TRIAL_OFFER_UNTIL; });
  it('is an 11-day Pro trial', () => {
    expect(TRIAL_DAYS).toBe(11);
    expect(TRIAL_PLAN).toBe('pro');
  });
  it('opens before the end and closes at it', () => {
    const end = trialOfferEndsAt();
    expect(trialOfferOpen(new Date(end.getTime() - 1))).toBe(true);
    expect(trialOfferOpen(end)).toBe(false);
  });
  it('can be overridden per environment, and ignores junk', () => {
    process.env.NEXT_PUBLIC_TRIAL_OFFER_UNTIL = '2026-12-01T00:00:00+01:00';
    expect(trialOfferEndsAt().toISOString()).toBe('2026-11-30T23:00:00.000Z');
    expect(trialOfferLastDayLabel()).toContain('30 November 2026');
    process.env.NEXT_PUBLIC_TRIAL_OFFER_UNTIL = 'not a date';
    expect(Number.isNaN(trialOfferEndsAt().getTime())).toBe(false);
  });
});

describe('launch emails', () => {
  // The campaign script pins this the same way, so a local value can't leak into the logo URL.
  process.env.NEXTAUTH_URL = 'https://runvax.com';
  const claim = 'Sunday, 1 November 2026';
  const e1 = launchCampaignEmailHtml('Ada Obi', 'https://runvax.com', 'Runvax', claim);
  const e2 = launchCountdownEmailHtml('Ada Obi', 'https://runvax.com', 'Runvax', claim, 11);

  it('email 1: 11 days, $0, verify warning, claim-by, unsubscribe, no stray 7s', () => {
    expect(e1).toContain('Hi <strong style="color:#1e293b;">Ada</strong>');
    expect(e1).toContain('11 days of RUNVAX Pro');
    expect(e1).toContain('$0');
    expect(e1).toContain('Try Pro free for 11 days');
    expect(e1).toContain('1 November 2026');
    expect(e1).toContain('unsubscribe');
    expect(e1).not.toMatch(/7 days|seven|7-day/i);
    expect(e1).not.toMatch(/localhost/);
    expect(LAUNCH_EMAIL_1_SUBJECT).toContain('11 Days');
  });
  it('email 2: countdown, story, 11 days everywhere', () => {
    expect(e2).toContain('>11<');
    expect(e2).toContain('days until Runvax officially launches');
    expect(e2).toContain('You need more clients.');
    expect(e2).toContain('Try Pro free for 11 days');
    expect(e2).not.toMatch(/7 days|seven|7-day|7 free/i);
    expect(e2).not.toMatch(/localhost/);
  });
  it('every button opens the claim page, not the home page', () => {
    for (const html of [e1, e2]) {
      const hrefs = Array.from(html.matchAll(/<a href="([^"]+)"[^>]*>[^<]*&rarr;/g)).map((m) => m[1]);
      expect(hrefs.length).toBeGreaterThan(0);
      expect(hrefs.every((h) => h === 'https://runvax.com/claim-pro')).toBe(true);
    }
  });
  it('countdown handles last day, launch day and after', () => {
    expect(launchCountdownEmailHtml('A', 'https://runvax.com', 'Runvax', claim, 1)).toContain('>day until');
    expect(launchCountdownEmailHtml('A', 'https://runvax.com', 'Runvax', claim, 0)).toContain('Runvax is live');
    expect(launchEmail2Subject(2)).toContain('2 days to launch');
    expect(launchEmail2Subject(1)).toContain('1 day to launch');
    expect(launchEmail2Subject(0)).toContain('is live');
  });
  it('counts days to launch by the Lagos calendar', () => {
    expect(daysUntilLaunch(new Date('2026-10-30T12:00:00+01:00'))).toBe(2);
    expect(daysUntilLaunch(new Date('2026-11-01T00:30:00+01:00'))).toBe(0);
    expect(daysUntilLaunch(new Date('2026-11-03T09:00:00+01:00'))).toBe(-2);
  });
  it('does not promise unlimited use, which Pro does not give', () => {
    expect((e1 + e2).toLowerCase()).not.toContain('unlimited');
  });
  it('expiry email has no dead renew link while pricing is off', () => {
    expect(planExpiredHtml('Ada', 'pro', 'https://runvax.com', 'Runvax')).not.toContain('/pricing');
  });
});
