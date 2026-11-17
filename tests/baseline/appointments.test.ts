import { describe, it, expect } from 'vitest';
import { appointmentState, followUpState, countAppointments, type AppointmentRow } from '@/lib/appointments';
import { OFFICIAL_TEMPLATES, RESCHEDULE_TEMPLATE_ID } from '@/lib/templateLibrary';
import { briefFromTemplate, planFromTemplate } from '@/lib/templateEngine';

const NOW = new Date('2026-12-01T10:00:00Z').getTime(); const DAY = 86_400_000;
const d = (n: number) => new Date(NOW + n * DAY);

describe('appointment state', () => {
  it('a passed meeting with no outcome needs an update; it is never assumed held or missed', () => {
    expect(appointmentState({ demoAt: d(-1), outcome: null }, NOW)).toBe('needs_update');
    expect(appointmentState({ demoAt: d(2), outcome: null }, NOW)).toBe('upcoming');
    expect(appointmentState({ demoAt: null, outcome: null }, NOW)).toBe('unscheduled');
  });
  it('a recorded outcome wins, and unknown outcomes are ignored', () => {
    expect(appointmentState({ demoAt: d(-9), outcome: 'missed' }, NOW)).toBe('missed');
    expect(appointmentState({ demoAt: d(2), outcome: 'held' }, NOW)).toBe('held');
    expect(appointmentState({ demoAt: d(-1), outcome: 'weird' }, NOW)).toBe('needs_update');
  });
});

describe('next step', () => {
  const base = { nextAction: 'Send proposal', nextActionDue: d(-1), nextActionDoneAt: null };
  it('open, overdue, done or none', () => {
    expect(followUpState({ ...base, nextActionDue: d(2) }, NOW)).toBe('open');
    expect(followUpState(base, NOW)).toBe('overdue');
    expect(followUpState({ ...base, nextActionDoneAt: d(0) }, NOW)).toBe('done');
    expect(followUpState({ nextAction: '  ', nextActionDue: null, nextActionDoneAt: null }, NOW)).toBe('none');
    expect(followUpState({ ...base, nextActionDue: null }, NOW)).toBe('open');
  });
  it('counts what the tabs show', () => {
    const r = (state: string, followUp: string) => ({ state, followUp }) as AppointmentRow;
    expect(countAppointments([r('missed', 'none'), r('needs_update', 'overdue'), r('upcoming', 'open'), r('held', 'done')])).toEqual({ needsUpdate: 1, missed: 1, upcoming: 1, followUps: 2, overdue: 1 });
  });
});

describe('reschedule template', () => {
  const t = OFFICIAL_TEMPLATES.find((x) => x.id === RESCHEDULE_TEMPLATE_ID)!;
  const a = planFromTemplate(t, briefFromTemplate(t), '3 emails, 3 days apart');
  it('is a short, review-mode, three-email sequence with a WhatsApp button and no blame', () => {
    expect(a.emails).toHaveLength(3); expect(a.sendMode).toBe('review'); expect(a.whatsappActions?.[0].label).toMatch(/WhatsApp/);
    const all = a.emails.map((e) => e.body).join('\n');
    expect(all).not.toMatch(/you (failed|forgot|ignored|did not show)|no[- ]show|last chance|urgent/i);
    expect(all).toContain('no thanks');
  });
});
