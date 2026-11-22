// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MatchesPanel } from '@/components/acq/career/Jobs';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

/** A server with 60 jobs that honours offset, limit and a text search, and records every URL it was asked for. */
function server() {
  const all = Array.from({ length: 60 }, (_, i) => ({
    id: `m${i}`, applicationStatus: null, score: 90 - (i % 40), reasons: ['Skills match'], status: 'new', title: `Role ${i}`, company: i % 2 ? 'Acme' : 'Globex',
    location: i % 3 ? 'Lagos' : 'Remote', remote: i % 3 === 0, url: `https://example.com/${i}`, source: 'Remotive', sourceId: 'remotive', postedAt: null, foundAt: new Date().toISOString(),
  }));
  const urls: string[] = [];
  const f = vi.fn((url: string) => {
    urls.push(url); const sp = new URL(url, 'http://x').searchParams;
    const q = (sp.get('q') ?? '').toLowerCase(); const remote = sp.get('remote');
    let rows = all.filter((j) => !q || `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(q));
    if (remote === '1') rows = rows.filter((j) => j.remote); if (remote === '0') rows = rows.filter((j) => !j.remote);
    const offset = Number(sp.get('offset')); const limit = Number(sp.get('limit'));
    return Promise.resolve(new Response(JSON.stringify({ discovered: 60, matched: 60, minScore: 60, total: rows.length, sources: [{ id: 'remotive', label: 'Remotive', count: 60 }], jobs: rows.slice(offset, offset + limit) }), { status: 200, headers: { 'content-type': 'application/json' } }));
  });
  vi.stubGlobal('fetch', f); return { urls, last: () => urls[urls.length - 1] };
}
const mount = () => render(<MatchesPanel onChanged={() => {}} refreshKey={0} onOpenApplications={() => {}} canPrepare />);
const rows = () => within(screen.getByRole('table', { name: 'Jobs found' })).getAllByRole('row').length - 1;   // minus the header

describe('Jobs table', () => {
  it('shows one page of the jobs in a table with the range and page buttons', async () => {
    const s = server(); mount();
    await screen.findByRole('table', { name: 'Jobs found' });
    expect(rows()).toBe(25);
    expect(screen.getByText(/Showing 1–25 of 60/)).toBeTruthy();
    expect(s.last()).toMatch(/offset=0&limit=25/);
    expect((screen.getByRole('button', { name: 'Previous page' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('next page and page numbers ask the server for the right slice', async () => {
    const s = server(); mount(); await screen.findByRole('table', { name: 'Jobs found' });
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText(/Showing 26–50 of 60/); expect(s.last()).toMatch(/offset=25&limit=25/);
    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    await screen.findByText(/Showing 51–60 of 60/); expect(rows()).toBe(10);
    expect((screen.getByRole('button', { name: 'Next page' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('rows per page changes the page size and goes back to page 1', async () => {
    const s = server(); mount(); await screen.findByRole('table', { name: 'Jobs found' });
    fireEvent.click(screen.getByRole('button', { name: 'Next page' })); await screen.findByText(/Showing 26–50/);
    fireEvent.change(screen.getByRole('combobox', { name: 'Rows per page' }), { target: { value: '10' } });
    await screen.findByText(/Showing 1–10 of 60/); expect(s.last()).toMatch(/offset=0&limit=10/); expect(rows()).toBe(10);
  });

  it('search narrows the table and returns to page 1; clear filters brings everything back', async () => {
    const s = server(); mount(); await screen.findByRole('table', { name: 'Jobs found' });
    fireEvent.click(screen.getByRole('button', { name: 'Next page' })); await screen.findByText(/Showing 26–50/);
    fireEvent.change(screen.getByLabelText('Search the jobs found'), { target: { value: 'acme' } });
    await waitFor(() => expect(s.last()).toMatch(/q=acme/)); expect(s.last()).toMatch(/offset=0/);
    await screen.findByText(/Showing 1–25 of 30/); expect(screen.getByText(/30 match your search/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Clear filters/ }));
    await screen.findByText(/Showing 1–25 of 60/);
  });

  it('work type and minimum match are sent to the server, and the empty result says so', async () => {
    const s = server(); mount(); await screen.findByRole('table', { name: 'Jobs found' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Work type' }), { target: { value: '1' } });
    await waitFor(() => expect(s.last()).toMatch(/remote=1/)); await screen.findByText(/Showing 1–20 of 20/);
    fireEvent.change(screen.getByRole('combobox', { name: 'Minimum match' }), { target: { value: '85' } });
    await waitFor(() => expect(s.last()).toMatch(/minScore=85/));
    fireEvent.change(screen.getByLabelText('Search the jobs found'), { target: { value: 'zzzz' } });
    await screen.findByText('Nothing matches that search.');
  });

  it('clicking a column heading sorts on the server', async () => {
    const s = server(); mount(); await screen.findByRole('table', { name: 'Jobs found' });
    fireEvent.click(screen.getByRole('button', { name: 'Company' }));
    await waitFor(() => expect(s.last()).toMatch(/sort=company/));
  });
});
