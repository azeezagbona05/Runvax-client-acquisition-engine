/**
 * Baseline: pins existing opportunity detection, the existing (advisory)
 * outreach quality gate and plan→feature gating. The acquisition engine reads
 * these but must not change them.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Business } from '@/types';
import { detectOpportunities } from '@/lib/opportunity/detect';
import { runQualityGate } from '@/lib/outreach/quality-gate';
import { defaultFeaturesFor, parseFeatures, serializeFeatures, resolveFeatures, planHasFeature } from '@/lib/features';
import type { ProspectContext } from '@/lib/outreach/types';

const biz = (over: Partial<Business> = {}): Business => ({
  id: 'b1', name: 'Smile Dental Clinic', address: 'Lekki, Lagos', hasWebsite: false, category: 'Dentist',
  categoryTypes: ['dentist'], phone: '08031234567', rating: 4.6, reviewCount: 58, ...over,
});

describe('detectOpportunities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T09:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('is deterministic for a dental clinic with no website', () => {
    const r = detectOpportunities(biz());
    expect(r.primary).not.toBeNull();
    expect(r.all.map((o) => o.type)).toContain('website');
    expect({
      primary: r.primary && { type: r.primary.type, title: r.primary.title, score: r.primary.score, confidence: r.primary.confidence },
      all: r.all.map((o) => ({ type: o.type, score: o.score })),
      signals: r.signals.map((s) => s.code).sort(),
    }).toMatchSnapshot();
  });

  it('is deterministic for a dental clinic that has a website', () => {
    const r = detectOpportunities(biz({ hasWebsite: true, website: 'https://smiledental.ng' }));
    expect(r.all.map((o) => o.type)).not.toContain('website');
    expect({
      primary: r.primary && { type: r.primary.type, score: r.primary.score },
      signals: r.signals.map((s) => s.code).sort(),
    }).toMatchSnapshot();
  });

  it('ranks the seller’s own offer first', () => {
    const r = detectOpportunities(biz(), 'ai_system');
    if (r.all.some((o) => o.type === 'ai_system')) expect(r.primary?.type).toBe('ai_system');
  });
});

describe('runQualityGate (existing, advisory)', () => {
  const ctx = { businessName: 'Smile Dental', country: 'NG', channel: 'whatsapp' } as ProspectContext;

  it('fails on an unfilled placeholder but only reports it', () => {
    const r = runQualityGate({ whatsapp: 'Hi [OWNER NAME], quick question for you?' }, ctx);
    expect(r.pass).toBe(false);
    expect(r.notes.join(' ')).toContain('unfilled placeholder');
  });

  it('fails a WhatsApp message with no CTA question', () => {
    const r = runQualityGate({ whatsapp: 'Hello, we build websites for clinics.' }, ctx);
    expect(r.pass).toBe(false);
    expect(r.notes.join(' ')).toContain('no CTA question');
  });

  it('flags a wrong currency on a price mention', () => {
    const r = runQualityGate({ whatsapp: 'It costs $200 per month. Interested?' }, ctx);
    expect(r.pass).toBe(false);
    expect(r.notes.join(' ')).toContain('wrong currency');
  });
});

describe('features', () => {
  it('free has nothing, pro/agency have everything, custom paid plans get everything', () => {
    expect(defaultFeaturesFor('free')).toEqual([]);
    expect(defaultFeaturesFor(null)).toEqual([]);
    expect(defaultFeaturesFor('pro')).toEqual(['emailBlast', 'proposals', 'marketBrief', 'weaknessAnalysis']);
    expect(defaultFeaturesFor('enterprise')).toHaveLength(4);
  });

  it('round-trips the stored CSV and distinguishes NULL from empty', () => {
    expect(parseFeatures('proposals, bogus ,emailBlast')).toEqual(['proposals', 'emailBlast']);
    expect(serializeFeatures(['proposals', 'emailBlast'])).toBe('emailBlast,proposals');
    expect(resolveFeatures('pro', null)).toHaveLength(4);
    expect(resolveFeatures('pro', '')).toEqual([]);
    expect(planHasFeature('free', 'proposals')).toBe(false);
  });
});
