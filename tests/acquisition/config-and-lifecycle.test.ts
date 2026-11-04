import { describe, it, expect } from 'vitest';
import { IndustryConfigSchema } from '@/lib/acquisition/config/schema';
import { dental } from '@/lib/acquisition/config/industries/dental';
import { loadIndustries, getIndustry, getOffer, listIndustries } from '@/lib/acquisition/config/registry';
import { canTransition, allowedTransitions, transitionProspect, STATES, TERMINAL } from '@/lib/acquisition/lifecycle';
import { rows, seed } from '../helpers/fakePrisma';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe('dental industry pack', () => {
  it('validates', () => {
    expect(() => IndustryConfigSchema.parse(dental)).not.toThrow();
    expect(getIndustry('dental')?.displayName).toBe('Dental clinics');
    expect(listIndustries().map((i) => i.id)).toEqual(['dental']);
  });

  it('has the four approved service names, all unconfigured with no commercial details', () => {
    expect(dental.offers.map((o) => o.name)).toEqual(['AI Visibility Agent', 'AI Receptionist', 'AI Voice Agent', 'AI Follow-Up Agent']);
    for (const o of dental.offers) {
      expect(o).toMatchObject({ status: 'unconfigured', description: null, scope: null, price: null, terms: null, approvedClaims: [] });
    }
  });

  it('covers the six dental assessment categories with provisional weights summing to 1', () => {
    expect(dental.opportunityCategories.map((c) => c.id)).toEqual([
      'search_visibility', 'enquiry_conversion', 'booking_friction', 'enquiry_handling', 'voice_handling', 'lead_follow_up',
    ]);
    expect(dental.opportunityCategories.every((c) => c.weightIsProvisional)).toBe(true);
    expect(dental.opportunityCategories.reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1);
  });

  it('keeps businesses with websites in scope', () => {
    expect(dental.discovery.includeBusinessesWithWebsites).toBe(true);
  });

  it('is drafts-only with live sending off', () => {
    expect(dental.compliance).toMatchObject({ approvalRequired: true, autoSend: false, liveSendingEnabled: false, dailySendCap: 0 });
  });

  it('getOffer resolves by id', () => {
    expect(getOffer(dental, 'ai_receptionist')?.name).toBe('AI Receptionist');
    expect(getOffer(dental, 'nope')).toBeNull();
  });
});

describe('config cannot bypass policy', () => {
  const bad = (mutate: (c: Record<string, any>) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const c = clone(dental) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    mutate(c);
    return IndustryConfigSchema.safeParse(c).success;
  };

  it.each([
    ['approval switched off', (c: any) => { c.compliance.approvalRequired = false; }], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['auto-send switched on', (c: any) => { c.compliance.autoSend = true; }], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['unsubscribe dropped', (c: any) => { c.compliance.unsubscribeRequired = false; }], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['send cap while live sending off', (c: any) => { c.compliance.dailySendCap = 50; }], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['unknown key', (c: any) => { c.runBeforeSend = 'rm -rf'; }], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['function value', (c: any) => { c.displayName = () => 'x'; }], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['weights not summing to 1', (c: any) => { c.opportunityCategories[0].weight = 0.9; }], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['category maps to unknown offer', (c: any) => { c.opportunityCategories[0].offerIds = ['ghost']; }], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['approved offer without scope', (c: any) => { c.offers[0].status = 'approved'; c.offers[0].description = 'x'; }], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['non-email channel', (c: any) => { c.outreach.channels = ['whatsapp']; }], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['websites excluded', (c: any) => { c.discovery.includeBusinessesWithWebsites = false; }], // eslint-disable-line @typescript-eslint/no-explicit-any
  ])('rejects: %s', (_name, mutate) => {
    expect(bad(mutate)).toBe(false);
  });

  it('a second industry is just another data pack', () => {
    const derm = { ...clone(dental), id: 'dermatology', displayName: 'Dermatology clinics' };
    const map = loadIndustries([dental, derm]);
    expect(Array.from(map.keys())).toEqual(['dental', 'dermatology']);
  });

  it('rejects duplicate industry ids', () => {
    expect(() => loadIndustries([dental, clone(dental)])).toThrow(/Duplicate/);
  });
});

describe('lifecycle', () => {
  it('follows the brief’s main path', () => {
    const path = ['discovered', 'contacts_researched', 'audited', 'strategized', 'draft_pending_approval', 'approved', 'sent', 'replied', 'qualified', 'proposal', 'won'];
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });

  it('cannot skip human approval', () => {
    expect(canTransition('strategized', 'sent')).toBe(false);
    expect(canTransition('draft_pending_approval', 'sent')).toBe(false);
  });

  it('terminal states have no exits; every live state can be suppressed or cancelled', () => {
    for (const t of TERMINAL) expect(allowedTransitions(t)).toEqual([]);
    for (const s of STATES.filter((x) => !TERMINAL.includes(x))) {
      expect(canTransition(s, 'suppressed')).toBe(true);
      expect(canTransition(s, 'cancelled')).toBe(true);
    }
    expect(canTransition('suppressed', 'sent')).toBe(false);
  });

  it('rejects unknown states', () => {
    expect(canTransition('discovered', 'teleported')).toBe(false);
    expect(canTransition('nope', 'audited')).toBe(false);
  });

  it('transitionProspect records an event and refuses illegal moves', async () => {
    seed('acquisitionProspect', { id: 'ap1', userId: 'u1', state: 'discovered' });
    await transitionProspect({ userId: 'u1', acqProspectId: 'ap1', to: 'contacts_researched', reason: 'found owner', actor: 'contacts' });
    expect(rows('acquisitionProspect')[0].state).toBe('contacts_researched');
    expect(rows('acquisitionPipelineEvent')[0]).toMatchObject({ fromState: 'discovered', toState: 'contacts_researched', actor: 'contacts' });

    await expect(transitionProspect({ userId: 'u1', acqProspectId: 'ap1', to: 'sent', reason: 'x', actor: 'outreach' })).rejects.toThrow(/Illegal/);
    await expect(transitionProspect({ userId: 'other', acqProspectId: 'ap1', to: 'audited', reason: 'x', actor: 'x' })).rejects.toThrow(/not found/);
    expect(rows('acquisitionPipelineEvent')).toHaveLength(1);
  });
});
