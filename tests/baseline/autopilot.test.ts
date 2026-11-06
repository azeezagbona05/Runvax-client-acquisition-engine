import { describe, it, expect } from 'vitest';
import { briefFromText, expandFeature } from '@/lib/campaignBrief';
import { planFromGoal } from '@/lib/campaignBuilder';
import { sanitizeAutomation, simulate, stepCopy, type Automation } from '@/lib/automation';
import { PLAY_ORDER, defaultPlaybook, renderPlay, sanitizePlaybook } from '@/lib/replyPlaybook';
import { buildFlow, scenarioPath } from '@/lib/workflowGraph';

const PROMPT = 'I want to sell AI agents to dental clinic, visibility, receptionist, follow up and patient reactivation';

describe('one-prompt brief', () => {
  it('reads offer, audience, features and goal from a single sentence', () => {
    const b = briefFromText(PROMPT);
    expect(b.offer).toBe('AI Agents');
    expect(b.audience).toBe('Dental clinics');
    expect(b.objective).toBe('book_meetings'); // "patient reactivation" is a feature, not the objective
    expect(b.features.map((f) => f.split(':')[0])).toEqual(['AI Visibility', 'AI Receptionist', 'Automated Follow-up', 'Patient Reactivation']);
    expect(b.features.join(' ')).toMatch(/patients/); // speaks the clinic's language
    expect(b.offerSummary).toMatch(/^AI Agents help dental clinics/);
    expect(b.goal).toBe('Book demos with dental clinics');
  });
  it('does not treat sequence settings as features', () => {
    const b = briefFromText('Pitch our AI receptionist to dental clinics in Nigeria with 3 emails');
    expect(b.features).toEqual([]);
    expect(b.audience).toBe('Dental clinics in Nigeria');
  });
  it('expands a known feature and keeps an unknown one as written', () => {
    expect(expandFeature('receptionist')).toMatch(/^AI Receptionist: /);
    expect(expandFeature('loyalty cards')).toBe('Loyalty Cards');
  });
});

describe('built-in planner output', () => {
  const { automation: a } = planFromGoal(PROMPT, null);
  it('builds five emails with opened versions and a complete playbook', () => {
    expect(a.emails).toHaveLength(5);
    expect(a.emails.filter((e) => e.openedVariant).length).toBeGreaterThanOrEqual(2);
    expect(a.emails[4].openedVariant).toBeUndefined(); // the final note has one version
    expect(a.playbook?.map((p) => p.replyClass)).toEqual(PLAY_ORDER);
    expect(a.playbook?.find((p) => p.replyClass === 'not_interested')?.response).toMatch(/what made it not a fit/); // asks for feedback
    expect(a.sendMode).toBe('review');
  });
  it('survives sanitising (saved and loaded back)', () => {
    const back = sanitizeAutomation(JSON.parse(JSON.stringify(a))) as Automation;
    expect(back.emails[1].openedVariant).toEqual(a.emails[1].openedVariant);
    expect(back.playbook).toEqual(a.playbook);
  });
  it('the simulator uses the opened version for someone who opened', () => {
    expect(simulate(a, 'opens').some((e) => /version for people who opened/.test(e.text))).toBe(true);
    expect(simulate(a, 'no_reply').some((e) => /version for people who opened/.test(e.text))).toBe(false);
  });
});

describe('opened variants', () => {
  const base = { name: 'x', emails: [{ subject: 'Hi', body: 'One', waitDays: 0, sendIf: 'no_reply' }, { subject: 'Re: {{subject}}', body: 'Two', waitDays: 2, sendIf: 'no_reply', openedVariant: { subject: 'Seen it', body: 'Two, opened https://evil.example {{password}}' } }] };
  it('cleans the variant like any email and picks it only for openers', () => {
    const a = sanitizeAutomation(base) as Automation;
    expect(a.emails[1].openedVariant?.body).toBe('Two, opened');
    expect(stepCopy(a.emails[1], true).subject).toBe('Seen it');
    expect(stepCopy(a.emails[1], false).subject).toBe('Re: {{subject}}');
  });
  it('drops a variant on a step that only goes to people who did not open', () => {
    const a = sanitizeAutomation({ ...base, emails: [base.emails[0], { ...base.emails[1], sendIf: 'not_opened' }] }) as Automation;
    expect(a.emails[1].openedVariant).toBeUndefined();
  });
  it('never on the first email', () => {
    const a = sanitizeAutomation({ ...base, emails: [{ ...base.emails[0], openedVariant: { subject: 'a', body: 'b' } }] }) as Automation;
    expect(a.emails[0].openedVariant).toBeUndefined();
  });
});

describe('reply playbook', () => {
  it('fills every class, keeps fixed actions and strips links and unknown placeholders', () => {
    const p = sanitizePlaybook({ interested: 'Hi {{name}}, see www.x.com {{secret}} at {{business}}', unsubscribe: 'Sneaky reply' }, defaultPlaybook(null));
    expect(p).toHaveLength(PLAY_ORDER.length);
    expect(p.find((x) => x.replyClass === 'interested')?.response).toBe('Hi {{name}}, see at {{business}}');
    expect(p.find((x) => x.replyClass === 'unsubscribe')).toEqual({ replyClass: 'unsubscribe', action: 'stop', response: '' });
    expect(p.find((x) => x.replyClass === 'out_of_office')?.action).toBe('pause');
  });
  it('renders for a contact', () => {
    const p = defaultPlaybook({ name: '', objective: 'book_meetings', offer: 'Dental AI Hub', offerSummary: '', features: [], audience: '', goal: '', signOff: 'Azeez' });
    const t = renderPlay(p, 'meeting_request', { name: 'Ada Obi', business: 'Bright Dental' });
    expect(t).toMatch(/^Hello Ada,/);
    expect(t).toMatch(/Bright Dental/);
    expect(t).toMatch(/Azeez$/);
    expect(renderPlay(p, 'unsubscribe', { name: 'Ada' })).toBeNull();
  });
});

describe('workflow graph', () => {
  const { automation: a } = planFromGoal(PROMPT, null);
  it('has every email, a reply decision per follow-up, the end and all reply plays', () => {
    const g = buildFlow(a);
    const ids = g.rows.flatMap((r) => (r.type === 'node' ? [r.node.id] : [r.yes.node.id, r.no.node.id]));
    expect(ids).toEqual(expect.arrayContaining(['start', 'e0', 'w1', 'r1', 'e1', 'e1v', 'e4', 'end']));
    expect(g.replies.map((n) => n.id)).toEqual(['reply', 'sort', ...PLAY_ORDER.map((c) => `p_${c}`)]);
    expect(g.loopDays).toBe(a.replyRules.outOfOfficePauseDays);
  });
  it('a lead who opens takes the opened branch to the end', () => {
    const ids = scenarioPath(a, 'opens').map((s) => s.id);
    expect(ids).toContain('e1v');
    expect(ids).not.toContain('e1');
    expect(ids[ids.length - 1]).toBe('end');
  });
  it('an interested reply leaves the sequence; an out-of-office loops back into it', () => {
    const yes = scenarioPath(a, 'interested').map((s) => s.id);
    expect(yes.slice(-3)).toEqual(['reply', 'sort', 'p_interested']);
    const ooo = scenarioPath(a, 'out_of_office').map((s) => s.id);
    const at = ooo.indexOf('p_out_of_office');
    expect(at).toBeGreaterThan(0);
    expect(ooo.slice(at + 1)).toContain('e1');
    expect(ooo[ooo.length - 1]).toBe('end');
  });
  it('a condition that is not met ends the sequence at that step', () => {
    const b = { ...a, emails: a.emails.map((e, i) => (i === 2 ? { ...e, sendIf: 'opened' as const } : e)) };
    const ids = scenarioPath(b, 'no_reply').map((s) => s.id);
    expect(ids[ids.length - 1]).toBe('x2');
  });
});

describe('introduction wording', () => {
  it('does not repeat the offer name when the summary already starts with it', () => {
    const { automation } = planFromGoal(PROMPT, null);
    expect(automation.emails[0].body).not.toMatch(/At AI Agents, aI/);
    expect(automation.emails[0].body).toMatch(/\n\nAI Agents help dental clinics/);
  });
});
