// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import DiscoveryPanel from '@/app/acquisition/_components/DiscoveryPanel';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const json = (b: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } }));
const overview = (allowed: boolean) => ({
  industryKey: 'dental', gate: { allowed, reasons: allowed ? [] : ['ACTIVATION.googlePlaces is false (code-level switch)', 'legal review pending (docs/places-activation-dependencies.md)'] },
  budget: { used: 2, cap: 50, pausedUntil: null }, counts: { pending_research: 0, no_independent_source: 1, promoted: 0, excluded: 0 },
  plan: [{ area: 'Lekki', queryIndex: 0, textQuery: 'dental clinic in Lekki, Lagos' }, { area: 'Lekki', queryIndex: 1, textQuery: 'dentist in Lekki, Lagos' }],
});
const cand = { id: 'c1', placeId: 'ChIJabcdefghijklmnop', area: 'Lekki', status: 'no_independent_source', acqProspectId: null, discoveredAt: new Date().toISOString() };
function stub(allowed: boolean, onPost?: (url: string, body: Record<string, unknown>) => Promise<Response>) {
  const f = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return onPost ? onPost(url, JSON.parse(String(init.body))) : json({ ok: true });
    if (url.includes('/discovery')) return json(overview(allowed));
    return json({ items: [cand] });
  });
  vi.stubGlobal('fetch', f); return f;
}

describe('DiscoveryPanel', () => {
  it('finder off: says so with the reasons, every Queue button is disabled, and Route A points to Import', async () => {
    stub(false);
    render(<DiscoveryPanel industryKey="dental" />);
    await screen.findByText(/Route B/);
    expect(screen.getByText('Off')).toBeTruthy();
    expect(screen.getByText(/legal review pending/)).toBeTruthy();
    for (const b of screen.getAllByRole('button', { name: 'Queue' })) expect((b as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Route A/)).toBeTruthy();
    expect(screen.getByText(/Searches today: 2 of 50/)).toBeTruthy();
  });

  it('finder on: Queue posts the area and query index', async () => {
    const f = stub(true, async () => json({ ok: true, taskId: 't1' }, 202));
    render(<DiscoveryPanel industryKey="dental" />);
    const btns = await screen.findAllByRole('button', { name: 'Queue' });
    fireEvent.click(btns[1]);
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Queued: Lekki, search 2/));
    const call = f.mock.calls.find(([u, i]) => String(u).endsWith('/discovery/run') && (i as RequestInit)?.method === 'POST')!;
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({ industryKey: 'dental', area: 'Lekki', queryIndex: 1 });
  });

  it('promotion: the button stays disabled until BOTH confirmations are ticked; the body carries both; a refusal is shown', async () => {
    const f = stub(false, async () => json({ ok: false, outcome: 'duplicate', reasons: ['already an acquisition prospect'] }, 422));
    render(<DiscoveryPanel industryKey="dental" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add independent source' }));
    fireEvent.change(screen.getByLabelText('Clinic name'), { target: { value: 'Coral Smile Dental' } });
    fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'https://coral-fixture.ng' } });
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'Association member list 2026' } });
    const add = screen.getByRole('button', { name: 'Add as prospect' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    const [independent, lawful] = screen.getAllByRole('checkbox');
    fireEvent.click(independent); expect(add.disabled).toBe(true);
    fireEvent.click(lawful); expect(add.disabled).toBe(false);
    fireEvent.click(add);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/duplicate/));
    const call = f.mock.calls.find(([u, i]) => String(u).endsWith('/candidates/c1') && (i as RequestInit)?.method === 'POST')!;
    expect(JSON.parse(String((call[1] as RequestInit).body))).toMatchObject({ action: 'promote', business_name: 'Coral Smile Dental', attest: true, independentSource: true });
  });
});

import ImportPanel from '@/app/acquisition/_components/ImportPanel';
import { listToCsv } from '@/app/acquisition/_components/pasteList';

describe('listToCsv', () => {
  it('turns lines into the import CSV: source on every row, optional fields blank, commas/quotes escaped, bad lines skipped', () => {
    const r = listToCsv('Coral Smile Dental, coral.ng, 0803 000 0000, Lekki\nBluecrest Dental\n\n=cmd|x\nX\n"Smith, Jones & Co" Dental\tsmith.ng\t\tIkeja', { source: 'Association list 2026', sourceUrl: 'https://assoc.example/list' });
    expect(r.lines).toBe(3);
    expect(r.skipped).toHaveLength(2); // formula-looking name and one-character name
    const rows = r.csv.split('\r\n');
    expect(rows[0]).toBe('business_name,source,source_url,website,phone,area,city');
    expect(rows[1]).toBe('Coral Smile Dental,Association list 2026,https://assoc.example/list,coral.ng,0803 000 0000,Lekki,');
    expect(rows[2]).toBe('Bluecrest Dental,Association list 2026,https://assoc.example/list,,,,');
    expect(rows[3].startsWith('"""Smith, Jones & Co"" Dental"')).toBe(true);
  });
});

describe('ImportPanel paste a list', () => {
  it('needs a source; then previews the generated CSV through the normal import route', async () => {
    const f = vi.fn((url: string, init?: RequestInit) => json({ batchId: 'b1', status: 'previewed', rowCount: 2, accepted: 2, duplicates: 0, rejected: 0, results: [] }));
    vi.stubGlobal('fetch', f);
    render(<ImportPanel industryKey="dental" />);
    fireEvent.change(screen.getByLabelText('Pasted list'), { target: { value: 'Coral Smile Dental, coral.ng\nBluecrest Dental, bluecrest.ng' } });
    const use = screen.getByRole('button', { name: 'Use this list' }) as HTMLButtonElement;
    expect(use.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('List source'), { target: { value: 'Association list 2026' } });
    expect(use.disabled).toBe(false);
    fireEvent.click(use);
    expect(screen.getByRole('status').textContent).toMatch(/2 line\(s\) ready/);
    fireEvent.click(screen.getByRole('button', { name: /Preview/ }));
    await waitFor(() => expect(f).toHaveBeenCalled());
    const body = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body));
    expect(body.industryKey).toBe('dental');
    expect(body.csvText).toContain('Coral Smile Dental,Association list 2026,,coral.ng');
    expect(body.label).toBe('pasted list');
  });
});
