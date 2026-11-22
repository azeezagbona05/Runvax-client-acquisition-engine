// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MultiChips, SingleSelect } from '@/components/acq/agents/Chips';

afterEach(cleanup);
const Multi = ({ max }: { max?: number }) => { const [v, setV] = useState<string[]>([]); return <MultiChips id="t" label="Jobs" options={['Answer questions', 'Book appointments', 'Qualify leads']} value={v} onChange={setV} max={max} />; };

describe('searchable dropdowns', () => {
  it('opens, filters, ticks several, adds a custom one and removes a tag', () => {
    render(<Multi />);
    const box = screen.getByRole('combobox'); fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'book' } });
    expect(screen.queryByRole('option', { name: /Qualify/ })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: /Book appointments/ }));
    fireEvent.change(box, { target: { value: 'Refunds' } }); fireEvent.keyDown(box, { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Remove Book appointments' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Remove Refunds' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Book appointments' }));
    expect(screen.queryByRole('button', { name: 'Remove Book appointments' })).toBeNull();
  });
  it('stops at the maximum', () => {
    render(<Multi max={1} />); fireEvent.focus(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: /Answer/ }));
    expect(screen.getByRole('option', { name: /Qualify/ }).getAttribute('aria-disabled')).toBe('true');
  });
  it('single select picks one and closes', () => {
    const on = vi.fn(); render(<SingleSelect id="b" label="Business" options={['Dental clinic', 'Law firm']} value="" onChange={on} />);
    fireEvent.focus(screen.getByRole('combobox')); fireEvent.click(screen.getByRole('option', { name: /Law firm/ }));
    expect(on).toHaveBeenCalledWith('Law firm'); expect(screen.queryByRole('listbox')).toBeNull();
  });
});
