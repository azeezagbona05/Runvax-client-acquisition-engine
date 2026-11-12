// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { api } from '@/components/acq/career/shared';
import { MatchesPanel } from '@/components/acq/career/Jobs';
import ApplicationsPanel from '@/components/acq/career/Applications';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const res = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

describe('api(): a read is tried once more; a write never is', () => {
  it('a GET that hits a server error succeeds on the second try', async () => {
    const f = vi.fn().mockImplementationOnce(() => res({ error: 'db' }, 500)).mockImplementationOnce(() => res({ ok: 1 })); vi.stubGlobal('fetch', f);
    expect(await api('/api/career/jobs')).toEqual({ ok: 1 }); expect(f).toHaveBeenCalledTimes(2);
  });
  it('a dropped connection on a GET is retried once, then reported plainly', async () => {
    const f = vi.fn(() => Promise.reject(new TypeError('network'))); vi.stubGlobal('fetch', f);
    expect((await api('/api/career/jobs')).error).toMatch(/Could not reach the server/); expect(f).toHaveBeenCalledTimes(2);
  });
  it('a POST is NEVER repeated (it could prepare or send something twice)', async () => {
    const f = vi.fn(() => res({}, 500)); vi.stubGlobal('fetch', f);
    expect((await api('/api/career/applications', { method: 'POST', body: '{}' })).error).toBe('Something went wrong. Please try again.'); expect(f).toHaveBeenCalledTimes(1);
    const g = vi.fn(() => Promise.reject(new TypeError('x'))); vi.stubGlobal('fetch', g); await api('/x', { method: 'PATCH' }); expect(g).toHaveBeenCalledTimes(1);
  });
  it('a normal error message from the server is passed through, and 4xx is not retried', async () => {
    const f = vi.fn(() => res({ error: 'Confirm your profile first.' }, 400)); vi.stubGlobal('fetch', f);
    expect((await api('/api/career/jobs')).error).toBe('Confirm your profile first.'); expect(f).toHaveBeenCalledTimes(1);
  });
});

const JOBS = { discovered: 2, matched: 1, minScore: 75, jobs: [{ id: 'm1', applicationStatus: null, score: 90, reasons: ['Title matches'], status: 'new', title: 'Frontend Developer', company: 'Acme', location: 'Remote', remote: true, url: 'https://x.test/1', source: 'Remotive', postedAt: null, foundAt: new Date().toISOString() }] };

describe('a failed refresh never wipes out a screen that was working (the "Prepare application" case)', () => {
  it('Matched opportunities keeps the jobs, says it could not refresh, and recovers on Try again', async () => {
    let healthy = true; const f = vi.fn(() => (healthy ? res(JOBS) : res({ error: 'db' }, 500))); vi.stubGlobal('fetch', f);
    const props = { onChanged: vi.fn(), onOpenApplications: vi.fn(), canPrepare: true };
    const { rerender } = render(<MatchesPanel {...props} refreshKey={0} />);
    expect(await screen.findByText('Frontend Developer')).toBeTruthy();
    healthy = false; rerender(<MatchesPanel {...props} refreshKey={1} />);                                  // the refresh after an action fails (twice: it retries once)
    expect(await screen.findByText(/Could not refresh just now/, undefined, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText('Frontend Developer')).toBeTruthy(); expect(screen.queryByText(/Something went wrong/)).toBeNull();   // the list is still there
    healthy = true; fireEvent.click(screen.getByText('Try again'));
    await waitFor(() => expect(screen.queryByText(/Could not refresh just now/)).toBeNull()); expect(screen.getByText('Frontend Developer')).toBeTruthy();
  }, 15000);
  it('the first load failing (nothing to show yet) says so with a Try again button', async () => {
    let healthy = false; vi.stubGlobal('fetch', vi.fn(() => (healthy ? res(JOBS) : res({ error: 'db' }, 500))));
    render(<MatchesPanel onChanged={vi.fn()} onOpenApplications={vi.fn()} canPrepare refreshKey={0} />);
    expect(await screen.findByRole('alert', undefined, { timeout: 4000 })).toBeTruthy(); healthy = true;
    fireEvent.click(screen.getByText('Try again')); expect(await screen.findByText('Frontend Developer')).toBeTruthy();
  }, 15000);
  it('Applications keeps its list when a later refresh fails', async () => {
    const row = { id: 'a1', status: 'prepared', cv: { name: 'Ada', skills: [], experience: [], education: [], certifications: [], achievements: [], email: '', phone: '', location: '', headline: '', summary: '' }, coverLetter: 'Dear team', answers: [], gaps: [], flags: [], source: 'rules', edited: false, approvedAt: null, appliedAt: null, appliedBy: null, updatedAt: new Date().toISOString(), score: 90, submission: null, job: { title: 'Frontend Developer', company: 'Acme', location: 'Remote', remote: true, url: 'https://x.test', source: 'Remotive' } };
    let healthy = true; vi.stubGlobal('fetch', vi.fn((u: string) => (String(u).includes('submissions') ? res({ enabled: false, message: '', supported: [] }) : healthy ? res({ applications: [row] }) : res({ error: 'db' }, 500))));
    const { rerender } = render(<ApplicationsPanel mode="all" onChanged={vi.fn()} refreshKey={0} permMode="prepare" />);
    expect(await screen.findByText('Frontend Developer')).toBeTruthy();
    healthy = false; rerender(<ApplicationsPanel mode="all" onChanged={vi.fn()} refreshKey={1} permMode="prepare" />);
    expect(await screen.findByText(/Could not refresh just now/, undefined, { timeout: 4000 })).toBeTruthy(); expect(screen.getByText('Frontend Developer')).toBeTruthy();
  }, 15000);
});
