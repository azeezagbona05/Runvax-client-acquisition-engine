// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import ImportPanel from '@/app/acquisition/_components/ImportPanel';
import ProspectDetail, { type Detail } from '@/app/acquisition/_components/ProspectDetail';
import { scoreText, valueText, BASIS_STYLE } from '@/app/acquisition/_components/format';
import DraftReview from '@/app/acquisition/_components/DraftReview';
import PitchPanel from '@/app/acquisition/_components/PitchPanel';

afterEach(() => cleanup());

// jsdom 27 lacks Blob#text(), which every current browser supports.
if (typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function text(this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsText(this);
    });
  };
}

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

describe('format helpers', () => {
  it('always labels scores as estimates', () => {
    expect(scoreText(62)).toBe('62 / 100 (estimate)');
    expect(scoreText(null)).toBe('Not scored');
    expect(valueText(false)).toBe('no');
    expect(Object.keys(BASIS_STYLE)).toEqual(['observed', 'inferred', 'unknown']);
  });
});

describe('ImportPanel', () => {
  it('previews first, and only commits after the attestation box is ticked', async () => {
    const fetchMock = vi.fn((url: string) => url.endsWith('/commit')
      ? json({ created: 1, skipped: 0 })
      : json({
        batchId: 'b1', status: 'previewed', rowCount: 3, accepted: 1, duplicates: 1, rejected: 1,
        results: [
          { row: 2, outcome: 'accepted', businessName: 'Smile Dental', reasons: [], flags: ['crm_conflict:already_in_crm'] },
          { row: 3, outcome: 'duplicate', businessName: 'Smile Dental', reasons: ['same clinic as row 2 in this file'], flags: [] },
          { row: 4, outcome: 'rejected', businessName: 'Copied Clinic', reasons: ['source is Google Maps / Places — that content may not be stored'], flags: [] },
        ],
      }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<ImportPanel industryKey="dental" />);

    const file = new File(['business_name,source\nSmile Dental,Expo'], 'clinics.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText('CSV file'), { target: { files: [file] } });
    const previewBtn = screen.getByRole('button', { name: /preview/i }) as HTMLButtonElement;
    await waitFor(() => expect(previewBtn.disabled).toBe(false)); // file text has been read
    fireEvent.click(previewBtn);

    await waitFor(() => expect(screen.getByTestId('preview-summary').textContent).toMatch(/Nothing has been created yet/));
    expect(screen.getByText(/crm_conflict:already_in_crm/)).toBeTruthy();
    expect(screen.getByText(/Google Maps \/ Places/)).toBeTruthy();

    const create = screen.getByRole('button', { name: /create 1 prospect/i }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.click(create);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no commit without attestation
    fireEvent.click(screen.getByLabelText('Attest lawful source'));
    expect(create.disabled).toBe(false);
    fireEvent.click(create);
    await waitFor(() => expect(screen.getByText(/Created 1 prospect/)).toBeTruthy());
    expect(fetchMock.mock.calls[1][0]).toBe('/api/acquisition/imports/b1/commit');
    expect(JSON.parse(((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1]).body as string)).toEqual({ attest: true });
  });
});

const DETAIL: Detail = {
  prospect: { id: 'ap1', name: 'Coral Teeth Clinic', website: 'https://coralteeth-s2.ng', state: 'strategized', area: 'Ikeja GRA', crmConflict: null },
  sources: [{ id: 's1', kind: 'website', method: 'fetcher', url: 'https://coralteeth-s2.ng/', httpStatus: 200, fetchedAt: '2026-10-14T10:00:00Z' }],
  signals: [
    { id: 'g1', code: 'online_booking_present', value: false, basis: 'observed', confidence: 'medium', method: 'html_rule', sourceUrl: 'https://coralteeth-s2.ng/', evidenceQuote: 'not found on 2 fetched page(s)', lastVerifiedAt: '2026-10-14T10:00:00Z', supersededAt: null },
    { id: 'g2', code: 'appointment_driven', value: true, basis: 'inferred', confidence: 'medium', method: 'industry_config', sourceUrl: null, evidenceQuote: 'industry assumption', lastVerifiedAt: '2026-10-14T10:00:00Z', supersededAt: null },
    { id: 'g3', code: 'pagespeed_mobile_poor', value: null, basis: 'unknown', confidence: 'low', method: 'psi_api', sourceUrl: null, evidenceQuote: 'PageSpeed not checked', lastVerifiedAt: '2026-10-14T10:00:00Z', supersededAt: null },
  ],
  findings: [{ id: 'f1', polarity: 'weakness', category: 'booking_friction', finding: 'online_booking_present = false', basis: 'observed', evidence: 'not found', impactHypothesis: 'Booking may take more effort.', validationQuestion: 'How do patients book appointments today?' }],
  scores: [{
    total: 41, band: 'medium', coverage: 0.6667, contactability: 'role_inbox', eligible: true, scoreVersion: 'acq-score-v1', configVersion: 2, computedAt: '2026-10-14T10:00:00Z',
    eligibility: [{ check: 'geography', pass: true, detail: 'area "Ikeja GRA"' }],
    breakdown: [{ id: 'booking_friction', label: 'Appointment booking friction', weight: 0.2, provisional: true, points: 13.8, rules: [{ signal: 'online_booking_present', when: false, weight: 0.7, basis: 'observed', value: false, confidence: 'medium', freshness: 1, fired: true, contribution: 0.49 }] }],
  }],
  recommendation: { primaryOfferId: 'ai_receptionist', secondaryOfferId: 'ai_voice_agent', offerStatusAtTime: 'unconfigured', confidence: 'high', rationale: 'Internal: offer not yet approved for sale.\nAppointment booking friction: …', missingInfo: ['Validate: How do patients book appointments today?'] },
  contacts: [{ id: 'c1', kind: 'role_inbox', email: 'reception@coralteeth-s2.ng', confidence: 'high', sourceUrl: 'https://coralteeth-s2.ng/', lawfulBasis: 'legitimate_interest_b2b', flags: null }],
  events: [{ id: 'e1', createdAt: '2026-10-14T10:00:00Z', fromState: 'audited', toState: 'strategized', actor: 'strategy', reason: 'Scored 41 (estimate, medium)' }],
  tasks: [],
  labels: { scoreIsEstimate: true, offerNotice: 'Internal: offer not yet approved for sale' },
};

describe('ImportPanel (repeat upload)', () => {
  it('says so when an identical file was already imported, instead of "nothing has been created yet"', async () => {
    const fetchMock = vi.fn(() => json({ batchId: 'b1', status: 'committed', rowCount: 1, accepted: 1, duplicates: 0, rejected: 0, results: [{ row: 2, outcome: 'accepted', businessName: 'Coral', reasons: [], flags: [] }] }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<ImportPanel industryKey="dental" />);
    const file = new File(['business_name,source\nCoral,test'], 'again.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText('CSV file'), { target: { files: [file] } });
    await waitFor(() => expect((screen.getByRole('button', { name: 'Preview' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(screen.getByTestId('preview-summary').textContent).toMatch(/already imported.*nothing was re-checked/));
    expect(screen.getByTestId('preview-summary').textContent).not.toMatch(/Nothing has been created yet/);
    expect(screen.queryByRole('button', { name: /Create/ })).toBeNull();
  });
});

describe('ProspectDetail', () => {
  it('labels the score as an estimate, shows the not-for-sale notice and basis badges', () => {
    render(<ProspectDetail detail={DETAIL} />);
    expect(screen.getByTestId('score').textContent).toMatch(/41 \/ 100 \(estimate\)/);
    expect(screen.getByRole('note').textContent).toMatch(/Internal: offer not yet approved for sale/);
    expect(screen.getByRole('note').textContent).toMatch(/Nothing is sent from this page: pitches are generated for human review only/);
    const signals = within(screen.getByRole('table', { name: 'Signals' }));
    expect(signals.getByText('Observed')).toBeTruthy();
    expect(signals.getByText('Inferred')).toBeTruthy();
    expect(signals.getByText('Unknown')).toBeTruthy();
    expect(screen.getByText(/AI Receptionist/)).toBeTruthy();
    expect(screen.getByText(/Nothing from Google Places is stored/)).toBeTruthy();
  });

  it('has no outreach controls at all', () => {
    render(<ProspectDetail detail={DETAIL} />);
    const labels = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) expect(l).not.toMatch(/send|email|whatsapp|draft|compose|message|follow.?up|contact them|call/i);
  });

  it('actions ask for a reason and send it with the request', async () => {
    const fetchMock = vi.fn(() => json({ ok: true }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.spyOn(window, 'prompt').mockReturnValueOnce(null).mockReturnValueOnce('not a dental clinic');
    render(<ProspectDetail detail={DETAIL} />);
    fireEvent.click(screen.getByRole('button', { name: 'Disqualify' }));
    expect(fetchMock).not.toHaveBeenCalled(); // cancelled prompt → nothing sent
    fireEvent.click(screen.getByRole('button', { name: 'Disqualify' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({ action: 'disqualify', reason: 'not a dental clinic' });
  });
});

const DRAFT_DETAIL = {
  draft: {
    id: 'd1', status: 'approved', statusReason: null, version: 1, channel: 'email', subject: 'Coral: a question',
    body: "Hello Coral team,\n\nWhen I looked at coral.ng on 13 October 2026, I couldn't find an enquiry form.", offerId: 'ai_receptionist',
    evidenceHash: 'e'.repeat(64), offerHash: 'o'.repeat(64), offerConfigVersion: 1, industryConfigVersion: 2,
    readiness: { ready: false, blockers: [{ code: 'offer_unconfigured', detail: 'not approved' }], deferred: ['live_sending_disabled'], checkedAt: '2026-10-14T10:00:00Z' },
    bodyHash: 'b'.repeat(64), wordCount: 20, createdAt: '2026-10-14T10:00:00Z', updatedAt: '2026-10-14T10:00:00Z',
  },
  prospect: { id: 'ap1', name: 'Coral', state: 'approved', domain: 'coral.ng' },
  offer: { id: 'ai_receptionist', name: 'AI Receptionist', status: 'unconfigured', approvalState: 'proposed_unapproved', pricingStatus: 'unapproved', sellable: false },
  recipient: { id: 'dm1', kind: 'role_inbox', name: null, email: 'info@coral.ng' },
  evidence: {
    observed: [{ signalId: 's1', findingIds: ['f1'], code: 'contact_form_present', value: false, basis: 'observed', confidence: 'high', sourceUrl: 'https://coral.ng/', quote: 'not found on 2 pages', observedAt: '2026-10-13T10:00:00Z', sentence: "I couldn't find an enquiry form", needsReverify: false, current: true }],
    inferred: [{ signalId: 's2', code: 'appointment_driven', value: true, basis: 'inferred', note: 'Inferred' }],
    unknown: [{ signalId: null, code: 'chat_widget_present', value: null, basis: 'unknown', note: 'No evidence recorded' }],
  },
  warnings: [], history: [{ id: 'h1', action: 'approve', actor: 'reviewer@h.test', note: null, at: '2026-10-14T10:00:00Z', bodyHashAfter: 'b'.repeat(64), evidenceHash: 'e'.repeat(64) }],
  outcomes: [], validity: { valid: true, reasons: [] },
};

describe('DraftReview', () => {
  it('shows the evidence behind each statement, separated into observed / inferred / unknown, and the not-sellable notice', () => {
    render(<DraftReview detail={DRAFT_DETAIL} />);
    const cited = within(screen.getByRole('table', { name: 'Cited evidence' }));
    expect(cited.getByText("“I couldn't find an enquiry form”")).toBeTruthy();
    expect(cited.getByText(/contact_form_present = no/)).toBeTruthy();
    expect(cited.getByText('https://coral.ng/', { exact: false })).toBeTruthy();
    expect(screen.getByText(/Inferred — not stated in the text/)).toBeTruthy();
    expect(screen.getByText(/Unknown — not stated in the text/)).toBeTruthy();
    expect(screen.getByRole('note').textContent).toMatch(/not approved for sale.*cannot be marked ready/);
    expect(screen.getByText(/reviewer@h.test/)).toBeTruthy();
  });

  it('offers review actions but no control that delivers anything', () => {
    render(<DraftReview detail={DRAFT_DETAIL} />);
    const labels = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    expect(labels).toEqual(expect.arrayContaining(['Edit', 'Mark ready', 'Reject', 'Record outcome']));
    for (const l of labels) expect(l).not.toMatch(/^send|send now|deliver|whatsapp|email it|follow.?up|schedule/i);
  });

  it('shows refusals with their reasons instead of hiding them', async () => {
    const fetchMock = vi.fn(() => json({ ok: false, blockers: [{ code: 'offer_unconfigured', detail: 'AI Receptionist has no approved description' }] }, 422));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<DraftReview detail={DRAFT_DETAIL} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark ready' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/offer_unconfigured/));
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({ action: 'mark_ready' });
  });

  it('passes the confirmation up so it survives the reload, and disables actions while a request is in flight', async () => {
    let release: (r: Response) => void = () => {};
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { release = resolve; }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const onChanged = vi.fn();
    render(<DraftReview detail={{ ...DRAFT_DETAIL, draft: { ...DRAFT_DETAIL.draft, status: 'pending_approval' } }} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Approve wording' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect((screen.getByRole('button', { name: 'Approve wording' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Edit' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Approve wording' })); // a second click does nothing
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release(new Response(JSON.stringify({ ok: true, status: 'approved' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('approve: approved'));
  });

  it('shows a flash message and an empty-history note', () => {
    render(<DraftReview detail={{ ...DRAFT_DETAIL, history: [] }} flash="Outcome recorded: opt_out → prospect suppressed (suppressed: email, domain)" />);
    expect(screen.getByRole('status').textContent).toMatch(/suppressed: email, domain/);
    expect(screen.getByText('No decisions recorded yet.')).toBeTruthy();
  });

  it('flags a draft whose evidence changed', () => {
    render(<DraftReview detail={{ ...DRAFT_DETAIL, validity: { valid: false, reasons: [{ code: 'evidence_changed', detail: '1 cited signal(s) were superseded' }] } }} />);
    expect(screen.getAllByRole('alert')[0].textContent).toMatch(/no longer matches its evidence[\s\S]*evidence_changed/);
  });
});

describe('ProspectDetail pitch panel', () => {
  it('generating a pitch that is refused shows the reasons; no delivery control exists', async () => {
    const fetchMock = vi.fn(() => json({ ok: false, reasons: [{ code: 'insufficient_evidence', detail: 'found 0' }] }, 422));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<ProspectDetail detail={DETAIL} />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate pitch for review' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/insufficient_evidence/));
    expect(screen.getByRole('button', { name: 'Save evidence' }).hasAttribute('disabled')).toBe(true); // attestation required
  });
});

const READINESS_BLOCKED = {
  canGenerate: false, canBeMarkedReady: false,
  helpfulSignals: ['online_booking_present', 'contact_form_present'],
  checks: [
    { label: 'Clinic is eligible and in a pitchable state', ok: true, blocking: true, detail: 'State: strategized' },
    { label: 'An offer is recommended', ok: false, blocking: true, detail: 'No offer has been recommended for this prospect' },
    { label: 'At least 1 fresh, observed weakness for that offer', ok: false, blocking: true, detail: 'found 0' },
    { label: 'Offer is approved for sale', ok: false, blocking: false, detail: 'AI Receptionist is not approved: a pitch can be reviewed but never marked ready' },
  ],
};

describe('PitchPanel: readiness and one-step evidence', () => {
  it('shows what is in place and what is missing before anyone clicks Generate', () => {
    render(<PitchPanel prospectId="ap1" domain="coral.ng" readiness={READINESS_BLOCKED} />);
    const box = within(screen.getByLabelText('Pitch readiness'));
    expect(box.getByText(/can’t be generated yet/)).toBeTruthy();
    expect(box.getByText(/An offer is recommended/).closest('li')!.textContent).toMatch(/Missing:/);
    expect(box.getByText(/Clinic is eligible/).closest('li')!.textContent).toMatch(/OK:/);
    expect(box.getByText(/Offer is approved for sale/).closest('li')!.textContent).toMatch(/Note:/); // informational, not a blocker
    expect(box.getByText(/Evidence that would help: Online appointment booking, Enquiry \/ contact form/)).toBeTruthy(); // human labels, matching the checklist
  });

  it('says a pitch can be generated, and warns it cannot be marked ready while the offer is unapproved', () => {
    render(<PitchPanel prospectId="ap1" domain="coral.ng" readiness={{ ...READINESS_BLOCKED, canGenerate: true, helpfulSignals: [], checks: READINESS_BLOCKED.checks.map((c) => ({ ...c, ok: c.blocking })) }} />);
    expect(screen.getByText('A pitch can be generated now.')).toBeTruthy();
    expect(screen.getByText(/not marked ready until the offer is approved for sale/)).toBeTruthy();
  });

  it('records several observations in ONE request, only the ones that were checked', async () => {
    const fetchMock = vi.fn(() => json({ ok: true, signals: [{ code: 'online_booking_present' }, { code: 'chat_widget_present' }], invalidatedDrafts: 0 }, 201));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const onChanged = vi.fn();
    render(<PitchPanel prospectId="ap1" domain="coral.ng" readiness={READINESS_BLOCKED} onChanged={onChanged} />);
    const save = () => screen.getByRole('button', { name: /^Save evidence/ }) as HTMLButtonElement;
    expect(save().disabled).toBe(true); // nothing checked, no note, no attestation
    fireEvent.change(screen.getByLabelText('Online appointment booking'), { target: { value: 'no' } });
    fireEvent.change(screen.getByLabelText('Chat widget'), { target: { value: 'yes' } });
    fireEvent.change(screen.getByLabelText(/What you saw/), { target: { value: 'Header and contact page checked' } });
    expect(save().disabled).toBe(true); // still needs the attestation
    fireEvent.click(screen.getByLabelText(/I observed this myself/));
    expect(save().textContent).toBe('Save evidence (2)');
    fireEvent.click(save());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/acquisition/prospects/ap1/evidence');
    expect(JSON.parse(init.body as string)).toEqual({
      items: [{ code: 'online_booking_present', value: false }, { code: 'chat_widget_present', value: true }],
      sourceUrl: 'https://coral.ng/', note: 'Header and contact page checked', confidence: 'medium', attest: true,
    });
    await waitFor(() => expect(screen.getByText(/2 observations recorded/)).toBeTruthy());
    expect(onChanged).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Run queue now' })).toBeTruthy();
  });

  it('has no control that delivers anything', () => {
    render(<PitchPanel prospectId="ap1" domain="coral.ng" readiness={READINESS_BLOCKED} />);
    for (const b of screen.getAllByRole('button')) expect(b.textContent ?? '').not.toMatch(/^send|deliver|whatsapp|email it|follow.?up/i);
  });
});
