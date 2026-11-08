import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanUrl, sanitizeHtml, slugify } from '@/lib/agents/html';
import { configIssues, nextRunFrom, sanitizeConfig, type AssistantConfig, type VisibilityConfig } from '@/lib/agents/kinds';
import { extractContact, ruleReply, scrubReply } from '@/lib/agents/chat';
import { corsOrigin, rssXml } from '@/lib/agents/publicFeed';
import { planAgent, writePost } from '@/lib/agents/write';
import { validKey, newPublicKey } from '@/lib/agents/store';

afterEach(() => vi.unstubAllEnvs());
const noAi = () => { for (const k of ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY']) vi.stubEnv(k, ''); };

describe('sanitizeHtml: content shown on other people\'s websites', () => {
  it('removes scripts, handlers, iframes and styles', () => {
    const out = sanitizeHtml('<p onclick="x()">Hi</p><script>alert(1)</script><iframe src="//e.com"></iframe><style>*{}</style><img src=x onerror=alert(1)>');
    expect(out).toBe('<p>Hi</p>');
  });
  it('keeps formatting tags and drops every attribute but a plain http(s) link', () => {
    expect(sanitizeHtml('<h2 class="a" style="x">T</h2><p><strong>b</strong> <a href="https://a.com/x?y=1&z=2" onclick="q">l</a></p>'))
      .toBe('<h2>T</h2><p><strong>b</strong> <a href="https://a.com/x?y=1&amp;z=2" rel="nofollow noopener" target="_blank">l</a></p>');
  });
  it('refuses javascript: and data: links', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeHtml('<a href=" JaVaScRiPt:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeHtml('<a href="data:text/html,<script>">x</a>')).not.toMatch(/href|<script|data:text/i);
  });
  it('escapes stray angle brackets and closes open tags', () => {
    expect(sanitizeHtml('1 < 2 and <b>bold')).toBe('1 &lt; 2 and bold');
    expect(sanitizeHtml('<p>one<ul><li>two')).toBe('<p>one<ul><li>two</li></ul></p>');
  });
});

describe('helpers', () => {
  it('slugifies and cleans URLs', () => {
    expect(slugify('Café: 5 Mistakes — Buyers Make!')).toBe('cafe-5-mistakes-buyers-make');
    expect(slugify('???')).toBe('post');
    expect(cleanUrl('example.com/a?b=1')).toBe('https://example.com');
    expect(cleanUrl('example.com/blog/', true)).toBe('https://example.com/blog');
    expect(cleanUrl('javascript:alert(1)')).toBe('');
    expect(cleanUrl('https://user:pw@example.com')).toBe('');
    expect(cleanUrl('localhost')).toBe('');
  });
  it('public keys are recognised', () => { const k = newPublicKey(); expect(validKey(k)).toBe(true); expect(validKey('rva_short')).toBe(false); expect(validKey(undefined)).toBe(false); });
});

describe('sanitizeConfig', () => {
  it('clamps and cleans a visibility config', () => {
    const c = sanitizeConfig('visibility', { business: { name: ' Acme ', url: 'acme.com/about', about: 'x'.repeat(5000) }, tone: 'rude', topics: ['a', 'a', 'b', ...Array.from({ length: 40 }, (_, i) => 't' + i)], cadence: 'hourly', postsPerRun: 99, approval: 'whatever', destinations: { webhookUrl: 'ftp://x', wordpress: { siteUrl: 'blog.acme.com', username: 'ann', status: 'publish' } }, allowedDomains: ['https://www.Acme.com/x', ''] }) as VisibilityConfig;
    expect(c.business).toMatchObject({ name: 'Acme', url: 'https://acme.com' }); expect(c.business.about.length).toBe(1200);
    expect(c.tone).toBe('professional'); expect(c.cadence).toBe('weekly'); expect(c.postsPerRun).toBe(3); expect(c.approval).toBe('review');
    expect(c.topics.length).toBe(20); expect(c.topics.slice(0, 2)).toEqual(['a', 'b']);
    expect(c.destinations.webhookUrl).toBe(''); expect(c.destinations.wordpress).toEqual({ siteUrl: 'https://blog.acme.com', username: 'ann', status: 'publish' });
    expect(c.allowedDomains).toEqual(['acme.com']);
  });
  it('reports what is missing before an agent can run', () => {
    expect(configIssues('visibility', sanitizeConfig('visibility', {}))).toEqual(['Add your business name.', 'Say what your business does, in a sentence or two.', 'Add at least one topic to write about.']);
    const ok = sanitizeConfig('visibility', { business: { name: 'A', about: 'We sell things.' }, topics: ['t'] });
    expect(configIssues('visibility', ok)).toEqual([]);
    const a = sanitizeConfig('assistant', { business: { name: 'A', about: 'We sell things.' }, channels: { web: false, telegram: false } });
    expect(configIssues('assistant', a)).toEqual(['Choose where the assistant works: website or Telegram.']);
  });
  it('schedules the next run from the cadence', () => {
    const c = sanitizeConfig('visibility', { cadence: 'biweekly' }); const d = new Date('2026-01-01T00:00:00Z');
    expect(nextRunFrom(c, d)?.toISOString()).toBe('2026-01-15T00:00:00.000Z');
    expect(nextRunFrom(sanitizeConfig('assistant', {}), d)).toBeNull();
  });
});

describe('assistant', () => {
  it('finds contact details by pattern', () => {
    expect(extractContact('call me on +234 803 123 4567 or mail Ada.O@Firm.co')).toEqual({ email: 'ada.o@firm.co', phone: '+234 803 123 4567' });
    expect(extractContact('we have 25 staff')).toEqual({});
  });
  it('strips every link but the booking link, and any HTML', () => {
    expect(scrubReply('Book at https://cal.com/acme or visit https://evil.com/x <b>now</b>', 'https://cal.com/acme')).toBe('Book at https://cal.com/acme or visit now');
    expect(scrubReply('see https://evil.com', '')).toBe('see');
  });
  const cfg = sanitizeConfig('assistant', { business: { name: 'Pay Co', about: 'Pay Co sells payroll software to small businesses in Nigeria.' }, knowledge: 'Payroll runs take under five minutes. Pension and tax are calculated automatically.', questions: ['How many staff do you have?', 'What do you use today?'], calendarUrl: 'https://cal.com/pay' }) as AssistantConfig;
  it('the no-AI reply answers from what the owner wrote, then asks a question', () => {
    const r = ruleReply(cfg, [{ r: 'v', t: 'hi', at: 0 }, { r: 'a', t: 'x', at: 0 }, { r: 'v', t: 'how fast is payroll', at: 0 }], 'how fast is payroll', {});
    expect(r).toContain('Payroll runs take under five minutes.'); expect(r).toMatch(/\?$/);
  });
  it('thanks a visitor who leaves details and never invents anything', () => {
    expect(ruleReply(cfg, [], 'ada@firm.co', { email: 'ada@firm.co' })).toContain('passed your details to the team');
  });
});

describe('public feed', () => {
  it('CORS: open without a list, the site\'s own origin with one, refusal otherwise', () => {
    expect(corsOrigin([], 'https://any.com')).toBe('*');
    expect(corsOrigin(['acme.com'], 'https://www.acme.com')).toBe('https://www.acme.com');
    expect(corsOrigin(['acme.com'], 'https://shop.acme.com')).toBe('https://shop.acme.com');
    expect(corsOrigin(['acme.com'], 'https://evilacme.com')).toBeNull();
    expect(corsOrigin(['acme.com'], null)).toBe('*');
  });
  it('RSS escapes titles and protects the CDATA body', () => {
    const xml = rssXml({ title: 'A & B', link: 'https://a.com', description: 'd', self: 'https://r/x', items: [{ title: '<x>', link: 'https://r/a', guid: '1', summary: 's', body: '<p>a]]>b</p>', date: new Date('2026-01-01T00:00:00Z') }] });
    expect(xml).toContain('<title>A &amp; B</title>'); expect(xml).toContain('<title>&lt;x&gt;</title>'); expect(xml).not.toContain(']]>b'); expect(xml).toContain('Thu, 01 Jan 2026');
  });
});

describe('built-in planner and writer (no AI key)', () => {
  it('plans a visibility agent from plain English', async () => {
    noAi();
    const p = await planAgent('visibility', 'We are a logistics company in Lagos. Publish two articles a week for importers about customs.', { site: null });
    expect(p.source).toBe('rules'); expect(p.config.business.about).toMatch(/logistics/); const v = p.config as VisibilityConfig;
    expect(v.topics.length).toBeGreaterThanOrEqual(6); expect(v.postsPerRun).toBe(2); expect(v.approval).toBe('review');
  });
  it('plans an assistant with qualifying questions', async () => {
    noAi();
    const p = await planAgent('assistant', 'We sell payroll software to SMEs. Qualify visitors and book a demo.', { site: null });
    const a = p.config as AssistantConfig; expect(a.goal).toBe('book'); expect(a.questions.length).toBeGreaterThanOrEqual(3); expect(p.name).toMatch(/Sales Assistant/);
  });
  it('the template article is clean HTML, labelled "rules", and carries no invented claims', async () => {
    noAi();
    const cfg = sanitizeConfig('visibility', { business: { name: 'Acme <b>Ltd</b>', about: 'We do logistics.' }, topics: ['Customs <script>x</script> costs'] }) as VisibilityConfig;
    const d = await writePost(cfg, cfg.topics[0]);
    expect(d.source).toBe('rules'); expect(d.body).not.toMatch(/<script|onerror/i); expect(d.body).toContain('Frequently asked questions'); expect(d.body).not.toMatch(/\d+%|guarantee|award/i);
  });
});

describe('the AI planner may not invent who the business is', () => {
  it('drops a company name and website the user never gave', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.resetModules();
    vi.doMock('@/lib/ai', () => ({ hasProvider: () => true, extractJson: (t: string) => JSON.parse(t), generate: async () => ({ text: JSON.stringify({ name: 'Lagos Logistics Co. Agent', business: { name: 'Lagos Logistics Co.', url: 'https://lagoslogisticsco.com', about: 'We move freight.' }, topics: ['Customs'], tone: 'friendly' }) }) }));
    const { planAgent: plan } = await import('@/lib/agents/write');
    const p = await plan('visibility', 'We are a logistics company in Lagos. Write about customs.', { site: null });
    expect(p.source).toBe('ai'); expect(p.config.business.name).toBe(''); expect(p.config.business.url).toBe('');
    const q = await plan('visibility', 'Our company is Acme Freight. Write about customs.', { site: null, url: 'acmefreight.com' });
    expect(q.config.business.url).toBe('https://acmefreight.com');
    vi.doUnmock('@/lib/ai'); vi.resetModules();
  });
});

import { classifyByRules, classifyRequest, UNSUPPORTED_MESSAGE } from '@/lib/agents/classify';
describe('what the user asks for decides the agent', () => {
  it('knows the two agents RUNVAX can build', () => {
    expect(classifyByRules('We are a logistics company. Publish two articles a week about customs for our website.')).toEqual({ kind: 'visibility' });
    expect(classifyByRules('Write blog posts to improve our SEO and AI search visibility')).toEqual({ kind: 'visibility' });
    expect(classifyByRules('A chatbot for my website that qualifies visitors and books a demo')).toEqual({ kind: 'assistant' });
    expect(classifyByRules('Answer questions about our consulting services on Telegram and capture leads')).toEqual({ kind: 'assistant' });
  });
  it('is not put off by what the business sells', () => {
    expect(classifyByRules('We sell payroll and accounting software to SMEs. Chat with visitors and qualify them.')).toEqual({ kind: 'assistant' });
  });
  it('points follow-up and outreach requests to campaigns', () => {
    expect(classifyByRules('Follow up with my leads by email until they reply')).toEqual({ kind: 'campaign' });
    expect(classifyByRules('Run a cold email sequence to dental clinics')).toEqual({ kind: 'campaign' });
  });
  it('says "not yet" for what it cannot build', () => {
    for (const t of ['A WhatsApp bot that answers customers', 'Post on Instagram and LinkedIn every day', 'Call my leads and book meetings with a voice agent', 'Scrape competitor prices daily', 'An agent that does my bookkeeping', 'Send SMS reminders to clients']) expect(classifyByRules(t), t).toEqual({ kind: 'unsupported' });
  });
  it('a hard "not yet" word beats an optimistic AI answer, and the AI can only say one of four things', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'k'); vi.resetModules();
    vi.doMock('@/lib/ai', () => ({ hasProvider: () => true, extractJson: (t: string) => JSON.parse(t), generate: async () => ({ text: JSON.stringify({ kind: 'assistant' }) }) }));
    const m = await import('@/lib/agents/classify');
    expect((await m.classifyRequest('A WhatsApp chatbot for my website visitors')).kind).toBe('unsupported');
    expect((await m.classifyRequest('A chatbot for my website visitors')).kind).toBe('assistant');
    vi.doMock('@/lib/ai', () => ({ hasProvider: () => true, extractJson: (t: string) => JSON.parse(t), generate: async () => ({ text: JSON.stringify({ kind: 'drop table' }) }) }));
    vi.resetModules(); const n = await import('@/lib/agents/classify');
    expect((await n.classifyRequest('A chatbot for my website visitors')).kind).toBe('unsupported');
    vi.doUnmock('@/lib/ai'); vi.resetModules();
  });
  it('uses the words fallback with no AI key, and the message is the one the owner asked for', async () => {
    noAi();
    expect((await classifyRequest('Publish weekly articles for our blog')).kind).toBe('visibility');
    expect(UNSUPPORTED_MESSAGE).toBe("RUNVAX doesn't have such capability yet. Check back in 24 hours.");
  });
});
