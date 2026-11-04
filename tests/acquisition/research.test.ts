import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rows, seed } from '../helpers/fakePrisma';
import { fakeDeps, CRAWLER_ENV } from '../helpers/fakeWeb';
import { S1, S2, S3, S15, allResponses } from '../fixtures/sites';
import { extractSite, decodeCfEmail, looksJsRendered } from '@/lib/acquisition/web/extract';
import { computeScore, mapOffers, freshnessFactor, SCORE_VERSION, type ScoringSignal } from '@/lib/acquisition/scoring';
import { __setResearchDeps, strategize } from '@/lib/acquisition/research/handlers';
import { previewImport, commitImport } from '@/lib/acquisition/imports/service';
import { drainAcqTasks } from '@/lib/acquisition/tasks/queue';
import { acqHandlers } from '@/lib/acquisition/tasks/handlers';
import { eraseContacts } from '@/lib/acquisition/contacts';
import { dental } from '@/lib/acquisition/config/industries/dental';

const HEADER = 'business_name,source,website,area,city';
const SRC = 'Synthetic fixture list';

async function importClinics(list: Array<{ name: string; website?: string; area?: string }>) {
  const text = [HEADER, ...list.map((c) => `${c.name},${SRC},${c.website ?? ''},${c.area ?? 'Lekki'},Lagos`)].join('\n');
  const p = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: text });
  return commitImport({ userId: 'u1', batchId: p.batchId, attestedBy: 'admin@h.test', attest: true });
}

async function drainAll() {
  let total = { claimed: 0, completed: 0, skipped: 0, retried: 0, dead: 0, deferred: 0 };
  for (let i = 0; i < 10; i++) {
    const r = await drainAcqTasks({ budget: 50 });
    total = { claimed: total.claimed + r.claimed, completed: total.completed + r.completed, skipped: total.skipped + r.skipped, retried: total.retried + r.retried, dead: total.dead + r.dead, deferred: total.deferred + r.deferred };
    if (r.claimed === 0) break;
  }
  return total;
}

const page = (site: { responses: object }, url: string) => ({ url, html: (site.responses as Record<string, { body?: string }>)[url].body! });

beforeEach(() => {
  process.env.INDUSTRY_ACQUISITION_ENABLED = 'true';
  Object.assign(process.env, CRAWLER_ENV);
});
afterEach(() => {
  __setResearchDeps(null);
  delete process.env.INDUSTRY_ACQUISITION_ENABLED;
  delete process.env.IA_CRAWLER_ENABLED;
  delete process.env.IA_CRAWLER_POLICY_URL;
});

describe('extractors (deterministic, no AI)', () => {
  it('S1: modern site → presence signals with quotes and URLs', () => {
    const ex = extractSite([page(S1, 'https://pearlsmile-s1.ng/'), page(S1, 'https://pearlsmile-s1.ng/contact')], dental, 'https://pearlsmile-s1.ng/');
    const v = Object.fromEntries(ex.signals.map((s) => [s.code, s.value]));
    expect(v).toMatchObject({
      online_booking_present: true, whatsapp_entry_point: true, chat_widget_present: true, click_to_call: true,
      contact_form_present: true, structured_data_dentist: true, mobile_viewport: true, https: true,
      service_pages: true, opening_hours_published: true, business_name: 'Pearl Smile Dental', business_address: '12 Fixture Way, Lekki',
    });
    expect(ex.signals.every((s) => s.sourceUrl.startsWith('https://pearlsmile-s1.ng/') && s.quote.length > 0 && s.quote.length <= 300)).toBe(true);
    expect(ex.roleInboxes.map((r) => r.email)).toEqual(['info@pearlsmile-s1.ng']);
    expect(ex.phones.map((p) => p.phone)).toContain('2348000000101');
  });

  it('S2: phone-only site → observed absences', () => {
    const ex = extractSite([page(S2, 'https://coralteeth-s2.ng/'), page(S2, 'https://coralteeth-s2.ng/about')], dental, 'https://coralteeth-s2.ng/');
    const get = (c: string) => ex.signals.find((s) => s.code === c)!;
    expect(get('online_booking_present')).toMatchObject({ value: false, basis: 'observed', confidence: 'medium' });
    expect(get('contact_form_present')).toMatchObject({ value: false, basis: 'observed' });
    expect(get('whatsapp_entry_point')).toMatchObject({ value: false, basis: 'observed' });
    expect(get('click_to_call')).toMatchObject({ value: true, basis: 'observed', confidence: 'high' });
    expect(get('structured_data_dentist')).toMatchObject({ value: false });
    expect(ex.roleInboxes.map((r) => r.email)).toEqual(['reception@coralteeth-s2.ng']);
  });

  it('S3: JavaScript-only shell → absences become unknown, never "absent"', () => {
    expect(looksJsRendered(S3.responses['https://glowdental-s3.ng/'].body)).toBe(true);
    const ex = extractSite([page(S3, 'https://glowdental-s3.ng/')], dental, 'https://glowdental-s3.ng/');
    const absences = ex.signals.filter((s) => s.code !== 'https');
    expect(absences.length).toBeGreaterThan(0);
    expect(absences.every((s) => s.basis === 'unknown' && s.value === null)).toBe(true);
  });

  it('S15: Cloudflare-protected role inbox is stored; named and third-party addresses are not', () => {
    const ex = extractSite([page(S15, 'https://bluecrest-s15.ng/')], dental);
    expect(ex.roleInboxes.map((r) => r.email)).toEqual([S15.cfInbox]);
    expect(ex.namedEmailCount).toBe(1);
    expect(JSON.stringify(ex)).not.toContain('dr.adeyemi');
    expect(JSON.stringify(ex)).not.toContain('webagency-fixture');
    expect(decodeCfEmail('zz')).toBeNull();
  });
});

const sig = (code: string, value: unknown, basis: ScoringSignal['basis'] = 'observed', confidence: ScoringSignal['confidence'] = 'high', days = 0): ScoringSignal => ({
  id: `s_${code}`, code, value, basis, confidence, lastVerifiedAt: new Date(Date.UTC(2026, 9, 14) - days * 86_400_000), sourceUrl: 'https://x.ng/', evidenceQuote: 'q',
});
const NOW = new Date(Date.UTC(2026, 9, 14));
const ELIGIBLE = [{ check: 'geography', pass: true, detail: '' }];

describe('deterministic scoring', () => {
  const s2Signals = [
    sig('online_booking_present', false, 'observed', 'medium'), sig('click_to_call', true), sig('booking_cta_to_form', false, 'observed', 'medium'),
    sig('contact_form_present', false, 'observed', 'medium'), sig('whatsapp_entry_point', false, 'observed', 'medium'),
    sig('chat_widget_present', false, 'observed', 'medium'), sig('structured_data_dentist', false, 'observed', 'medium'),
    sig('service_pages', true, 'observed', 'medium'), sig('opening_hours_published', true, 'observed', 'medium'),
    sig('mobile_viewport', true), sig('https', true), sig('website_present', true), sig('appointment_driven', true, 'inferred', 'medium'),
    sig('pagespeed_mobile_poor', null, 'unknown', 'low'),
  ];

  it('worked example (plan §6): S2 booking friction = 0.69 → 13.8 points', () => {
    const r = computeScore({ industry: dental, signals: s2Signals, contacts: [{ kind: 'role_inbox', flags: null }], eligibility: ELIGIBLE, now: NOW });
    const booking = r.categories.find((c) => c.id === 'booking_friction')!;
    expect(booking.score).toBe(0.69);
    expect(booking.points).toBe(13.8);
    expect(r.scoreVersion).toBe(SCORE_VERSION);
  });

  it('the breakdown recomputes to the stored total exactly; same inputs → same output and hash', () => {
    const a = computeScore({ industry: dental, signals: s2Signals, contacts: [], eligibility: ELIGIBLE, now: NOW });
    const b = computeScore({ industry: dental, signals: [...s2Signals].reverse(), contacts: [], eligibility: ELIGIBLE, now: NOW });
    const c = computeScore({ industry: dental, signals: s2Signals, contacts: [], eligibility: ELIGIBLE, now: NOW });
    expect(Math.round(a.categories.reduce((s, x) => s + x.points, 0))).toBe(a.total);
    for (const cat of a.categories) {
      const raw = cat.rules.reduce((s, r) => s + r.contribution, 0);
      expect(cat.score).toBe(Math.round(Math.min(1, Math.max(0, raw)) * 10_000) / 10_000);
    }
    expect(b).toEqual(a);
    expect(c.inputHash).toBe(a.inputHash);
  });

  it('unknown and inferred evidence count less; unknown never fires a rule', () => {
    const unknown = computeScore({ industry: dental, signals: [sig('online_booking_present', null, 'unknown', 'low')], contacts: [], eligibility: ELIGIBLE, now: NOW });
    expect(unknown.categories.find((c) => c.id === 'booking_friction')!.score).toBe(0);
    const inferred = computeScore({ industry: dental, signals: [sig('website_present', false, 'inferred', 'low')], contacts: [], eligibility: ELIGIBLE, now: NOW });
    expect(inferred.categories.find((c) => c.id === 'search_visibility')!.rules[0].contribution).toBe(Math.round(0.6 * 0.4 * 0.4 * 10_000) / 10_000);
    expect(inferred.coverage).toBe(0); // inferred evidence never counts as coverage
  });

  it('S16: freshness — 100 days = 0.5, 200 days = stale (0) and reported for re-verification', () => {
    expect(freshnessFactor(new Date(NOW.getTime() - 100 * 86_400_000), NOW, dental.retention)).toBe(0.5);
    expect(freshnessFactor(new Date(NOW.getTime() - 200 * 86_400_000), NOW, dental.retention)).toBe(0);
    const r = computeScore({ industry: dental, signals: [sig('online_booking_present', false, 'observed', 'medium', 100), sig('click_to_call', true, 'observed', 'high', 200)], contacts: [], eligibility: ELIGIBLE, now: NOW });
    const rules = r.categories.find((c) => c.id === 'booking_friction')!.rules;
    expect(rules[0]).toMatchObject({ freshness: 0.5, contribution: 0.245 });
    expect(rules[1]).toMatchObject({ freshness: 0, fired: false, contribution: 0 });
    expect(r.staleSignalIds).toEqual(['s_click_to_call']);
  });

  it('bands: insufficient evidence first; contactability ignores duplicate holders', () => {
    // chat_widget_present feeds only "enquiry handling": coverage 1/6 < 0.34.
    const r = computeScore({ industry: dental, signals: [sig('chat_widget_present', false)], contacts: [{ kind: 'role_inbox', flags: { duplicateOf: 'other' } }], eligibility: ELIGIBLE, now: NOW });
    expect(r.coverage).toBe(0.1667);
    expect(r.band).toBe('insufficient_evidence');
    expect(r.contactability).toBe('none');
  });

  it('offer mapping is deterministic, evidence-backed and labelled not-for-sale', () => {
    const r = computeScore({ industry: dental, signals: s2Signals, contacts: [{ kind: 'role_inbox', flags: null }], eligibility: ELIGIBLE, now: NOW });
    const rec = mapOffers(dental, r);
    expect(['ai_receptionist', 'ai_voice_agent', 'ai_visibility_agent', 'ai_follow_up_agent']).toContain(rec.primaryOfferId);
    expect(rec.label).toBe('Internal: offer not yet approved for sale');
    expect(rec.offerStatus).toBe('unconfigured');
    expect(rec.rationale).toContain('online_booking_present=false (observed, medium, https://x.ng/)');
    expect(rec.rationale).not.toMatch(/₦|\$|price|guarantee|%/i);
    expect(mapOffers(dental, r)).toEqual(rec);
    const none = mapOffers(dental, computeScore({ industry: dental, signals: [], contacts: [], eligibility: ELIGIBLE, now: NOW }));
    expect(none.primaryOfferId).toBe('none');
  });
});

describe('S20: full research chain on synthetic clinics', () => {
  it('ends at strategized / needs_review with provenance, scores and internal recommendations — and no outreach', async () => {
    const { deps, requests } = fakeDeps({ responses: allResponses() });
    __setResearchDeps({ fetchDeps: deps });
    seed('prospect', { id: 'crm9', userId: 'u1', businessId: 'ChIJcrmcrmcrmcrmcrm99', businessName: 'Pearl Smile Dental Old', businessData: { website: 'https://pearlsmile-s1.ng' }, outreachSentAt: new Date(), source: 'campaign' });

    await importClinics([
      { name: 'Pearl Smile Dental', website: `https://${S1.domain}` },
      { name: 'Coral Teeth Clinic', website: `https://${S2.domain}`, area: 'Ikeja GRA' },
      { name: 'Glow Dental', website: `https://${S3.domain}` },
      { name: 'Bluecrest Dental', website: `https://${S15.domain}` },
      { name: 'Ivory Dental No Site' },
    ]);
    const t = await drainAll();
    expect(t.retried + t.dead).toBe(0);

    const states = Object.fromEntries(rows('acquisitionProspect').map((a) => [rows('prospect').find((p) => p.id === a.prospectId)!.businessName, a.state]));
    expect(states).toEqual({
      'Pearl Smile Dental': 'needs_review',   // already contacted in the CRM
      'Coral Teeth Clinic': 'strategized',
      'Glow Dental': 'strategized',
      'Bluecrest Dental': 'strategized',
      'Ivory Dental No Site': 'strategized',
    });

    // Provenance: every signal has basis, method, confidence and an observation time; website signals carry a URL.
    for (const s of rows('acquisitionSignal')) {
      expect(['observed', 'inferred', 'unknown']).toContain(s.basis);
      expect(s.method).toBeTruthy();
      expect(s.confidence).toBeTruthy();
      expect(s.observedAt).toBeInstanceOf(Date);
      if (s.method === 'html_rule') expect(String(s.sourceUrl)).toMatch(/^https:\/\/[a-z0-9-]+\.ng\//);
    }
    // Scores: one per prospect, breakdown sums to total.
    expect(rows('acquisitionScore')).toHaveLength(5);
    for (const sc of rows('acquisitionScore')) {
      const cats = sc.breakdown as Array<{ points: number }>;
      expect(Math.round(cats.reduce((s, c) => s + c.points, 0))).toBe(sc.total);
    }
    // S3 → insufficient evidence; recommendations all internal / unconfigured.
    const s3 = rows('acquisitionProspect').find((a) => a.orgDomain === S3.domain)!;
    expect(rows('acquisitionScore').find((s) => s.acqProspectId === s3.id)!.band).toBe('insufficient_evidence');
    expect(rows('acquisitionRecommendation')).toHaveLength(5);
    expect(rows('acquisitionRecommendation').every((r) => String(r.rationale).startsWith('Internal: offer not yet approved for sale'))).toBe(true);
    // Contacts: only role inboxes / business phones, no names.
    expect(rows('acquisitionDecisionMaker').every((d) => d.kind !== 'manual_named' && d.name === null)).toBe(true);
    expect(rows('acquisitionDecisionMaker').some((d) => d.email === S15.cfInbox)).toBe(true);
    expect(JSON.stringify(rows('acquisitionDecisionMaker'))).not.toContain('dr.adeyemi');

    // Boundaries: no drafts, no outreach tasks, no model runs, no live network.
    expect(rows('acquisitionDraft')).toHaveLength(0);
    expect(rows('acquisitionTask').filter((x) => !['acq.research_contacts', 'acq.audit', 'acq.strategize'].includes(x.type as string))).toHaveLength(0);
    expect(rows('acquisitionAgentRun').every((r) => r.provider == null && r.model == null)).toBe(true);
    expect(requests.every((r) => r.userAgent.startsWith('RunvaxResearchBot/1.0'))).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();

    // S17: re-running every handler and the queue creates nothing new.
    const snapshot = () => ['acquisitionSignal', 'acquisitionFinding', 'acquisitionScore', 'acquisitionRecommendation', 'acquisitionDecisionMaker', 'acquisitionSource', 'acquisitionIdentity', 'prospect', 'acquisitionProspect'].map((t2) => rows(t2).length).join(',');
    const before = snapshot();
    const reqBefore = requests.length;
    for (const a of rows('acquisitionProspect')) {
      for (const type of ['acq.research_contacts', 'acq.audit', 'acq.strategize'] as const) {
        await acqHandlers[type]({ taskId: 't', runId: 'r', userId: 'u1', acqProspectId: a.id as string, input: { industryKey: 'dental' }, attempt: 1, signal: new AbortController().signal });
      }
    }
    await drainAll();
    expect(snapshot()).toBe(before);
    expect(requests.length).toBe(reqBefore); // all from the 24h cache
  });

  it('with the crawler disabled the chain still completes, from import evidence only, without any request', async () => {
    delete process.env.IA_CRAWLER_ENABLED;
    const { deps, requests } = fakeDeps({ responses: allResponses() });
    __setResearchDeps({ fetchDeps: deps });
    await importClinics([{ name: 'Coral Teeth Clinic', website: `https://${S2.domain}` }]);
    await drainAll();
    expect(requests).toHaveLength(0);
    expect(rows('acquisitionProspect')[0].state).toBe('strategized');
    expect(rows('acquisitionScore')[0].band).toBe('insufficient_evidence');
  });

  it('S16: stale evidence queues a re-verification audit', async () => {
    const { deps } = fakeDeps({ responses: allResponses() });
    __setResearchDeps({ fetchDeps: deps });
    await importClinics([{ name: 'Coral Teeth Clinic', website: `https://${S2.domain}` }]);
    await drainAll();
    const acq = rows('acquisitionProspect')[0];
    for (const s of rows('acquisitionSignal')) s.lastVerifiedAt = new Date(Date.now() - 200 * 86_400_000);
    acq.state = 'audited';
    const out = await strategize({ taskId: 't', runId: 'r', userId: 'u1', acqProspectId: acq.id as string, input: { industryKey: 'dental' }, attempt: 1, signal: new AbortController().signal });
    expect(out.next?.[0]).toMatchObject({ type: 'acq.audit', input: { industryKey: 'dental', runKey: expect.stringMatching(/^reverify-\d{4}-\d{2}-\d{2}$/) } });
  });

  it('S18: erasure deletes contacts, tombstones values, purges cached pages and cancels tasks — event has no personal data', async () => {
    const { deps } = fakeDeps({ responses: allResponses() });
    __setResearchDeps({ fetchDeps: deps });
    await importClinics([{ name: 'Coral Teeth Clinic', website: `https://${S2.domain}` }]);
    await drainAcqTasks({ budget: 1 }); // research_contacts only → pages cached, audit pending
    const acq = rows('acquisitionProspect')[0];
    expect(rows('acquisitionDecisionMaker').length).toBeGreaterThan(0);
    expect(rows('acquisitionPageCache').length).toBeGreaterThan(0);

    await eraseContacts({ userId: 'u1', acqProspectId: acq.id as string, reason: 'erasure', actor: 'admin@h.test', domain: S2.domain });
    expect(rows('acquisitionDecisionMaker')).toHaveLength(0);
    expect(rows('acquisitionPageCache').filter((p) => p.domain === S2.domain)).toHaveLength(0);
    expect(rows('acquisitionTask').filter((t2) => t2.status === 'pending')).toHaveLength(0);
    expect(rows('acquisitionSuppression').length).toBeGreaterThanOrEqual(2);
    const ev = rows('acquisitionPipelineEvent').at(-1)!;
    expect(String(ev.reason)).not.toMatch(/reception@|0800|2348/);

    // Re-research can't bring the erased values back.
    await acqHandlers['acq.research_contacts']({ taskId: 't', runId: 'r', userId: 'u1', acqProspectId: acq.id as string, input: { industryKey: 'dental' }, attempt: 1, signal: new AbortController().signal });
    expect(rows('acquisitionDecisionMaker')).toHaveLength(0);
  });
});
