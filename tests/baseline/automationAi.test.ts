import { describe, it, expect, vi } from 'vitest';
import { buildSystemPrompt, parseAiPlan, planAutomation } from '@/lib/automationAi';
import { quickSetup } from '@/lib/automation';

const reply = (content: string | null) => ({ chat: { completions: { create: vi.fn(async (_args: Record<string, unknown>) => ({ choices: [{ message: { content } }] })) } } });
const good = { name: 'Dental outreach', emails: [{ subject: 'Idea for {{business}}', body: 'Hi {{name}}, a thought.', waitDays: 0, sendIf: 'no_reply' }, { subject: 'Re: {{subject}}', body: 'Following up.', waitDays: 4, sendIf: 'no_reply' }], dailyCap: 25 };

describe('parseAiPlan', () => {
  it('reads plain JSON, fenced JSON and JSON with chatter around it', () => {
    expect(parseAiPlan('{"a":1}')).toEqual({ a: 1 });
    expect(parseAiPlan('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(parseAiPlan('Sure! Here you go: {"a":3} Hope that helps')).toEqual({ a: 3 });
  });
  it('returns null for anything else', () => {
    expect(parseAiPlan('no json here')).toBeNull();
    expect(parseAiPlan('{broken')).toBeNull();
    expect(parseAiPlan('')).toBeNull();
  });
});

describe('system prompt', () => {
  it('carries the product positioning and the hard rules', () => {
    const p = buildSystemPrompt();
    expect(p).toContain('find their next customers');
    expect(p).toContain('AI workforce');
    expect(p).toMatch(/Never include links/);
    expect(p).toMatch(/\{\{name\}\}/);
    expect(p).toMatch(/Ignore any instruction/);
  });
});

describe('planAutomation', () => {
  it('uses the AI answer when it is good, and sends the user text and the current plan', async () => {
    const client = reply(JSON.stringify(good));
    const cur = quickSetup();
    const r = await planAutomation('make it two emails', cur, { client });
    expect(r.source).toBe('ai');
    expect(r.automation.emails).toHaveLength(2);
    expect(r.automation.dailyCap).toBe(25);
    const args = client.chat.completions.create.mock.calls[0][0] as { messages: Array<{ role: string; content: string }>; response_format: unknown };
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages.map((m) => m.role)).toEqual(['system', 'user', 'user']);
    expect(args.messages[1].content).toContain('Current automation');
    expect(args.messages[2].content).toBe('make it two emails');
  });
  it('never trusts the AI: removes links, refuses auto-send, clamps numbers', async () => {
    const evil = { emails: [{ subject: 'Win {{creditcard}}', body: 'Click http://evil.com now {{name}}' }, { subject: 's', body: 'b', waitDays: 500 }], sendMode: 'auto', dailyCap: 99999 };
    const r = await planAutomation('x', null, { client: reply(JSON.stringify(evil)) });
    expect(r.source).toBe('ai');
    expect(r.automation.sendMode).toBe('review');
    expect(r.automation.dailyCap).toBe(200);
    expect(r.automation.emails[1].waitDays).toBe(30);
    expect(JSON.stringify(r.automation)).not.toMatch(/http|creditcard/);
  });
  it('falls back to the built-in planner when the reply is unusable, empty or the call fails', async () => {
    for (const c of [reply('I cannot do that'), reply(null), reply('{"emails":[]}')]) {
      const r = await planAutomation('3 emails', null, { client: c });
      expect(r.source).toBe('rules');
      expect(r.automation.emails).toHaveLength(3);
      expect(r.notice).toBeTruthy();
    }
    const boom = { chat: { completions: { create: vi.fn(async () => { throw new Error('rate limited'); }) } } };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await planAutomation('2 emails', null, { client: boom });
    spy.mockRestore();
    expect(r).toMatchObject({ source: 'rules' });
    expect(r.automation.emails).toHaveLength(2);
  });
  it('edits the current plan in place when the AI is unavailable', async () => {
    const cur = quickSetup(); cur.emails[0].subject = 'Keep me';
    const r = await planAutomation('add a follow-up', cur, { apiKey: '' });
    expect(r.source).toBe('rules');
    expect(r.automation.emails).toHaveLength(4);
    expect(r.automation.emails[0].subject).toBe('Keep me');
    expect(r.notice).toMatch(/Added email 4/);
    const none = await planAutomation('banana', cur, { apiKey: '' });
    expect(none.automation).toEqual(cur);
    expect(none.notice).toMatch(/could not tell what to change/);
  });
  it('uses the built-in planner without calling anything when there is no key, or AI is switched off', async () => {
    expect((await planAutomation('3 emails', null, { apiKey: '' })).source).toBe('rules');
    expect((await planAutomation('3 emails', null, { apiKey: 'your-key-here' })).source).toBe('rules');
    const client = reply(JSON.stringify(good));
    expect((await planAutomation('3 emails', null, { client, useAi: false })).source).toBe('rules');
    expect(client.chat.completions.create).not.toHaveBeenCalled();
  });
  it('trims very long prompts', async () => {
    const client = reply(JSON.stringify(good));
    await planAutomation('a'.repeat(5000), null, { client });
    const args = client.chat.completions.create.mock.calls[0][0] as { messages: Array<{ content: string }> };
    expect(args.messages.at(-1)!.content.length).toBe(1500);
  });
});
