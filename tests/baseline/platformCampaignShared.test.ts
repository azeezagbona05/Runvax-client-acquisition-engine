import { describe, expect, it } from 'vitest';
import { validateAutomation, SEND_IF_LABEL } from '@/lib/automation';
import { PURPOSES, SAMPLES, cleanText, describeSegment, emptySegment, firstName, planCampaign, planProblems, sampleById, sanitizePlan, sanitizeSegment } from '@/lib/platformCampaignShared';

const KNOWN = ['name', 'fullName', 'business', 'website', 'subject'];
const tokens = (t: string) => Array.from(t.matchAll(/\{\{(\w+)\}\}/g)).map((m) => m[1]);

describe('text and audience helpers', () => {
  it('cleanText removes links and caps length', () => {
    expect(cleanText('See https://evil.example/x and www.bad.com now', 100)).toBe('See and now');
    expect(cleanText('a'.repeat(500), 10)).toHaveLength(10); expect(cleanText(42, 10)).toBe('');
  });
  it('audience numbers: negatives and junk mean "any"; plans are de-duplicated and validated', () => {
    const s = sanitizeSegment({ joinedWithinDays: -3, inactiveForDays: 'abc', activeWithinDays: '14', plans: ['free', 'free', 'vip'], verified: 'maybe' });
    expect(s.joinedWithinDays).toBeNull(); expect(s.inactiveForDays).toBeNull(); expect(s.activeWithinDays).toBe(14); expect(s.plans).toEqual(['free']); expect(s.verified).toBe('any');
  });
  it('describes an audience in words; first names never expose an email', () => {
    expect(describeSegment(emptySegment())).toBe('all accounts');
    expect(describeSegment({ ...emptySegment(), plans: ['free'], verified: 'yes', inactiveForDays: 14 })).toBe('free accounts, verified, not active for 14+ days');
    expect(firstName('Ada Obi')).toBe('Ada'); expect(firstName(null)).toBe('there'); expect(firstName('  ')).toBe('there');
  });
});

describe('sanitizePlan runs on the engine sanitiser', () => {
  const base = { name: 'T', purpose: 'announce', goal: 'come_back', automation: { name: 'T', emails: [{ subject: 'Hi {{name}}', body: 'See https://evil.example and {{secret}} {{website}}' }] } };
  it('removes links and unknown placeholders, keeps {{website}}, and never grants auto-send', () => {
    const p = sanitizePlan({ ...base, automation: { ...base.automation, sendMode: 'auto' } })!;
    expect(p.automation.emails[0].body).not.toMatch(/https?:|secret/); expect(p.automation.emails[0].body).toContain('{{website}}'); expect(p.automation.sendMode).toBe('review');
  });
  it('junk gives null; an unknown goal, purpose or link page falls back safely', () => {
    expect(sanitizePlan('nope')).toBeNull(); expect(sanitizePlan({ ...base, automation: { emails: [] } })).toBeNull();
    const p = sanitizePlan({ ...base, goal: 'rule_the_world', purpose: 'x', linkPath: 'javascript:alert(1)' })!;
    expect(p.goal).toBe('none'); expect(p.purpose).toBe('custom'); expect(p.linkPath).toBe('/client-acquisition'); expect(p.stopOnGoal).toBe(true);
  });
  it('the link can only open a page on this app from the allowed list', () => {
    expect(sanitizePlan({ ...base, linkPath: '/claim-pro' })!.linkPath).toBe('/claim-pro');
    for (const bad of ['https://evil.com', '//evil.com', '/admin', '/api/x']) expect(sanitizePlan({ ...base, linkPath: bad })!.linkPath).toBe('/client-acquisition');
  });
});

describe('the three ready-made campaigns', () => {
  it('there are exactly the three requested: announcing 2.0, the client acquisition engine, and AI agents', () => {
    expect(SAMPLES.map((s) => s.id)).toEqual(['v2_announce', 'acquisition_engine', 'ai_agents']);
    expect(SAMPLES[0].plan.name).toMatch(/RUNVAX 2\.0/); expect(SAMPLES[1].plan.name).toMatch(/client acquisition engine in seconds/i); expect(SAMPLES[2].plan.name).toMatch(/AI agent/i);
    expect(sampleById('nope')).toBeNull();
  });
  it.each(SAMPLES.map((s) => [s.id, s]))('%s is a complete workflow: valid, link-free, known placeholders, a link in every email, follow-ups with waits', (_id, s) => {
    const a = s.plan.automation;
    expect(validateAutomation(a)).toEqual([]); expect(planProblems(s.plan)).toEqual([]);
    expect(a.emails).toHaveLength(3); expect(a.emails.map((e) => e.waitDays)).toEqual([0, 3, 4]);
    expect(a.emails[0].sendIf).toBe('no_reply'); expect(a.stopOnReply).toBe(true); expect(a.sendMode).toBe('review');
    expect(a.playbook?.length).toBeGreaterThan(0);                       // a reply playbook, like the front-end builder
    expect(a.emails[1].openedVariant).toBeTruthy();                       // a different follow-up for people who opened
    for (const e of a.emails) {
      const text = `${e.subject} ${e.body} ${e.openedVariant?.subject ?? ''} ${e.openedVariant?.body ?? ''}`;
      expect(text).not.toMatch(/https?:\/\/|www\./i);
      for (const t of tokens(text)) expect(KNOWN).toContain(t);
      expect(e.body).toContain('{{website}}');
    }
    expect(sanitizePlan(s.plan)!.automation.emails.map((e) => e.body)).toEqual(a.emails.map((e) => e.body)); // sanitising changes nothing
  });
  it('each opens the right page and targets verified users', () => {
    expect(sampleById('v2_announce')!.plan.linkPath).toBe('/client-acquisition');
    expect(sampleById('acquisition_engine')!.plan.linkPath).toBe('/client-acquisition/campaigns');
    expect(sampleById('ai_agents')!.plan.linkPath).toBe('/client-acquisition/agents');
    for (const s of SAMPLES) expect(s.plan.segment.verified).toBe('yes');
  });
  it('makes no timing claim it cannot back up: "in seconds", never a stated number of seconds', () => {
    const all = SAMPLES.map((s) => `${s.plan.name} ${s.plan.automation.emails.map((e) => `${e.subject} ${e.body}`).join(' ')}`).join(' ');
    expect(all).toMatch(/in seconds/); expect(all).not.toMatch(/\b\d+\s*seconds?\b/i);
  });
});

describe('the built-in writer', () => {
  it.each(PURPOSES.map((p) => p.id))('%s: writes a valid, link-free, honest sequence', (purpose) => {
    const p = planCampaign(purpose, 'We launched AI agents. Visit https://spam.example now', 14);
    expect(p.name.length).toBeGreaterThan(0); expect(planProblems(p)).toEqual([]);
    for (const e of p.automation.emails) {
      expect(`${e.subject} ${e.body}`).not.toMatch(/https?:\/\/|www\./i);
      for (const t of tokens(`${e.subject} ${e.body}`)) expect(KNOWN).toContain(t);
    }
    expect(p.automation.emails[0].waitDays).toBe(0); expect(SEND_IF_LABEL[p.automation.emails[0].sendIf]).toBeTruthy();
  });
  it('the trial nudge targets unclaimed free accounts, uses the live trial length, and points at the claim page', () => {
    const p = planCampaign('activate_trial', '', 14);
    expect(p.goal).toBe('claim_trial'); expect(p.segment).toMatchObject({ plans: ['free'], trial: 'unclaimed', verified: 'yes' }); expect(p.linkPath).toBe('/claim-pro');
    expect(p.automation.emails).toHaveLength(3); expect(p.automation.emails[0].subject).toContain('14');
  });
  it('verify targets unverified accounts and links to sign-in; feedback is one email asking for a reply', () => {
    expect(planCampaign('verify', '').segment.verified).toBe('no'); expect(planCampaign('verify', '').linkPath).toBe('/auth/signin');
    expect(planCampaign('feedback', '').automation.emails).toHaveLength(1);
  });
  it('never invents numbers: digits appear only from the trial length and the true "$0" of the free trial', () => {
    for (const p of PURPOSES) for (const e of planCampaign(p.id, '', 10).automation.emails) {
      const text = `${e.subject} ${e.body} ${e.openedVariant?.body ?? ''}`.replace(/\$0/g, '');
      if (p.id === 'activate_trial') expect(text.replace(/\b10\b/g, '')).not.toMatch(/\d/); else expect(text).not.toMatch(/\d/);
    }
  });
});
