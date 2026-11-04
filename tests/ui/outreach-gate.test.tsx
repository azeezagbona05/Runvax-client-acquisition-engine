// @vitest-environment jsdom
/**
 * Browser-opened wa.me / mailto: links must not bypass the acquisition rules.
 * Synthetic data only; window.open, fetch and alert are stubbed, so nothing is
 * opened or sent.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import type { SavedProspect, FollowUpStep } from '@/types';

const ctx = vi.hoisted(() => ({
  prospects: [] as SavedProspect[],
  markOutreachSent: vi.fn(), updateStage: vi.fn(), incrementToday: vi.fn(), remove: vi.fn(),
  generateSequence: vi.fn(), updateSequenceStep: vi.fn(), save: vi.fn(),
}));
vi.mock('@/context/ProspectsContext', () => ({
  useProspects: () => ({
    ...ctx,
    get: (id: string) => ctx.prospects.find((p) => p.business.id === id),
    isSaved: (id: string) => ctx.prospects.some((p) => p.business.id === id),
  }),
}));

import { checkOutreach, followOutreach, openOutreach, openOutreachBatch, reportBlocked, isAcquisitionManaged, ACQUISITION_NOTICE } from '@/lib/outreachGate';
import OutreachLink from '@/components/OutreachLink';
import ProspectTable from '@/components/ProspectTable';
import BulkOutreachModal from '@/components/BulkOutreachModal';
import FollowUpSequenceModal from '@/components/FollowUpSequenceModal';
import QuickFireModal from '@/components/QuickFireModal';
import BusinessTable from '@/components/BusinessTable';
import { sendWhatsAppBulk, summarizeBulk } from '@/lib/bulkSend';

const biz = (id: string, over: Record<string, unknown> = {}) => ({ id, name: `Clinic ${id}`, address: 'Lagos', phone: '0803 123 4567', phoneIntl: '+2348031234567', email: `${id}@clinic.example`, hasWebsite: false, category: 'dentist', ...over });
const prospect = (id: string, source?: SavedProspect['source'] | null, over: Record<string, unknown> = {}): SavedProspect => ({
  business: biz(id) as SavedProspect['business'], stage: 'found', savedAt: new Date().toISOString(), notes: '', score: 50, conversations: [],
  ...(source === undefined ? {} : { source: source as SavedProspect['source'] }), ...over,
});

type Win = { location: { href: string }; opener: unknown; close: ReturnType<typeof vi.fn> };
let wins: Win[];
let openSpy: ReturnType<typeof vi.fn>;
let alertSpy: ReturnType<typeof vi.fn>;
let fetchSpy: ReturnType<typeof vi.fn>;
/** What the (stubbed) server answers for each target, in order. */
let verdict: (t: { businessId?: string; email?: string; phone?: string }) => unknown;

beforeEach(() => {
  wins = [];
  openSpy = vi.fn(() => { const w: Win = { location: { href: '' }, opener: 'x', close: vi.fn() }; wins.push(w); return w; });
  alertSpy = vi.fn();
  vi.stubGlobal('open', openSpy);
  window.open = openSpy as unknown as typeof window.open;
  window.alert = alertSpy as unknown as typeof window.alert;
  verdict = () => ({ allowed: true });
  fetchSpy = vi.fn(async (_u: string, init: RequestInit) => {
    const { targets } = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ results: targets.map((t: never) => verdict(t)) }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchSpy);
  ctx.prospects = [];
  for (const k of ['markOutreachSent', 'updateStage', 'incrementToday', 'remove', 'generateSequence', 'updateSequenceStep', 'save'] as const) ctx[k].mockReset().mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const BLOCK = { allowed: false, code: 'acquisition_managed', message: 'managed by Industry Acquisition' };
const hrefs = () => wins.map((w) => w.location.href);
const externalAnchors = () => Array.from(document.querySelectorAll('a')).filter((a) => /^(https?:\/\/wa\.me|mailto:|whatsapp:)/i.test(a.getAttribute('href') ?? ''));

describe('gate helpers', () => {
  it('isAcquisitionManaged: only the engine source; null, missing, manual and auto-prospect are ordinary', () => {
    expect(isAcquisitionManaged({ source: 'industry-acquisition' })).toBe(true);
    for (const s of [undefined, null, 'manual', 'auto-prospect']) expect(isAcquisitionManaged({ source: s })).toBe(false);
    expect(isAcquisitionManaged(undefined)).toBe(false);
  });

  it('opens the tab synchronously, then navigates it only after the server allows', async () => {
    const p = openOutreach('https://wa.me/2348031234567', { businessId: 'a' });
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(hrefs()).toEqual(['']); // nothing loaded yet
    expect(await p).toEqual({ ok: true });
    expect(hrefs()).toEqual(['https://wa.me/2348031234567']);
    expect(wins[0].opener).toBeNull();
  });

  it('a refused target closes the tab and never loads the link', async () => {
    verdict = () => BLOCK;
    const r = await openOutreach('https://wa.me/2348031234567', { businessId: 'a' });
    expect(r).toMatchObject({ ok: false, message: BLOCK.message });
    expect(wins[0].close).toHaveBeenCalled();
    expect(hrefs()).toEqual(['']);
  });

  it('fails closed: network error, HTTP error, malformed or short answers all refuse', async () => {
    for (const bad of [
      () => Promise.reject(new Error('offline')),
      () => Promise.resolve(new Response('{}', { status: 500 })),
      () => Promise.resolve(new Response('not json', { status: 200 })),
      () => Promise.resolve(new Response(JSON.stringify({ results: [] }), { status: 200 })),
    ]) {
      fetchSpy.mockImplementationOnce(bad as never);
      const r = await openOutreach('mailto:a@b.example', { email: 'a@b.example' });
      expect(r.ok).toBe(false);
    }
    expect(hrefs().filter(Boolean)).toEqual([]);
  });

  it('batch: opens only the allowed ones and reports the refused by index; one request', async () => {
    verdict = (t) => (t.businessId === 'acq' ? BLOCK : { allowed: true });
    const r = await openOutreachBatch([
      { url: 'https://wa.me/1', target: { businessId: 'ok1' } },
      { url: 'https://wa.me/2', target: { businessId: 'acq' } },
      { url: 'https://wa.me/3', target: { businessId: 'ok2' } },
    ]);
    expect(r.opened).toEqual([0, 2]);
    expect(r.blocked).toEqual([{ index: 1, message: BLOCK.message }]);
    expect(hrefs()).toEqual(['https://wa.me/1', '', 'https://wa.me/3']);
    expect(wins[1].close).toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('chunks to the route’s 100-target limit', async () => {
    const res = await checkOutreach(Array.from({ length: 230 }, (_, i) => ({ businessId: `b${i}` })));
    expect(res).toHaveLength(230);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('a blocked pop-up is reported, not silently ignored', async () => {
    window.open = vi.fn(() => null) as unknown as typeof window.open;
    expect(await openOutreach('https://wa.me/1', { businessId: 'a' })).toMatchObject({ ok: false, message: expect.stringMatching(/pop-ups/) });
  });

  it('reportBlocked: single message, combined message, nothing when empty', () => {
    reportBlocked([]);
    expect(alertSpy).not.toHaveBeenCalled();
    reportBlocked([{ message: 'one' }]);
    expect(alertSpy).toHaveBeenLastCalledWith('one');
    reportBlocked([{ message: 'a' }, { message: 'a' }, { message: 'b' }]);
    expect(alertSpy.mock.calls[1][0]).toMatch(/^3 contacts were not opened/);
  });
});

describe('OutreachLink', () => {
  it('managed: a disabled control with the explanation, and no link, no click action', () => {
    const onOpened = vi.fn();
    render(<OutreachLink url="https://wa.me/1" target={{ businessId: 'a' }} managed onOpened={onOpened}>WhatsApp</OutreachLink>);
    const el = screen.getByText('WhatsApp').closest('[data-outreach]')!;
    expect(el.getAttribute('data-outreach')).toBe('blocked');
    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.getAttribute('title')).toBe(ACQUISITION_NOTICE);
    expect(el.textContent).toContain(ACQUISITION_NOTICE);
    expect(el.tagName).not.toBe('A');
    expect(externalAnchors()).toHaveLength(0);
    fireEvent.click(el);
    expect(openSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onOpened).not.toHaveBeenCalled();
  });

  it('ordinary: carries no external href; click asks the server, then opens and calls onOpened', async () => {
    const onOpened = vi.fn();
    render(<OutreachLink url="https://wa.me/2348031234567" target={{ businessId: 'a', phone: '0803' }} onOpened={onOpened}>WhatsApp</OutreachLink>);
    expect(externalAnchors()).toHaveLength(0);
    fireEvent.click(screen.getByText('WhatsApp'));
    await waitFor(() => expect(onOpened).toHaveBeenCalled());
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1].body))).toEqual({ targets: [{ businessId: 'a', phone: '0803' }] });
    expect(hrefs()).toEqual(['https://wa.me/2348031234567']);
  });

  it('stale page: rendered as ordinary, but the server says managed or suppressed → refused, alerted, onOpened not called', async () => {
    const onOpened = vi.fn();
    for (const v of [BLOCK, { allowed: false, code: 'suppressed', message: 'opted out or been suppressed' }]) {
      verdict = () => v;
      render(<OutreachLink url="mailto:a@b.example" target={{ businessId: 'a' }} onOpened={onOpened}>Email</OutreachLink>);
      fireEvent.click(screen.getByText('Email'));
      await waitFor(() => expect(alertSpy).toHaveBeenLastCalledWith(v.message));
      cleanup();
    }
    expect(onOpened).not.toHaveBeenCalled();
    expect(hrefs().filter(Boolean)).toEqual([]);
  });

  it('no url (no phone/email): renders plain text, not an action', () => {
    render(<OutreachLink url={null} target={{}}>Nothing</OutreachLink>);
    expect(document.querySelector('[data-outreach]')).toBeNull();
  });
});

describe('ProspectTable (Pipeline)', () => {
  const renderTable = (ps: SavedProspect[]) => {
    ctx.prospects = ps;
    return render(<ProspectTable prospects={ps} onOpen={vi.fn()} onOpenSequence={vi.fn()} selectMode={false} selectedIds={new Set()} onToggleSelect={vi.fn()} />);
  };

  it('an acquisition row has no live outreach action; ordinary, null-source and manual rows keep theirs', () => {
    renderTable([prospect('acq', 'industry-acquisition'), prospect('ord', null), prospect('nosrc'), prospect('man', 'manual')]);
    expect(externalAnchors()).toHaveLength(0);
    const rows = Array.from(document.querySelectorAll('tbody tr'));
    const byName = (n: string) => rows.find((r) => r.textContent?.includes(n))!;
    expect(byName('Clinic acq').querySelector('[data-outreach="guarded"]')).toBeNull();
    expect(byName('Clinic acq').querySelector('[data-outreach="blocked"]')).not.toBeNull();
    for (const n of ['Clinic ord', 'Clinic nosrc', 'Clinic man']) {
      expect(byName(n).querySelector('[data-outreach="guarded"]'), n).not.toBeNull();
      expect(byName(n).querySelector('[data-outreach="blocked"]'), n).toBeNull();
    }
  });

  it('an ordinary row’s WhatsApp action goes through the server check before opening', async () => {
    renderTable([prospect('ord', null)]);
    fireEvent.click(document.querySelector('[data-outreach="guarded"]')!);
    await waitFor(() => expect(hrefs().some((h) => h.includes('wa.me'))).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith('/api/outreach/check', expect.anything());
  });

  it('stale row (source missing in old UI state) is refused by the server at click time', async () => {
    verdict = () => BLOCK;
    renderTable([prospect('stale', null)]);
    fireEvent.click(document.querySelector('[data-outreach="guarded"]')!);
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(hrefs().filter(Boolean)).toEqual([]);
  });
});

describe('BulkOutreachModal', () => {
  it('excludes acquisition prospects and says so; never builds links for them', async () => {
    const ps = [prospect('acq', 'industry-acquisition'), prospect('ord', null), prospect('man', 'manual')];
    ctx.prospects = ps;
    render(<BulkOutreachModal prospects={ps} onClose={vi.fn()} />);
    expect(document.body.textContent).toMatch(/Industry Acquisition/);
    expect(document.body.textContent).not.toContain('Clinic acq: ');
    expect(externalAnchors()).toHaveLength(0);
    const open = screen.queryAllByRole('button').find((b) => /open all/i.test(b.textContent ?? ''));
    if (open) {
      fireEvent.click(open);
      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
      const sent = JSON.parse(String(fetchSpy.mock.calls[0][1].body)).targets.map((t: { businessId: string }) => t.businessId);
      expect(sent).not.toContain('acq');
      expect(sent).toEqual(expect.arrayContaining(['ord', 'man']));
    }
  });

  it('a prospect that is acquisition-managed only on the server (stale page) is refused and reported, others still open', async () => {
    verdict = (t) => (t.businessId === 'stale' ? BLOCK : { allowed: true });
    const ps = [prospect('stale', null), prospect('ord', null)];
    ctx.prospects = ps;
    render(<BulkOutreachModal prospects={ps} onClose={vi.fn()} />);
    const open = screen.getAllByRole('button').find((b) => /open all/i.test(b.textContent ?? ''));
    expect(open, 'bulk modal has an Open all action').toBeTruthy();
    fireEvent.click(open!);
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(hrefs().filter(Boolean).length).toBe(1);
    expect(hrefs().filter(Boolean)[0]).toContain('wa.me');
  });
});

describe('FollowUpSequenceModal', () => {
  const step = (channel: 'whatsapp' | 'email'): FollowUpStep => ({ id: `s_${channel}`, day: 0, channel, label: 'First', message: 'Hello', dueDate: new Date(Date.now() - 864e5).toISOString(), status: 'pending' });

  it('an acquisition prospect: no wa.me or mailto action is live, send is disabled, explanation shown', () => {
    const p = prospect('acq', 'industry-acquisition', { followUpSequence: [step('whatsapp'), step('email')] });
    ctx.prospects = [p];
    render(<FollowUpSequenceModal prospect={p} onClose={vi.fn()} />);
    expect(externalAnchors()).toHaveLength(0);
    expect(document.querySelector('[data-outreach="guarded"]')).toBeNull();
    expect(document.body.textContent).toContain('Industry Acquisition');
    for (const b of screen.getAllByRole('button')) if (/^\s*send/i.test(b.textContent ?? '')) expect((b as HTMLButtonElement).disabled).toBe(true);
  });

  it('an ordinary prospect keeps working through the server check', async () => {
    const p = prospect('ord', null, { followUpSequence: [step('whatsapp')] });
    ctx.prospects = [p];
    render(<FollowUpSequenceModal prospect={p} onClose={vi.fn()} />);
    expect(document.querySelector('[data-outreach="blocked"]')).toBeNull();
    expect(externalAnchors()).toHaveLength(0);
  });
});

describe('QuickFireModal', () => {
  it('a saved acquisition prospect gets no live WhatsApp/email action', () => {
    ctx.prospects = [prospect('acq', 'industry-acquisition')];
    render(<QuickFireModal businesses={[biz('acq') as never]} onClose={vi.fn()} />);
    expect(document.body.textContent).toContain(ACQUISITION_NOTICE); // visible text, not only a tooltip (touch screens have none)
    expect(externalAnchors()).toHaveLength(0);
    expect(document.querySelector('[data-outreach="guarded"]')).toBeNull();
  });

  it('an unsaved or ordinary business keeps its action, guarded by the server check', () => {
    ctx.prospects = [prospect('ord', null)];
    render(<QuickFireModal businesses={[biz('ord') as never]} onClose={vi.fn()} />);
    expect(externalAnchors()).toHaveLength(0);
    expect(document.querySelector('[data-outreach="blocked"]')).toBeNull();
  });
});

describe('server timeout and repeated clicks', () => {
  it('openOutreach: simultaneous calls for the same link make ONE check and open ONE tab; the extras are silent no-ops', async () => {
    const url = 'https://wa.me/2348031234567';
    const [a, b2, c] = await Promise.all([openOutreach(url, { businessId: 'a' }), openOutreach(url, { businessId: 'a' }), openOutreach(url, { businessId: 'a' })]);
    expect(a).toEqual({ ok: true });
    expect(b2).toMatchObject({ ok: false, duplicate: true, message: '' });
    expect(c).toMatchObject({ ok: false, duplicate: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledTimes(1);
    reportBlocked([b2 as { message: string }, c as { message: string }]);
    expect(alertSpy).not.toHaveBeenCalled(); // nothing to tell the user about a duplicate click
    expect(await openOutreach(url, { businessId: 'a' })).toEqual({ ok: true }); // usable again afterwards
    expect(openSpy).toHaveBeenCalledTimes(2);
  });

  it('openOutreachBatch: a second identical batch while one is running does nothing', async () => {
    const items = [{ url: 'https://wa.me/1', target: { businessId: 'x' } }, { url: 'https://wa.me/2', target: { businessId: 'y' } }];
    const [r1, r2] = await Promise.all([openOutreachBatch(items), openOutreachBatch(items)]);
    expect(r1.opened).toEqual([0, 1]);
    expect(r2).toEqual({ opened: [], blocked: [] });
    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('a hung check times out (fail-closed): tab closed, nothing opened, user told', async () => {
    const timeout = new AbortController();
    const spy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
    fetchSpy.mockImplementation((_u: string, init: RequestInit) => new Promise((_res, rej) => { init.signal?.addEventListener('abort', () => rej(new DOMException('timed out', 'TimeoutError'))); }));
    const p = openOutreach('https://wa.me/1', { businessId: 'a' });
    expect(spy).toHaveBeenCalledWith(10_000); // the check is bounded
    timeout.abort(); // the 10 s deadline passes
    const r = await p;
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/nothing was opened/) });
    expect(wins[0].close).toHaveBeenCalled();
    expect(hrefs()).toEqual(['']);
  });

  it('server error (500) refuses without opening', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    expect((await openOutreach('https://wa.me/1', { businessId: 'a' })).ok).toBe(false);
    expect(hrefs().filter(Boolean)).toEqual([]);
  });

  it('OutreachLink: a triple click makes ONE check and opens ONE tab, and works again afterwards', async () => {
    const onOpened = vi.fn();
    render(<OutreachLink url="https://wa.me/2348031234567" target={{ businessId: 'a' }} onOpened={onOpened}>WhatsApp</OutreachLink>);
    const el = screen.getByText('WhatsApp');
    fireEvent.click(el); fireEvent.click(el); fireEvent.click(el);
    await waitFor(() => expect(onOpened).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(onOpened).toHaveBeenCalledTimes(1);
    fireEvent.click(el);
    await waitFor(() => expect(onOpened).toHaveBeenCalledTimes(2));
  });
});

describe('tel: call links', () => {
  let loc: { href: string };
  beforeEach(() => { loc = { href: 'http://localhost/' }; vi.stubGlobal('location', loc); });

  it('followOutreach: navigates the page to tel: only after the server allows; refusal navigates nowhere', async () => {
    expect(await followOutreach('tel:+2348031234567', { businessId: 'a' })).toEqual({ ok: true });
    expect(loc.href).toBe('tel:+2348031234567');
    loc.href = 'http://localhost/'; verdict = () => BLOCK;
    expect(await followOutreach('tel:+2348031234567', { businessId: 'a' })).toMatchObject({ ok: false });
    expect(loc.href).toBe('http://localhost/');
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    expect((await followOutreach('tel:+2348031234567', { businessId: 'a' })).ok).toBe(false); // fail-closed
    expect(loc.href).toBe('http://localhost/');
  });

  it('OutreachLink sameTab: no tel: href in the DOM; managed → disabled and no request; click → server check → navigate', async () => {
    const { unmount } = render(<OutreachLink url="tel:+234803" target={{ businessId: 'a' }} sameTab>Call</OutreachLink>);
    expect(document.querySelector('a[href^="tel:"]')).toBeNull();
    fireEvent.click(screen.getByText('Call'));
    await waitFor(() => expect(loc.href).toBe('tel:+234803'));
    expect(openSpy).not.toHaveBeenCalled(); // no blank tab
    unmount(); loc.href = 'http://localhost/'; fetchSpy.mockClear();
    render(<OutreachLink url="tel:+234803" target={{ businessId: 'a' }} sameTab managed>Call</OutreachLink>);
    fireEvent.click(screen.getByText('Call'));
    expect(fetchSpy).not.toHaveBeenCalled(); expect(loc.href).toBe('http://localhost/');
  });

  it('search-result table: acquisition clinic has no live Call or WhatsApp; ordinary keeps both, guarded', () => {
    ctx.prospects = [prospect('acq', 'industry-acquisition')];
    render(<BusinessTable businesses={[biz('acq'), biz('ord')] as never} onSelect={vi.fn()} />);
    expect(document.querySelectorAll('a[href^="tel:"], a[href*="wa.me"]')).toHaveLength(0);
    const rows = Array.from(document.querySelectorAll('tbody tr'));
    const acq = rows.find((r) => r.textContent?.includes('Clinic acq'))!; const ord = rows.find((r) => r.textContent?.includes('Clinic ord'))!;
    expect(acq.querySelectorAll('[data-outreach="guarded"]')).toHaveLength(0);
    expect(acq.querySelectorAll('[data-outreach="blocked"]').length).toBeGreaterThanOrEqual(2); // call + WhatsApp
    expect(ord.querySelectorAll('[data-outreach="guarded"]').length).toBeGreaterThanOrEqual(2);
  });
});

describe('search-page bulk WhatsApp API send reports every outcome', () => {
  const T = [{ name: 'Ordinary', phone: '0803 1' }, { name: 'Coral Clinic', phone: '0803 2' }, { name: 'Opted Out', phone: '0803 3' }, { name: 'Down', phone: '0803 4' }];
  const reply = (status: number, error?: string) => Promise.resolve(new Response(JSON.stringify(error ? { error } : { ok: true }), { status }));

  it('counts only real successes; 409 / 403 / 503 / network errors are listed with the server’s reason', async () => {
    fetchSpy.mockReset()
      .mockImplementationOnce(() => reply(200))
      .mockImplementationOnce(() => reply(409, 'This clinic is managed by Industry Acquisition and can’t be messaged from here.'))
      .mockImplementationOnce(() => reply(403, 'This recipient has opted out or been suppressed, so nothing was sent.'))
      .mockImplementationOnce(() => Promise.reject(new Error('offline')));
    const progress: number[] = [];
    const r = await sendWhatsAppBulk(T, { delayMs: 0, onProgress: (d) => progress.push(d) });
    expect(r.sent).toBe(1);
    expect(r.failed.map((f) => [f.name, f.status])).toEqual([['Coral Clinic', 409], ['Opted Out', 403], ['Down', 0]]);
    expect(progress).toEqual([1, 2, 3, 4]);
    const msg = summarizeBulk(T.length, r);
    expect(msg).toMatch(/^Sent 1 of 4\./);
    expect(msg).toMatch(/Coral Clinic: This clinic is managed by Industry Acquisition/);
    expect(msg).toMatch(/Opted Out: This recipient has opted out/);
    expect(msg).toMatch(/Down: Network error/);
  });

  it('a signed-out response stops the run instead of hammering the route', async () => {
    fetchSpy.mockReset().mockImplementation(() => reply(401, 'Unauthorized'));
    const r = await sendWhatsAppBulk(T, { delayMs: 0 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(r.sent).toBe(0);
    expect(r.stopped).toMatch(/signed out/);
  });

  it('a non-JSON error still produces a readable reason, and all-success reports no failures', async () => {
    fetchSpy.mockReset().mockImplementationOnce(() => Promise.resolve(new Response('<html>', { status: 502 }))).mockImplementation(() => reply(200));
    const r = await sendWhatsAppBulk(T.slice(0, 2), { delayMs: 0 });
    expect(r.failed[0].message).toMatch(/HTTP 502/);
    const ok = await sendWhatsAppBulk(T.slice(0, 2), { delayMs: 0 });
    expect(summarizeBulk(2, ok)).toBe('Sent 2 of 2.');
  });
});

describe('static tripwire: no outreach entry point can open an external link unguarded', () => {
  const root = path.resolve(__dirname, '../../src');
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(d, e.name)] : []));
  // RUNVAX's own support address (not a prospect) is a legitimate plain mailto: link.
  const OWN_SUPPORT = /info@runvax\.com|SUPPORT_EMAIL/;
  const files = walk(root).map((f) => ({ rel: path.relative(root, f), text: fs.readFileSync(f, 'utf8').split('\n').filter((l) => !OWN_SUPPORT.test(l)).join('\n') }));

  // Files that legitimately build or hold such URLs (builders, the gate itself, server code).
  const ALLOW = new Set([
    'lib/outreachGate.ts', 'components/OutreachLink.tsx', 'lib/waMessage.ts',
  ]);

  it('no component calls window.open() directly, or renders a wa.me / mailto: href', () => {
    const offenders: string[] = [];
    for (const { rel, text } of files) {
      if (ALLOW.has(rel) || rel.startsWith('app/api/')) continue;
      text.split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        if (/\bwindow\.open\(/.test(line) && /wa\.me|mailto:|whatsapp|Link|url/i.test(line)) offenders.push(`${rel}:${i + 1} ${line.trim()}`);
        if (/href=\{?[`'"]?(https?:\/\/wa\.me|mailto:)/.test(line)) offenders.push(`${rel}:${i + 1} ${line.trim()}`);
        if (/href=\{(whatsappLink|waLink|mailtoLink|buildWALink)/.test(line)) offenders.push(`${rel}:${i + 1} ${line.trim()}`);
        if (/href=\{?[`'"]tel:/.test(line) && !rel.startsWith('app/demo/')) offenders.push(`${rel}:${i + 1} ${line.trim()}`);
        if (/location\.href\s*=\s*[`'"]?(https?:\/\/wa\.me|mailto:)/.test(line)) offenders.push(`${rel}:${i + 1} ${line.trim()}`);
      });
    }
    expect(offenders, `unguarded outreach links:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('every file that builds a wa.me/mailto: URL imports the gate (so it is opened through it)', () => {
    const builders = files.filter(({ rel, text }) => !ALLOW.has(rel) && !rel.startsWith('app/api/') && /buildWALink\(|mailto:|wa\.me/.test(text) && /^'use client'|^"use client"/m.test(text));
    const missing = builders.filter(({ text }) => !/outreachGate|OutreachLink/.test(text)).map((f) => f.rel);
    expect(missing).toEqual([]);
  });
});
