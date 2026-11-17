// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import IntroVideo, { WatchDemo } from '@/components/acq/IntroVideo';

const props = { id: 't1', title: 'Demo title', blurb: 'b', src: '/x.mp4', poster: '/x.jpg' };
beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('IntroVideo', () => {
  it('opens on the first visit only, and "Skip" remembers it', async () => {
    vi.useFakeTimers();
    const a = render(<IntroVideo {...props} />); await act(async () => { vi.advanceTimersByTime(900); });
    expect(screen.getByRole('dialog', { name: 'Demo title' })).toBeTruthy();
    fireEvent.click(screen.getByText('Skip for now')); expect(screen.queryByRole('dialog')).toBeNull();
    a.unmount(); render(<IntroVideo {...props} />); await act(async () => { vi.advanceTimersByTime(900); });
    expect(screen.queryByRole('dialog')).toBeNull();
    vi.useRealTimers();
  });
  it('the watch button reopens it after it was seen', async () => {
    localStorage.setItem('runvax_intro_seen_t1', '1');
    render(<><IntroVideo {...props} /><WatchDemo id="t1" /></>);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByText('Watch the demo')); expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});
