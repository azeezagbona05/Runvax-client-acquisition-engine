import { describe, it, expect } from 'vitest';
import { parseBounce, looksLikeBounce } from '@/lib/bounces';
import { inSendWindow, autoFollowUpsOn, sanitizeAutomation, validTimezone } from '@/lib/automation';

const known = new Set(['ada@clinic.ng', 'bola@shop.ng']);

describe('bounce parsing', () => {
  it('spots likely bounces from the envelope', () => {
    expect(looksLikeBounce('MAILER-DAEMON@mx.google.com', 'x')).toBe(true);
    expect(looksLikeBounce('a@b.com', 'Undeliverable: hello')).toBe(true);
    expect(looksLikeBounce('ada@clinic.ng', 'Re: hello')).toBe(false);
  });
  it('reads a standard delivery-status report as a hard bounce', () => {
    const b = parseBounce({ from: 'mailer-daemon@x.com', subject: 'Delivery Status Notification (Failure)', text: 'failed', dsn: 'Final-Recipient: rfc822; ada@clinic.ng\nAction: failed\nStatus: 5.1.1\nDiagnostic-Code: smtp; 550 5.1.1 user unknown' }, known);
    expect(b?.hard).toBe(true);
    expect(b?.recipients).toEqual(['ada@clinic.ng']);
    expect(b?.reason).toContain('550');
  });
  it('treats a 4.x.x or delayed report as soft', () => {
    const b = parseBounce({ from: 'postmaster@x.com', subject: 'Delivery incomplete', text: '', dsn: 'Final-Recipient: rfc822; bola@shop.ng\nAction: delayed\nStatus: 4.2.2' }, known);
    expect(b?.hard).toBe(false);
  });
  it('reads a plain-text bounce, but only names our own contacts', () => {
    const b = parseBounce({ from: 'mailer-daemon@x.com', subject: 'Mail delivery failed', text: 'Message to bola@shop.ng failed: 550 no such user. Reported by stranger@elsewhere.com' }, known);
    expect(b?.hard).toBe(true);
    expect(b?.recipients).toEqual(['bola@shop.ng']);
  });
  it('ignores a bounce that names nobody we emailed, and non-bounces', () => {
    expect(parseBounce({ from: 'mailer-daemon@x.com', subject: 'Undeliverable', text: 'to nobody@else.com 550' }, known)).toBeNull();
    expect(parseBounce({ from: 'ada@clinic.ng', subject: 'Re: offer', text: 'ada@clinic.ng thanks' }, known)).toBeNull();
  });
  it('a full mailbox is soft', () => {
    expect(parseBounce({ from: 'mailer-daemon@x.com', subject: 'Undeliverable', text: 'ada@clinic.ng: mailbox is full, try again later' }, known)?.hard).toBe(false);
  });
});

describe('sending window', () => {
  // 2026-11-23 is a Monday. Lagos is UTC+1.
  const w = { windowStart: 9, windowEnd: 17, weekdaysOnly: true, timezone: 'Africa/Lagos' };
  it('is open in office hours Lagos time', () => expect(inSendWindow(w, Date.UTC(2026, 10, 23, 10))).toBe(true)); // 11:00 WAT
  it('is closed before the start and from the end hour', () => {
    expect(inSendWindow(w, Date.UTC(2026, 10, 23, 7))).toBe(false); // 08:00 WAT
    expect(inSendWindow(w, Date.UTC(2026, 10, 23, 16))).toBe(false); // 17:00 WAT
  });
  it('is closed at weekends when weekdays only, open when not', () => {
    expect(inSendWindow(w, Date.UTC(2026, 10, 22, 10))).toBe(false); // Sunday
    expect(inSendWindow({ ...w, weekdaysOnly: false }, Date.UTC(2026, 10, 22, 10))).toBe(true);
  });
  it('reads the hour in the chosen time zone', () => {
    expect(inSendWindow({ ...w, timezone: 'America/New_York' }, Date.UTC(2026, 10, 23, 10))).toBe(false); // 05:00 New York
  });
  it('falls back to Lagos for an unknown zone', () => {
    expect(validTimezone('Mars/Base')).toBeUndefined();
    expect(inSendWindow({ ...w, timezone: 'Mars/Base' }, Date.UTC(2026, 10, 23, 10))).toBe(true);
  });
});

describe('automatic follow-ups flag', () => {
  it('is read only from the stored JSON, and a plan can never carry it through sanitising', () => {
    expect(autoFollowUpsOn({ autoFollowUps: true })).toBe(true);
    expect(autoFollowUpsOn({ autoFollowUps: 'yes' })).toBe(false);
    expect(autoFollowUpsOn(null)).toBe(false);
    const a = sanitizeAutomation({ name: 'x', autoFollowUps: true, sendMode: 'auto', emails: [{ subject: 's', body: 'b' }] });
    expect(a && 'autoFollowUps' in a).toBe(false);
    expect(a?.sendMode).toBe('review');
  });
  it('keeps a valid time zone', () => {
    expect(sanitizeAutomation({ emails: [{ subject: 's', body: 'b' }], timezone: 'Africa/Accra' })?.timezone).toBe('Africa/Accra');
    expect(sanitizeAutomation({ emails: [{ subject: 's', body: 'b' }], timezone: 'nope' })?.timezone).toBeUndefined();
  });
});
