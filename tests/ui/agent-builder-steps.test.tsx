// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AgentBuilder from '@/components/acq/agents/AgentBuilder';
import AgentForm, { formSections } from '@/components/acq/agents/AgentForm';
import { sanitizeConfig } from '@/lib/agents/kinds';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);
Element.prototype.scrollIntoView = vi.fn();

describe('agent form, one section per screen', () => {
  it('shows only the asked-for section', () => {
    const cfg = sanitizeConfig('assistant', { template: 'appointment' });
    render(<AgentForm kind="assistant" cfg={cfg} onChange={() => {}} only="skills" />);
    expect(screen.getByRole('region', { name: 'Skills and tools' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'The job' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Where it works' })).toBeNull();
  });
  it('the manage page (no `only`) still shows everything', () => {
    const cfg = sanitizeConfig('assistant', { template: 'appointment' });
    render(<AgentForm kind="assistant" cfg={cfg} onChange={() => {}} />);
    for (const t of ['The job', 'Knowledge', 'Skills and tools', 'Where it works']) expect(screen.getByRole('region', { name: t })).toBeTruthy();
  });
  it('every section id is rendered by the form', () => {
    for (const kind of ['assistant', 'visibility'] as const) for (const s of formSections(kind)) {
      const { container, unmount } = render(<AgentForm kind={kind} cfg={sanitizeConfig(kind, {})} onChange={() => {}} only={s.id} />);
      expect(container.textContent?.length ?? 0).toBeGreaterThan(0); unmount();
    }
  });
});

describe('builder review is a stepper', () => {
  it('Next moves one step at a time; the last step has Save', () => {
    window.history.pushState({}, '', '/?template=appointment');
    render(<AgentBuilder />);
    fireEvent.click(screen.getByRole('tab', { name: /I will fill it in/ })); fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(screen.getByText(/Step 1 of 6/)).toBeTruthy(); expect(screen.queryByRole('button', { name: /Save agent/ })).toBeNull();
    for (let i = 2; i <= 6; i++) { fireEvent.click(screen.getByRole('button', { name: /^Next/ })); expect(screen.getByText(new RegExp(`Step ${i} of 6`))).toBeTruthy(); }
    expect(screen.getByRole('button', { name: /Save agent/ })).toBeTruthy(); expect(screen.queryByRole('button', { name: /^Next/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' })); expect(screen.getByText(/Step 5 of 6/)).toBeTruthy();
  });
});
