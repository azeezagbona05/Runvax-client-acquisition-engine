import { describe, expect, it } from 'vitest';
import {
  PURPOSES, bodyToHtml, cleanPath, cleanText, describeSegment, emptySegment, fillPlaceholders, firstName, planCampaign, sanitizeConfig, sanitizeStep, configProblems, MAX_STEPS, PLACEHOLDERS, SAMPLES, sampleById,
} from '@/lib/platformCampaignShared';

describe('cleanText', () => {
  it('removes links and unknown placeholders but keeps known ones', () => {
    expect(cleanText('Hi {{name}} see https://evil.example/x and www.bad.com {{secret}} {{ appName }}', 200)).toBe('Hi {{name}} see and {{appName}}');
  });
  it('caps length and ignores non-strings', () => { expect(cleanText('a'.repeat(500), 10)).toHaveLength(10); expect(cleanText(42, 10)).toBe(''); });
});

describe('cleanPath: the button can only point at a page on this app', () => {
  it('accepts plain app paths', () => { expect(cleanPath('/claim-pro')).toBe('/claim-pro'); expect(cleanPath('/client-acquisition/agents')).toBe('/client-acquisition/agents'); });
  it('rejects hosts, protocol-relative, queries, schemes and junk', () => {
    for (const bad of ['https://evil.com', '//evil.com', '/a?b=1', '/a#x', 'javascript:alert(1)', 'claim-pro', '/a//b', '', 5, null]) expect(cleanPath(bad)).toBe('');
  });
});

describe('sanitizeStep / sanitizeConfig', () => {
  it('a button needs both a label and a page, else it is dropped', () => {
    expect(sanitizeStep({ subject: 's', body: 'b', ctaPath: '/claim-pro', ctaLabel: '' })).toMatchObject({ ctaPath: '', ctaLabel: '' });
    expect(sanitizeStep({ subject: 's', body: 'b', ctaPath: '', ctaLabel: 'Go' })).toMatchObject({ ctaPath: '', ctaLabel: '' });
    expect(sanitizeStep({ subject: 's', body: 'b', ctaPath: '/claim-pro', ctaLabel: 'Go' })).toMatchObject({ ctaPath: '/claim-pro', ctaLabel: 'Go' });
  });
  it('clamps waits, forces email 1 to wait 0, drops empty emails, caps the count', () => {
    const steps = Array.from({ length: 9 }, (_, i) => ({ subject: `S${i}`, body: 'B', waitDays: 999 }));
    const c = sanitizeConfig({ steps: [{ subject: '', body: '' }, ...steps], dailyCap: 99999 });
    expect(c.steps).toHaveLength(MAX_STEPS); expect(c.steps[0].waitDays).toBe(0); expect(c.steps[1].waitDays).toBe(30); expect(c.dailyCap).toBe(500);
  });
  it('junk becomes a safe empty config that reports a problem', () => {
    const c = sanitizeConfig('nope'); expect(c.goal).toBe('none'); expect(c.stopOnGoal).toBe(true); expect(configProblems(c)).toHaveLength(1);
  });
  it('audience numbers: negatives and junk mean "any"', () => {
    const s = sanitizeConfig({ steps: [{ subject: 'a', body: 'b' }], segment: { joinedWithinDays: -3, inactiveForDays: 'abc', activeWithinDays: '14', plans: ['free', 'free', 'vip'] } }).segment;
    expect(s.joinedWithinDays).toBeNull(); expect(s.inactiveForDays).toBeNull(); expect(s.activeWithinDays).toBe(14); expect(s.plans).toEqual(['free']);
  });
});

describe('the built-in writer', () => {
  it.each(PURPOSES.map((p) => p.id))('%s: writes a valid, link-free, honest sequence', (purpose) => {
    const { name, config } = planCampaign(purpose, 'We launched AI agents. Visit https://spam.example now');
    expect(name.length).toBeGreaterThan(0);
    expect(configProblems(config)).toEqual([]);
    config.steps.forEach((s, i) => {
      expect(s.subject).toBeTruthy(); expect(s.body).toContain('{{name}}');
      expect(`${s.subject} ${s.body}`).not.toMatch(/https?:\/\/|www\./i);
      const used = Array.from(`${s.subject} ${s.body} ${s.ctaLabel}`.matchAll(/\{\{(\w+)\}\}/g)).map((m) => m[1]);
      for (const u of used) expect(PLACEHOLDERS as readonly string[]).toContain(u);
      if (i === 0) expect(s.waitDays).toBe(0);
    });
  });
  it('trial nudge targets unclaimed free accounts and points at the claim page', () => {
    const { config } = planCampaign('activate_trial', '');
    expect(config.goal).toBe('claim_trial'); expect(config.segment).toMatchObject({ plans: ['free'], trial: 'unclaimed', verified: 'yes' });
    expect(config.steps.every((s) => s.ctaPath === '/claim-pro')).toBe(true); expect(config.steps).toHaveLength(3);
  });
  it('feedback is one email with no button; verify targets unverified accounts', () => {
    expect(planCampaign('feedback', '').config.steps).toMatchObject([{ ctaPath: '' }]);
    expect(planCampaign('verify', '').config.segment.verified).toBe('no');
  });
  it('never invents numbers: no digits appear except the trial-length placeholder and the true "$0" of the free trial', () => {
    for (const p of PURPOSES) for (const s of planCampaign(p.id, '').config.steps) expect(`${s.subject} ${s.body}`.replace(/\{\{trialDays\}\}/g, '').replace(/\$0/g, '')).not.toMatch(/\d/);
  });
});

describe('rendering helpers', () => {
  it('bodyToHtml escapes everything the admin types', () => {
    const html = bodyToHtml('<script>alert(1)</script>\n\n- one <b>\n- two');
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;'); expect(html).toContain('<li'); expect(html).not.toContain('<b>');
  });
  it('fills placeholders and uses a first name only', () => {
    const v = { name: firstName('Ada Obi'), plan: 'Free', appName: 'RUNVAX', trialDays: 14 };
    expect(fillPlaceholders('Hi {{name}}, {{trialDays}} days of {{appName}} ({{plan}}) {{x}}', v)).toBe('Hi Ada, 14 days of RUNVAX (Free) ');
    expect(firstName(null)).toBe('there'); expect(firstName('  ')).toBe('there');
  });
  it('describes an audience in words', () => {
    expect(describeSegment(emptySegment())).toBe('all accounts');
    expect(describeSegment({ ...emptySegment(), plans: ['free'], verified: 'yes', inactiveForDays: 14 })).toBe('free accounts, verified, not active for 14+ days');
  });
});

describe('ready-made samples', () => {
  it('the RUNVAX 2.0 + AI agents sample is complete, link-free and uses only known placeholders', () => {
    const x = sampleById('v2_agents')!;
    expect(x).toBeTruthy(); expect(x.config.steps).toHaveLength(3); expect(configProblems(x.config)).toEqual([]);
    expect(x.config.steps.map((s) => s.waitDays)).toEqual([0, 3, 4]);
    expect(x.config.segment.verified).toBe('yes'); expect(x.config.goal).toBe('come_back');
    for (const s of x.config.steps) {
      const text = `${s.subject} ${s.body} ${s.ctaLabel}`;
      expect(text).not.toMatch(/https?:\/\/|www\./i);
      for (const m of Array.from(text.matchAll(/\{\{(\w+)\}\}/g))) expect(PLACEHOLDERS as readonly string[]).toContain(m[1]);
      expect(s.ctaPath).toMatch(/^\/client-acquisition/); expect(s.ctaLabel).toBeTruthy();
    }
  });
  it('every sample survives sanitising unchanged, and an unknown id gives nothing', () => {
    for (const x of SAMPLES) expect(sanitizeConfig(x.config)).toEqual(x.config);
    expect(sampleById('nope')).toBeNull();
  });
});
