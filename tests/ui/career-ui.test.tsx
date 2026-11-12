// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import ProfileReview from '@/components/acq/career/ProfileReview';
import Wizard from '@/components/acq/career/Wizard';
import { TagInput } from '@/components/acq/career/ui';
import type { CareerState } from '@/components/acq/career/shared';
import { defaultDiscovery, defaultPermissions, defaultPreferences, sanitizeProfile } from '@/lib/career/types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const reply = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

const cv = sanitizeProfile({ name: 'Ada Obi', email: 'ada@example.com', headline: 'Frontend Developer', summary: 'Frontend developer with five years building React apps.', skills: ['React', 'TypeScript'],
  experience: [{ title: 'Frontend Developer', company: 'Bright Labs', start: '2021', end: 'Present', bullets: ['Built a React dashboard used by 300 customers'] }] });

function review(over: Partial<React.ComponentProps<typeof ProfileReview>> = {}) {
  const props = { profile: cv, baseline: cv, source: 'rules', confirmed: false, removed: [], busy: false, onSave: vi.fn(), onRevertAll: vi.fn(), ...over };
  render(<ProfileReview {...props} />); return props;
}

describe('ProfileReview: the CV version is never silently changed', () => {
  it('typing keeps focus and the same input (no remount per keystroke)', () => {
    review(); const input = screen.getByDisplayValue('Ada Obi') as HTMLInputElement; input.focus();
    fireEvent.change(input, { target: { value: 'Ada Obi-Smith' } });
    const after = screen.getByDisplayValue('Ada Obi-Smith'); expect(after).toBe(input); expect(document.activeElement).toBe(input);
  });
  it('"Back to my CV" appears only once a field differs, and restores the CV version', () => {
    review(); expect(screen.queryAllByText('Back to my CV')).toHaveLength(0);
    const headline = screen.getAllByDisplayValue('Frontend Developer')[0] as HTMLInputElement;          // [0] headline, [1] the job title
    fireEvent.change(headline, { target: { value: 'Rockstar Ninja' } });
    const back = screen.getAllByText('Back to my CV'); expect(back).toHaveLength(1);
    fireEvent.click(back[0]); expect((screen.getByLabelText(/^Skills$/) as HTMLTextAreaElement).value).toBe('React, TypeScript');
    expect(screen.getAllByDisplayValue('Frontend Developer')).toHaveLength(2); expect(screen.queryAllByText('Back to my CV')).toHaveLength(0);
  });
  it('"Rewrite with AI" puts the rewrite in the field, labels it, and can be reverted', async () => {
    const fetchMock = vi.fn(() => reply({ text: 'Frontend developer with five years of React experience.' })); vi.stubGlobal('fetch', fetchMock);
    review(); const summary = screen.getByDisplayValue(/five years building React apps/) as HTMLTextAreaElement;
    fireEvent.click(screen.getAllByText('Rewrite with AI')[1]);                                  // [0] = headline, [1] = summary
    await waitFor(() => expect(summary.value).toBe('Frontend developer with five years of React experience.'));
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({ kind: 'summary', text: cv.summary });
    expect(screen.getByText('Rewritten by AI')).toBeTruthy();
    fireEvent.click(screen.getByText('Back to my CV'));
    expect(summary.value).toBe(cv.summary); expect(screen.queryByText('Rewritten by AI')).toBeNull();
  });
  it('a refused rewrite leaves the text alone and says why', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply({ error: 'The rewrite added something that is not in your CV, so it was discarded. Your text is unchanged.' }, 422)));
    review(); const summary = screen.getByDisplayValue(/five years building React apps/) as HTMLTextAreaElement;
    fireEvent.click(screen.getAllByText('Rewrite with AI')[1]);
    expect(await screen.findByText(/not in your CV, so it was discarded/)).toBeTruthy(); expect(summary.value).toBe(cv.summary); expect(screen.queryByText('Rewritten by AI')).toBeNull();
  });
  it('going back to the whole CV version asks first', () => {
    const p = review(); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByText(/Go back to the whole CV version/)); expect(p.onRevertAll).not.toHaveBeenCalled();
    confirm.mockReturnValue(true); fireEvent.click(screen.getByText(/Go back to the whole CV version/)); expect(p.onRevertAll).toHaveBeenCalledTimes(1);
  });
  it('with no stored CV version there is nothing to revert to, so no revert buttons', () => {
    review({ baseline: null }); fireEvent.change(screen.getAllByDisplayValue('Frontend Developer')[0], { target: { value: 'X' } });
    expect(screen.queryAllByText('Back to my CV')).toHaveLength(0); expect(screen.queryByText(/whole CV version/)).toBeNull();
  });
});

describe('TagInput', () => {
  it('adds on Enter or comma, ignores duplicates, removes on x and Backspace', () => {
    const onChange = vi.fn(); const { rerender } = render(<TagInput label="Titles" value={['A']} onChange={onChange} />);
    const box = screen.getByLabelText('Titles'); fireEvent.change(box, { target: { value: 'B' } }); fireEvent.keyDown(box, { key: 'Enter' }); expect(onChange).toHaveBeenLastCalledWith(['A', 'B']);
    fireEvent.change(box, { target: { value: 'a' } }); fireEvent.keyDown(box, { key: ',' }); expect(onChange).toHaveBeenCalledTimes(1);         // duplicate (case-insensitive): nothing added
    fireEvent.change(box, { target: { value: 'C, D' } }); fireEvent.blur(box); expect(onChange).toHaveBeenLastCalledWith(['A', 'C', 'D']);
    fireEvent.click(screen.getByLabelText('Remove A')); expect(onChange).toHaveBeenLastCalledWith([]);
    rerender(<TagInput label="Titles" value={['A', 'B']} onChange={onChange} />); fireEvent.keyDown(screen.getByLabelText('Titles'), { key: 'Backspace' }); expect(onChange).toHaveBeenLastCalledWith(['A']);
  });
});

const state = (over: Partial<CareerState> = {}): CareerState => ({
  baseline: cv, profile: cv, profileSource: 'rules', profileConfirmed: true, documents: [], preferences: defaultPreferences(), discovery: defaultDiscovery(), permissions: defaultPermissions(),
  status: 'draft', deployedAt: null, issues: [], events: [], ...over,
});
const SUG = { suggestion: { source: 'rules', notes: [], preferences: { titles: ['Frontend Developer', 'Senior Frontend Developer'], industries: [], country: 'Nigeria', locations: ['Lagos'], workModes: ['remote', 'hybrid'], level: 'senior' }, standing: { linkedin: 'https://linkedin.com/in/ada', github: '', website: '', residenceCountry: 'Nigeria' } } };

describe('Wizard: setup is filled in from the CV, editable, and revertable', () => {
  it('moving on from the CV step fills step 2; edits can be reverted next to the field; nothing is saved until Next', async () => {
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => (String(url).includes('/suggest') ? reply(SUG) : reply({})));
    vi.stubGlobal('fetch', fetchMock);
    render(<Wizard state={state()} onState={vi.fn()} />);
    fireEvent.click(screen.getByText('Next'));
    expect(await screen.findByText('What job are you looking for?')).toBeTruthy();
    expect(screen.getByText('Frontend Developer')).toBeTruthy(); expect(screen.getByText('Senior Frontend Developer')).toBeTruthy(); expect((screen.getByLabelText('Country') as HTMLInputElement).value).toBe('Nigeria');
    expect(screen.queryAllByText(/Back to my CV/)).toHaveLength(0);

    fireEvent.click(screen.getByLabelText('Remove Senior Frontend Developer'));                       // the user changes a generated value...
    const titles = screen.getByText('What job are you looking for?').closest('div')!.parentElement!.parentElement!;
    fireEvent.click(within(titles).getByText('Back to my CV'));                                       // ...and the button next to the field brings the CV version back
    expect(screen.getByText('Senior Frontend Developer')).toBeTruthy();
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/career') && !String(c[0]).includes('suggest') && c[1]?.method === 'PUT')).toHaveLength(0);
  });
  it('step 2 will not continue without a job title', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply({ error: 'x' }, 400)));                                  // suggestion unavailable: the page starts empty
    render(<Wizard state={state()} onState={vi.fn()} />);
    fireEvent.click(screen.getByText('Next')); await screen.findByText('What job are you looking for?');
    fireEvent.click(screen.getByText('Next')); expect(await screen.findByText('Add at least one job title.')).toBeTruthy();
  });
  it('an existing setup is not overwritten by the automatic fill', async () => {
    const fetchMock = vi.fn(() => reply(SUG)); vi.stubGlobal('fetch', fetchMock);
    render(<Wizard state={state({ preferences: { ...defaultPreferences(), titles: ['My own title'] } })} onState={vi.fn()} />);
    fireEvent.click(screen.getByText('Next')); await screen.findByText('What job are you looking for?');
    expect(screen.getByText('My own title')).toBeTruthy(); expect(screen.queryByText('Senior Frontend Developer')).toBeNull(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('legal details are never filled from the CV', async () => {
    vi.stubGlobal('fetch', vi.fn((u: string) => reply(String(u).includes('/suggest') ? SUG : { ...state(), status: 'draft' })));
    render(<Wizard state={state({ preferences: { ...defaultPreferences(), titles: ['X'], workModes: ['remote'] } })} onState={vi.fn()} />);
    fireEvent.click(screen.getByText('Next')); fireEvent.click(await screen.findByText('Next')); fireEvent.click(await screen.findByText('Next'));
    fireEvent.click(await screen.findByLabelText(/Submit after batch approval/)); fireEvent.click(screen.getByText(/Details the agent may need/));
    for (const g of screen.getAllByRole('radiogroup').filter((x) => /Work authorization|Visa sponsorship/.test(x.getAttribute('aria-label') ?? ''))) expect(within(g).getByText('Ask me').getAttribute('aria-checked')).toBe('true');
  });
});

/** Every empty text box must tell the user what to type. Date-time pickers show the browser's own format mask, so they are exempt. */
const SKIP = new Set(['checkbox', 'radio', 'file', 'range', 'hidden', 'datetime-local', 'submit', 'button']);
const bare = (root: HTMLElement) => Array.from(root.querySelectorAll('input,textarea')).filter((el) => {
  const i = el as HTMLInputElement; return !SKIP.has(i.type) && i.value === '' && !i.getAttribute('placeholder');
}).map((el) => `${el.tagName.toLowerCase()} "${el.getAttribute('aria-label') ?? el.getAttribute('name') ?? el.className}"`);

describe('placeholders: every empty field gives a heads-up', () => {
  it('profile review with nothing filled in (including a new role and new education)', () => {
    const empty = sanitizeProfile({});
    const { container } = render(<ProfileReview profile={empty} baseline={null} source={null} confirmed={false} removed={[]} busy={false} onSave={vi.fn()} onRevertAll={vi.fn()} />);
    fireEvent.click(screen.getByText('Add a role')); fireEvent.click(screen.getByText('Add education'));
    expect(bare(container)).toEqual([]);
  });
  it('every wizard step, starting from an empty setup', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => reply(String(url).includes('/suggest') ? { error: 'none' } : { ...state() }, String(url).includes('/suggest') ? 400 : 200)));
    const { container } = render(<Wizard state={state({ preferences: { ...defaultPreferences(), workModes: ['remote'] } })} onState={vi.fn()} />);
    expect(bare(container)).toEqual([]);                                                                    // step 1
    fireEvent.click(screen.getByText('Next')); await screen.findByText('What job are you looking for?');
    expect(bare(container)).toEqual([]);                                                                    // step 2 (titles empty)
    const box = screen.getByLabelText('Job titles'); fireEvent.change(box, { target: { value: 'Developer' } }); fireEvent.keyDown(box, { key: 'Enter' });
    fireEvent.click(screen.getByText('Next')); await screen.findByText('Where should it look?');
    expect(bare(container)).toEqual([]);                                                                    // step 3
    fireEvent.click(screen.getByText('Next')); await screen.findByText('What may the agent do with a good match?');
    fireEvent.click(screen.getByLabelText(/Automatically submit eligible applications/));                  // reveals the rules + the application-form details
    expect(bare(container)).toEqual([]);                                                                    // step 4 (auto mode)
    fireEvent.click(screen.getByLabelText(/I understand the agent will apply/)); fireEvent.click(screen.getByText('Next')); await screen.findByText('Here is your setup');
    expect(bare(container)).toEqual([]);                                                                    // step 5 (job box, role box)
  });
});
