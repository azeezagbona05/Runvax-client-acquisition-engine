import { describe, expect, it } from 'vitest';
import { chunkText, extractLinks, htmlToText, parseCsv, qaPieces, tablePieces } from '@/lib/knowledge/text';
import { rankChunks, tokens } from '@/lib/knowledge/retrieve';
import { parseRobots, robotsAllows } from '@/lib/knowledge/crawl';
import { sanitizeConfig, type AssistantConfig } from '@/lib/agents/kinds';
import { ruleReply } from '@/lib/agents/chat';

describe('reading a web page', () => {
  const html = `<html><head><title>Acme &amp; Sons | Home</title><script>var secret=1</script><style>.x{}</style></head><body><nav><a href="/menu">Menu</a></nav><header>Top bar</header>
    <h1>We fix roofs</h1><p>Our team repairs roofs in Lagos&nbsp;within 48 hours.</p><ul><li>Free quote</li><li>Two year warranty</li></ul><form><input value="hidden"></form><footer>Copyright junk</footer>
    <a href="/about#team">About</a><a href="https://other.com/x">Other</a><a href="mailto:a@b.co">Mail</a></body></html>`;
  it('keeps the words people read and drops scripts, menus, forms and footers', () => {
    const r = htmlToText(html);
    expect(r.title).toBe('Acme & Sons | Home');
    expect(r.text).toContain('We fix roofs'); expect(r.text).toContain('Our team repairs roofs in Lagos within 48 hours.'); expect(r.text).toContain('• Free quote');
    for (const bad of ['secret', 'Top bar', 'Menu', 'Copyright junk', 'hidden', '.x{}']) expect(r.text).not.toContain(bad);
  });
  it('finds absolute web links only, without fragments', () => {
    expect(extractLinks(html, 'https://acme.com/')).toEqual(['https://acme.com/menu', 'https://acme.com/about', 'https://other.com/x']);
  });
});

describe('robots.txt', () => {
  const txt = 'User-agent: *\nDisallow: /private\nDisallow: /admin # comment\nUser-agent: badbot\nDisallow: /\n';
  it('applies the rules for everyone and ignores another bot\'s', () => {
    const d = parseRobots(txt);
    expect(d).toEqual(['/private', '/admin']); expect(robotsAllows('/about', d)).toBe(true); expect(robotsAllows('/private/x', d)).toBe(false);
  });
  it('honours a rule written for us, and a total ban', () => {
    expect(robotsAllows('/a', parseRobots('User-agent: RunvaxKnowledgeBot\nDisallow: /'))).toBe(false);
    expect(robotsAllows('/a', parseRobots('User-agent: *\nDisallow:'))).toBe(true);
  });
});

describe('chunking', () => {
  it('splits long text into pieces that stay near the target size and do not lose words', () => {
    const para = (n: number) => Array.from({ length: 30 }, (_, i) => `Sentence ${n}-${i} about payroll and pension rules.`).join(' ');
    const text = [para(1), para(2), para(3)].join('\n\n'); const chunks = chunkText(text, 900, 120);
    expect(chunks.length).toBeGreaterThan(3); for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1100);
    for (const probe of ['Sentence 1-0', 'Sentence 2-15', 'Sentence 3-29']) expect(chunks.some((c) => c.includes(probe))).toBe(true);
  });
  it('keeps a short text as one piece and ignores empty input', () => { expect(chunkText('One short paragraph.')).toEqual(['One short paragraph.']); expect(chunkText('  \n\n ')).toEqual([]); });
});

describe('CSV', () => {
  it('parses quotes, doubled quotes, line breaks in cells, CRLF, a BOM and semicolons', () => {
    expect(parseCsv('﻿name,price\r\n"Basic, plan",100\r\n"Say ""hi""","two\nlines"\r\n')).toEqual([['name', 'price'], ['Basic, plan', '100'], ['Say "hi"', 'two lines']]);
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('a table keeps the column names with every row', () => {
    const p = tablePieces(parseCsv('Plan,Price,Seats\nBasic,₦5000,5\nPro,₦15000,25'));
    expect(p.length).toBe(1); expect(p[0].text).toBe('Plan: Basic; Price: ₦5000; Seats: 5\nPlan: Pro; Price: ₦15000; Seats: 25');
    expect(tablePieces([['only', 'header']])).toEqual([]);
  });
  it('Q&A pairs become one piece each, with or without a header row', () => {
    expect(qaPieces(parseCsv('Question,Answer\nWhat are your hours?,9 to 5\nDo you deliver?,Yes')).map((p) => p.text)).toEqual(['Q: What are your hours?\nA: 9 to 5', 'Q: Do you deliver?\nA: Yes']);
    expect(qaPieces(parseCsv('Where are you?,Lagos')).map((p) => p.text)).toEqual(['Q: Where are you?\nA: Lagos']);
    expect(qaPieces(parseCsv('Question,Answer\nEmpty answer,'))).toEqual([]);
  });
});

describe('finding the right piece', () => {
  const chunks = [
    { label: 'faq', text: 'Q: What are your opening hours?\nA: We are open 9am to 5pm, Monday to Friday.' },
    { label: 'pricing', text: 'The Basic plan costs 5000 naira a month and includes five staff.' },
    { label: 'about', text: 'Brightpay was founded in Lagos to make payroll simple for small businesses.' },
  ];
  it('ranks by the words the visitor used and returns nothing for unrelated questions', () => {
    expect(rankChunks('how much does the basic plan cost', chunks, 2)[0].item.label).toBe('pricing');
    expect(rankChunks('what time do you open', chunks, 1)[0].item.label).toBe('faq');
    expect(rankChunks('who is the president of france', chunks)).toEqual([]);
    expect(rankChunks('', chunks)).toEqual([]);
  });
  it('treats plurals alike and ignores filler words', () => { expect(tokens('The plans and the staffs')).toEqual(['plan', 'staff']); });
  it('the no-AI reply answers from the knowledge excerpts', () => {
    const cfg = sanitizeConfig('assistant', { business: { name: 'Brightpay', about: 'We sell payroll software.' } }) as AssistantConfig;
    const r = ruleReply(cfg, [{ r: 'v', t: 'hi', at: 0 }, { r: 'a', t: 'x', at: 0 }, { r: 'v', t: 'what are your opening hours', at: 0 }], 'what are your opening hours', {}, ['[faq] Q: What are your opening hours?\nA: We are open 9am to 5pm, Monday to Friday.']);
    expect(r).toContain('We are open 9am to 5pm');
  });
});

describe('knowledge ids in the assistant settings', () => {
  it('keeps only well-formed, unique ids, at most 20', () => {
    const ok = 'cmw7jueoe0003t0ppgg45wv2w';
    const c = sanitizeConfig('assistant', { knowledgeIds: [ok, ok, 'nope', 5, '<script>', ...Array.from({ length: 30 }, (_, i) => 'a'.repeat(24) + String(i).padStart(2, '0'))] }) as AssistantConfig;
    expect(c.knowledgeIds[0]).toBe(ok); expect(c.knowledgeIds.length).toBe(20); expect(c.knowledgeIds).not.toContain('nope');
    expect((sanitizeConfig('assistant', {}) as AssistantConfig).knowledgeIds).toEqual([]);
  });
});
