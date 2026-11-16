// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import SwipeDeck from '@/components/acq/career/SwipeDeck';
import type { SwipeDir } from '@/lib/career/swipe';
import { MatchesPanel } from '@/components/acq/career/Jobs';
import ApplicationsPanel from '@/components/acq/career/Applications';

// jsdom has no PointerEvent; this one carries clientX like a real one.
beforeAll(() => { class PE extends MouseEvent { pointerId: number; constructor(t: string, i: PointerEventInit = {}) { super(t, i); this.pointerId = i.pointerId ?? 1; } } (window as unknown as { PointerEvent: unknown }).PointerEvent = PE; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true }); });
const ok = { ok: true }; const reply = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

type Item = { id: string; name: string };
const items: Item[] = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }, { id: 'c', name: 'Gamma' }];
function deck(over: Partial<React.ComponentProps<typeof SwipeDeck<Item>>> = {}) {
  const onDecide = vi.fn(async (_i: Item, _d: SwipeDir) => ok);
  render(<SwipeDeck<Item> items={items} keyOf={(i) => i.id} render={(i) => <div>{i.name}</div>} onDecide={onDecide} labels={{ right: 'Apply', left: 'Skip' }} empty={<div>All done</div>} {...over} />);
  return onDecide;
}

describe('SwipeDeck', () => {
  it('shows one card at a time, with the count', () => { deck(); expect(screen.getByText('Alpha')).toBeTruthy(); expect(screen.queryByText('Beta')).toBeNull(); expect(screen.getByText(/3 left/)).toBeTruthy(); });
  it('the buttons decide: Apply sends "right", Skip sends "left", then the next card shows', async () => {
    const d = deck(); fireEvent.click(screen.getByLabelText('Apply'));
    await waitFor(() => expect(screen.getByText('Beta')).toBeTruthy()); expect(d).toHaveBeenCalledWith(items[0], 'right');
    fireEvent.click(screen.getByLabelText('Skip')); await waitFor(() => expect(screen.getByText('Gamma')).toBeTruthy()); expect(d).toHaveBeenLastCalledWith(items[1], 'left');
  });
  it('arrow keys work, so no touch screen is needed', async () => {
    const d = deck(); const g = screen.getByRole('group', { name: /Swipe deck/ });
    fireEvent.keyDown(g, { key: 'ArrowRight' }); await waitFor(() => expect(screen.getByText('Beta')).toBeTruthy());
    fireEvent.keyDown(g, { key: 'ArrowLeft' }); await waitFor(() => expect(screen.getByText('Gamma')).toBeTruthy()); expect(d.mock.calls.map((c) => c[1])).toEqual(['right', 'left']);
  });
  it('a real drag past the threshold decides; a short drag springs back and decides nothing', async () => {
    const d = deck(); const card = screen.getByTestId('swipe-card');
    fireEvent.pointerDown(card, { clientX: 100, pointerId: 1 }); fireEvent.pointerMove(card, { clientX: 130, pointerId: 1 }); fireEvent.pointerUp(card, { clientX: 130, pointerId: 1 });
    expect(d).not.toHaveBeenCalled(); expect(screen.getByText('Alpha')).toBeTruthy();
    fireEvent.pointerDown(card, { clientX: 300, pointerId: 1 }); fireEvent.pointerMove(card, { clientX: 100, pointerId: 1 }); fireEvent.pointerUp(card, { clientX: 100, pointerId: 1 });
    await waitFor(() => expect(d).toHaveBeenCalledWith(items[0], 'left'));
  });
  it('starting a drag on a link or button does not swipe (they keep working)', () => {
    const d = deck({ render: (i) => <a href="#x" data-testid="lnk">{i.name}</a> }); const link = screen.getByTestId('lnk');
    fireEvent.pointerDown(link, { clientX: 300, pointerId: 1 }); fireEvent.pointerMove(link, { clientX: 50, pointerId: 1 }); fireEvent.pointerUp(link, { clientX: 50, pointerId: 1 }); expect(d).not.toHaveBeenCalled();
  });
  it('when the decision fails the card comes back with the reason, and nothing is lost', async () => {
    deck({ onDecide: vi.fn(async (_i: Item, _d: SwipeDir) => ({ ok: false, error: 'Confirm your profile first.' })) });
    fireEvent.click(screen.getByLabelText('Apply')); expect(await screen.findByText('Confirm your profile first.')).toBeTruthy(); expect(screen.getByText('Alpha')).toBeTruthy(); expect(screen.getByText(/3 left/)).toBeTruthy();
  });
  it('a blocked right swipe explains why and decides nothing', () => {
    const d = deck({ rightBlocked: 'Deploy your agent first.' }); expect((screen.getByLabelText('Apply') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole('group', { name: /Swipe deck/ }), { key: 'ArrowRight' }); expect(d).not.toHaveBeenCalled(); expect(screen.getAllByText('Deploy your agent first.').length).toBeGreaterThan(0);
  });
  it('Undo brings the last card back (only for decisions that can be undone)', async () => {
    const onUndo = vi.fn(async (_i: Item, _d: SwipeDir) => ok); deck({ onUndo, undoable: (d) => d === 'left' });
    fireEvent.click(screen.getByLabelText('Skip')); await waitFor(() => expect(screen.getByText('Beta')).toBeTruthy());
    fireEvent.click(screen.getByText('Undo')); await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy()); expect(onUndo).toHaveBeenCalledWith(items[0], 'left');
    fireEvent.click(screen.getByLabelText('Apply')); await waitFor(() => expect(screen.getByText('Beta')).toBeTruthy()); expect(screen.queryByText('Undo')).toBeNull();      // "right" is not undoable here
  });
  it('shows the empty message after the last card', async () => {
    deck({ items: [items[0]] }); fireEvent.click(screen.getByLabelText('Skip')); expect(await screen.findByText('All done')).toBeTruthy();
  });
});

const JOBS = { discovered: 2, matched: 2, minScore: 75, jobs: [
  { id: 'm1', applicationStatus: null, score: 92, reasons: ['Title matches'], status: 'new', title: 'Frontend Developer', company: 'Acme', location: 'Remote', remote: true, url: 'https://x.test/1', source: 'Remotive', postedAt: null, foundAt: new Date().toISOString() },
  { id: 'm2', applicationStatus: null, score: 81, reasons: ['Remote, as you prefer'], status: 'new', title: 'React Developer', company: 'Beta', location: 'Remote', remote: true, url: 'https://x.test/2', source: 'Remotive', postedAt: null, foundAt: new Date().toISOString() },
] };
const panel = (canPrepare = true) => <MatchesPanel onChanged={vi.fn()} refreshKey={0} onOpenApplications={vi.fn()} canPrepare={canPrepare} />;

describe('Matched opportunities: swipe', () => {
  it('phones start on swipe cards, desktops on the list', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(JOBS)));
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true }); render(panel()); expect(await screen.findByTestId('swipe-card')).toBeTruthy(); cleanup();
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true }); render(panel()); await screen.findAllByText('Frontend Developer'); expect(screen.queryByTestId('swipe-card')).toBeNull();
  });
  it('swipe right prepares an application; swipe left dismisses the job', async () => {
    const f = vi.fn((u: string, init?: RequestInit) => (init?.method === 'POST' ? reply({ results: [{ matchId: 'm1', ok: true }] }) : init?.method === 'PATCH' ? reply({ ok: true }) : reply(JOBS))); vi.stubGlobal('fetch', f);
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true }); render(panel()); await screen.findByTestId('swipe-card');
    fireEvent.click(screen.getByLabelText('Prepare application'));
    await waitFor(() => expect(f.mock.calls.some((c) => String(c[0]).endsWith('/api/career/applications') && c[1]?.method === 'POST' && JSON.parse(String(c[1].body)).matchIds[0] === 'm1')).toBe(true));
    await waitFor(() => expect(screen.getByText('React Developer')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Not interested'));
    await waitFor(() => expect(f.mock.calls.some((c) => String(c[0]).endsWith('/api/career/jobs/m2') && c[1]?.method === 'PATCH' && JSON.parse(String(c[1].body)).status === 'dismissed')).toBe(true));
  });
  it('a refused prepare keeps the card and shows the reason', async () => {
    vi.stubGlobal('fetch', vi.fn((u: string, init?: RequestInit) => (init?.method === 'POST' ? reply({ error: 'Confirm your profile first.' }, 400) : reply(JOBS))));
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true }); render(panel()); await screen.findByTestId('swipe-card');
    fireEvent.click(screen.getByLabelText('Prepare application')); expect(await screen.findByText('Confirm your profile first.')).toBeTruthy(); expect(screen.getByText('Frontend Developer')).toBeTruthy();
  });
  it('without a deployed agent, swiping right is blocked with the reason', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(JOBS))); Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true }); render(panel(false)); await screen.findByTestId('swipe-card');
    expect((screen.getByLabelText('Prepare application') as HTMLButtonElement).disabled).toBe(true); expect(screen.getAllByText(/Deploy your agent and confirm your profile/).length).toBeGreaterThan(0);
  });
});

const APP = (id: string, title: string) => ({ id, status: 'prepared', cv: { name: 'Ada', summary: 'Frontend developer with five years of React.', skills: [], experience: [], education: [], certifications: [], achievements: [], email: '', phone: '', location: '', headline: '' }, coverLetter: 'Dear team, I build React apps.', answers: [], gaps: [], flags: [], source: 'rules', edited: false, approvedAt: null, appliedAt: null, appliedBy: null, updatedAt: new Date().toISOString(), score: 90, submission: null, job: { title, company: 'Acme', location: 'Remote', remote: true, url: 'https://x.test', source: 'Remotive' } });

describe('Approvals: swipe', () => {
  it('swipe right approves, swipe left rejects, and Undo re-opens', async () => {
    const f = vi.fn((u: string, init?: RequestInit) => (init?.method === 'PATCH' ? reply({ ok: true }) : String(u).includes('submissions') ? reply({ enabled: false, message: '', supported: [] }) : reply({ applications: [APP('a1', 'Frontend Developer'), APP('a2', 'React Developer')] }))); vi.stubGlobal('fetch', f);
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    render(<ApplicationsPanel mode="queue" onChanged={vi.fn()} refreshKey={0} permMode="batch" />); await screen.findByTestId('swipe-card');
    expect(screen.getByText(/Dear team, I build React apps/)).toBeTruthy();                                    // the card shows what you are approving
    const patched = () => f.mock.calls.filter((c) => c[1]?.method === 'PATCH').map((c) => [String(c[0]).split('/').pop(), JSON.parse(String(c[1]!.body)).action]);
    fireEvent.click(screen.getByLabelText('Approve')); await waitFor(() => expect(patched()).toContainEqual(['a1', 'approve']));
    await waitFor(() => expect(screen.getByText('React Developer')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Reject')); await waitFor(() => expect(patched()).toContainEqual(['a2', 'reject']));
    fireEvent.click(await screen.findByText('Undo')); await waitFor(() => expect(patched()).toContainEqual(['a2', 'reopen']));
  });
  it('a refused approval (for example the profile changed) keeps the card and says why', async () => {
    vi.stubGlobal('fetch', vi.fn((u: string, init?: RequestInit) => (init?.method === 'PATCH' ? reply({ error: 'Your profile has changed since this was written.' }, 400) : String(u).includes('submissions') ? reply({ enabled: false, message: '', supported: [] }) : reply({ applications: [APP('a1', 'Frontend Developer')] }))));
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true }); render(<ApplicationsPanel mode="queue" onChanged={vi.fn()} refreshKey={0} permMode="batch" />); await screen.findByTestId('swipe-card');
    fireEvent.click(screen.getByLabelText('Approve')); expect(await screen.findByText(/profile has changed/)).toBeTruthy(); expect(screen.getByText('Frontend Developer')).toBeTruthy();
  });
});
