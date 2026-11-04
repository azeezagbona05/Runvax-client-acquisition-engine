import { describe, it, expect } from 'vitest';
import {
  buildEmail, needsFollowUp, parseLeadCsv, remainingToday, renderTemplate, sanitizeLeads, stageOf, statsOf,
  unknownTokens, validateCampaignFields, HARD_DAILY_MAX, type LeadRow,
} from '@/lib/outreachCampaign';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 28, 12);
const rule = { followUpAfterDays: 3, maxFollowUps: 1 };
const lead = (over: Partial<LeadRow> = {}): LeadRow => ({ status: 'sent', sentAt: new Date(NOW - 4 * DAY), lastSentAt: new Date(NOW - 4 * DAY), followUpsSent: 0, ...over });

describe('parseLeadCsv', () => {
  it('reads a header row in any order, with aliases', () => {
    const r = parseLeadCsv('Company,Email Address,Contact Name,Website\nBright Smile Dental,ada@brightsmile.com,Dr Ada Obi,brightsmile.com');
    expect(r.leads).toEqual([{ email: 'ada@brightsmile.com', name: 'Dr Ada Obi', business: 'Bright Smile Dental', website: 'brightsmile.com' }]);
  });
  it('joins first and last name columns', () => {
    expect(parseLeadCsv('email,first name,last name\nA@X.com,Ada,Obi').leads[0]).toMatchObject({ email: 'a@x.com', name: 'Ada Obi' });
  });
  it('accepts a bare list of addresses, one per line', () => {
    const r = parseLeadCsv('a@x.com\nb@y.org\r\nc@z.ng');
    expect(r.leads.map((l) => l.email)).toEqual(['a@x.com', 'b@y.org', 'c@z.ng']);
  });
  it('without a header, takes email wherever it is, then name and business', () => {
    expect(parseLeadCsv('Ada Obi,ada@x.com,Bright Smile').leads[0]).toEqual({ email: 'ada@x.com', name: 'Ada Obi', business: 'Bright Smile' });
  });
  it('handles quotes, commas and newlines inside quoted cells, and semicolons or tabs', () => {
    expect(parseLeadCsv('email,business\nx@y.com,"Smith, Jones & Co ""Law"""').leads[0].business).toBe('Smith, Jones & Co "Law"');
    expect(parseLeadCsv('email;name\nx@y.com;Ada').leads[0].name).toBe('Ada');
    expect(parseLeadCsv('email\tname\nx@y.com\tAda').leads[0].name).toBe('Ada');
  });
  it('rejects bad rows with a reason, and drops duplicates quietly', () => {
    const r = parseLeadCsv('email,name\nnot-an-email,Ada\n,Bob\nok@x.com,Cy\nOK@x.com ,Cy again');
    expect(r.leads).toHaveLength(1);
    expect(r.duplicates).toBe(1);
    expect(r.rejected.map((x) => [x.line, x.reason.includes('valid') || x.reason.includes('No email')])).toEqual([[2, true], [3, true]]);
  });
  it('strips a BOM and mailto:', () => {
    expect(parseLeadCsv('﻿email\nmailto:A@x.com').leads[0].email).toBe('a@x.com');
  });
  it('returns nothing for empty input', () => {
    expect(parseLeadCsv('  \n ')).toEqual({ leads: [], rejected: [], duplicates: 0 });
  });
});

describe('templates', () => {
  const l = { email: 'a@x.com', name: 'Dr. Ada Obi', business: 'Bright Smile' };
  it('fills the first name, business and website', () => {
    expect(renderTemplate('Hi {{name}} at {{ business }} ({{website}}) {{fullName}}', { ...l, website: 'b.com' })).toBe('Hi Ada at Bright Smile (b.com) Dr. Ada Obi');
  });
  it('falls back politely when details are missing', () => {
    expect(renderTemplate('Hi {{name}}, is {{business}} on {{website}}?', { email: 'a@x.com' })).toBe('Hi there, is your business on your website?');
  });
  it('leaves unknown placeholders visible and reports them', () => {
    expect(renderTemplate('Hi {{nme}}', l)).toBe('Hi {{nme}}');
    expect(unknownTokens('Hi {{name}} {{nme}} {{ }}')).toEqual(['nme', '(empty)']);
    expect(unknownTokens('Re: {{subject}}', ['subject'])).toEqual([]);
  });
});

describe('buildEmail', () => {
  const base = { subject: 'Hello {{business}}', body: 'Hi {{name}},\n<b>pitch</b> & more', lead: { email: 'a@x.com', name: 'Ada', business: 'R&D <Labs>' }, sender: { name: 'Sam', business: 'Webco' }, unsubscribeUrl: 'https://app.test/api/oc/unsubscribe?t=abc' };
  it('adds the unsubscribe link, one-click headers and signature', () => {
    const e = buildEmail({ ...base, pixelUrl: 'https://app.test/api/oc/open/abc' });
    expect(e.subject).toBe('Hello R&D <Labs>');
    expect(e.text).toContain('Unsubscribe: https://app.test/api/oc/unsubscribe?t=abc');
    expect(e.text).toContain('Sam | Webco');
    expect(e.headers['List-Unsubscribe']).toBe('<https://app.test/api/oc/unsubscribe?t=abc>');
    expect(e.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(e.html).toContain('href="https://app.test/api/oc/unsubscribe?t=abc"');
    expect(e.html).toContain('<img src="https://app.test/api/oc/open/abc"');
  });
  it('escapes HTML in the body and in lead details', () => {
    const e = buildEmail(base);
    expect(e.html).toContain('&lt;b&gt;pitch&lt;/b&gt; &amp; more');
    expect(e.html).not.toContain('<b>pitch</b>');
    expect(e.html).toContain('R&amp;D &lt;Labs&gt;');
    expect(e.html).not.toContain('<img');
  });
  it('keeps the subject on one line even if a lead field contains a newline', () => {
    expect(buildEmail({ ...base, lead: { email: 'a@x.com', business: 'Evil\r\nBcc: x@y.com' } }).subject).not.toMatch(/[\r\n]/);
  });
  it('fills {{subject}} for follow-ups', () => {
    expect(buildEmail({ ...base, subject: 'Re: {{subject}}', originalSubject: 'Hello Webco' }).subject).toBe('Re: Hello Webco');
  });
});

describe('dashboard numbers', () => {
  it('knows who needs a follow-up', () => {
    expect(needsFollowUp(lead(), rule, NOW)).toBe(true);
    expect(needsFollowUp(lead({ lastSentAt: new Date(NOW - 2 * DAY) }), rule, NOW)).toBe(false);
    expect(needsFollowUp(lead({ repliedAt: new Date(NOW) }), rule, NOW)).toBe(false);
    expect(needsFollowUp(lead({ unsubscribedAt: new Date(NOW) }), rule, NOW)).toBe(false);
    expect(needsFollowUp(lead({ followUpsSent: 1 }), rule, NOW)).toBe(false);
    expect(needsFollowUp(lead({ status: 'queued', sentAt: null, lastSentAt: null }), rule, NOW)).toBe(false);
    expect(needsFollowUp(lead({ followUpsSent: 1 }), { ...rule, maxFollowUps: 2 }, NOW)).toBe(true);
  });
  it('counts sent, opened, replied, queued, failed, unsubscribed', () => {
    const leads: LeadRow[] = [
      lead({ openedAt: new Date(NOW - DAY) }),                                   // sent, opened, due
      lead({ repliedAt: new Date(NOW), openedAt: new Date(NOW) }),               // replied
      lead({ lastSentAt: new Date(NOW - DAY) }),                                 // sent, not due
      lead({ status: 'unsubscribed', unsubscribedAt: new Date(NOW) }),           // sent then opted out
      lead({ status: 'queued', sentAt: null, lastSentAt: null }),
      lead({ status: 'sending', sentAt: null, lastSentAt: null }),
      lead({ status: 'failed', sentAt: null, lastSentAt: null }),
      lead({ status: 'skipped', sentAt: null, lastSentAt: null }),
    ];
    const s = statsOf(leads, rule, NOW);
    expect(s).toMatchObject({ total: 8, queued: 2, sent: 4, failed: 1, skipped: 1, unsubscribed: 1, opened: 2, replied: 1, needsFollowUp: 1 });
    expect(s.openRate).toBe(50);
    expect(s.replyRate).toBe(25);
  });
  it('has no divide-by-zero on an empty campaign', () => {
    expect(statsOf([], rule, NOW)).toMatchObject({ total: 0, openRate: 0, replyRate: 0 });
  });
  it('labels each lead with its most advanced state', () => {
    expect(stageOf(lead({ status: 'unsubscribed' }), rule, NOW)).toBe('unsubscribed');
    expect(stageOf(lead({ repliedAt: new Date(NOW) }), rule, NOW)).toBe('replied');
    expect(stageOf(lead(), rule, NOW)).toBe('needs_follow_up');
    expect(stageOf(lead({ lastSentAt: new Date(NOW - DAY), openedAt: new Date(NOW) }), rule, NOW)).toBe('opened');
    expect(stageOf(lead({ lastSentAt: new Date(NOW - DAY) }), rule, NOW)).toBe('sent');
    expect(stageOf(lead({ status: 'queued' }), rule, NOW)).toBe('queued');
  });
});

describe('daily limit', () => {
  it('is the smaller of the campaign cap and the account ceiling', () => {
    expect(remainingToday(30, 10, 10)).toBe(20);
    expect(remainingToday(500, 0, 0)).toBe(HARD_DAILY_MAX);
    expect(remainingToday(100, 0, HARD_DAILY_MAX - 5)).toBe(5);
    expect(remainingToday(30, 30, 30)).toBe(0);
    expect(remainingToday(30, 45, 45)).toBe(0);
  });
});

describe('validateCampaignFields', () => {
  const ok = { name: 'Dental Lagos', subject: 'Hi {{business}}', body: 'Hello {{name}}' };
  it('accepts a good campaign and trims it', () => {
    const r = validateCampaignFields({ ...ok, name: '  Dental Lagos ', dailyCap: 25, followUpAfterDays: 4, maxFollowUps: 2 });
    expect(r).toEqual({ ok: true, data: expect.objectContaining({ name: 'Dental Lagos', dailyCap: 25, followUpAfterDays: 4, maxFollowUps: 2 }) });
  });
  it('rejects empty and unknown-placeholder fields with a clear message', () => {
    expect(validateCampaignFields({ ...ok, name: ' ' })).toMatchObject({ ok: false });
    expect(validateCampaignFields({ ...ok, body: 'Hi {{favourite}}' })).toMatchObject({ ok: false, error: expect.stringContaining('{{favourite}}') });
    expect(validateCampaignFields({ ...ok, subject: 'Re: {{subject}}' })).toMatchObject({ ok: false });
  });
  it('allows {{subject}} only in follow-ups', () => {
    expect(validateCampaignFields({ ...ok, followUpSubject: 'Re: {{subject}}' }).ok).toBe(true);
  });
  it('bounds the numbers', () => {
    expect(validateCampaignFields({ ...ok, dailyCap: 0 }).ok).toBe(false);
    expect(validateCampaignFields({ ...ok, dailyCap: HARD_DAILY_MAX + 1 }).ok).toBe(false);
    expect(validateCampaignFields({ ...ok, maxFollowUps: 5 }).ok).toBe(false);
    expect(validateCampaignFields({ ...ok, maxFollowUps: 4 }).ok).toBe(true);
    expect(validateCampaignFields({ ...ok, followUpAfterDays: 0 }).ok).toBe(false);
  });
  it('checks only the fields present when partial', () => {
    expect(validateCampaignFields({ dailyCap: 10 }, true)).toEqual({ ok: true, data: { dailyCap: 10 } });
    expect(validateCampaignFields({}, true)).toEqual({ ok: true, data: {} });
  });
});

describe('sanitizeLeads', () => {
  it('cleans, dedupes and counts bad rows', () => {
    const r = sanitizeLeads([{ email: ' A@X.com ', name: ' Ada\n Obi ' }, { email: 'a@x.com' }, { email: 'nope' }, null, { name: 'no email' }]);
    expect(r.leads).toEqual([{ email: 'a@x.com', name: 'Ada Obi' }]);
    expect(r.invalid).toBe(3);
  });
  it('ignores non-arrays', () => {
    expect(sanitizeLeads('x')).toEqual({ leads: [], invalid: 0 });
  });
});

import { canonTokens } from '@/lib/outreachCampaign';
describe('friendly placeholders', () => {
  it('treats {{First Name}} and {{Clinic Name}} as {{name}} and {{business}}', () => {
    expect(canonTokens('Hello {{First Name}}, about {{ Clinic Name }} at {{company_name}}')).toBe('Hello {{name}}, about {{business}} at {{business}}');
    expect(canonTokens('{{subject}} {{mystery}}')).toBe('{{subject}} {{mystery}}');
  });
  it('does not flag them as unknown, still flags real unknowns, and fills them', () => {
    expect(unknownTokens('Hi {{First Name}} {{Clinic Name}} {{Practice Name}}')).toEqual([]);
    expect(unknownTokens('Hi {{First Name}} {{favourite colour}}')).toEqual(['favourite colour']);
    expect(renderTemplate('Hello {{First Name}} from {{Clinic Name}}', { email: 'a@x.com', name: 'Dr. Ada Obi', business: 'Bright Smile' })).toBe('Hello Ada from Bright Smile');
  });
  it('saves campaign wording with the canonical placeholders', () => {
    const r = validateCampaignFields({ name: 'n', subject: 'Hi {{Clinic Name}}', body: 'Hello {{First Name}}', followUpBody: 'Again {{First Name}}' });
    expect(r).toMatchObject({ ok: true, data: { subject: 'Hi {{business}}', body: 'Hello {{name}}', followUpBody: 'Again {{name}}' } });
  });
});
