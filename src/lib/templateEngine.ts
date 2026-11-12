/**
 * The one campaign engine behind every industry template. A template (templateLibrary.ts) supplies wording and
 * settings; this file fills it from the user's brief and returns the same Automation the rest of RUNVAX 2.0
 * already runs: always review-mode, links and unknown placeholders removed, no invented results.
 */

import { dayNumbers, sanitizeAutomation, type Automation, type AutoEmail } from '@/lib/automation';
import { CONVERSIONS, describeOffer, emptyBrief, sanitizeBrief, shortOffer, type CampaignBrief, type Conversion } from '@/lib/campaignBrief';
import { parseKnobs, type Knobs } from '@/lib/campaignBuilder';
import type { TemplateConfig, TouchId } from '@/lib/templateLibrary';

/** The ask for each conversion. Property marketing never mentions the recipient's "business". */
const ASK: Record<Conversion, { b2b: string; person: string; follow: { b2b: string; person: string } }> = {
  demo_booking: { b2b: 'Would you be open to a brief demonstration of how this could work for {{business}}?', person: 'Would you like to see how it works in a short demonstration?', follow: { b2b: 'If it would help, I would be glad to show you a short demonstration for {{business}}.', person: 'If it would help, I would be glad to show you a short demonstration.' } },
  sales_enquiry: { b2b: 'Would you like me to send over the details for {{business}}?', person: 'Would you like me to send over the details?', follow: { b2b: 'If it is useful, just reply and I will send the details for {{business}}.', person: 'If it is useful, just reply and I will send the details.' } },
  product_purchase: { b2b: 'Would you like me to explain how {{business}} can get started?', person: 'Would you like me to explain how to get started?', follow: { b2b: 'If you are ready, just reply and I will walk you through getting started.', person: 'If you are ready, just reply and I will walk you through getting started.' } },
  viewing: { b2b: 'Would you like to arrange a viewing?', person: 'Would you like to arrange a viewing? Tell me a day and time that suits you.', follow: { b2b: 'If you would like to see it in person, tell me a day and time that suits you.', person: 'If you would like to see it in person, tell me a day and time that suits you.' } },
  general_enquiry: { b2b: 'Would you like me to send over more information for {{business}}?', person: 'Would you like me to send over more information?', follow: { b2b: 'If it is useful, just reply and I will send more information for {{business}}.', person: 'If it is useful, just reply and I will send more information.' } },
};

const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const firstSentence = (s: string) => {
  const f = s.split(/(?<=[.!?])\s/)[0].trim();
  const t = f.length > 160 ? `${f.slice(0, 157).replace(/\s+\S*$/, '')}…` : f;
  return /^we\b/i.test(t) ? t : lower(t);
};

/** A brief pre-filled from a template's defaults. The user's own answers replace these. */
export function briefFromTemplate(t: TemplateConfig): CampaignBrief {
  return {
    ...emptyBrief(), name: t.name, objective: t.primaryObjective, offer: t.product.offer, offerSummary: t.product.summary,
    features: [...t.product.features], audience: '', goal: '', signOff: '', templateId: t.id, conversion: t.conversion, channels: ['email'],
  };
}

/** The user's answers over the template's defaults; an answer left blank keeps the default. */
export function mergeBrief(base: CampaignBrief, mine: Partial<CampaignBrief>): CampaignBrief {
  const out: Record<string, unknown> = { ...base };
  for (const [k, val] of Object.entries(mine)) {
    const blank = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);
    if (!blank) out[k] = val;
  }
  return out as unknown as CampaignBrief;
}

function slots(t: TemplateConfig, brief: CampaignBrief): Record<string, string> {
  const person = t.kind === 'property_marketing';
  const conv = brief.conversion ?? t.conversion;
  const short = shortOffer(brief.offer) || t.product.name;
  const summary = brief.offerSummary || t.product.summary;
  const aud = brief.audience ? lower(brief.audience) : '';
  const feats = brief.features.map((f) => f.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean);
  return {
    short,
    summary: person ? summary : describeOffer(short, summary),
    forAudience: aud ? `we are building specifically for ${aud}` : 'that may be relevant to you',
    features: feats.length ? `${t.product.featuresHeading}:\n\n${feats.map((f) => `- ${f}`).join('\n')}` : '',
    benefit: firstSentence(summary),
    ask: ASK[conv][person ? 'person' : 'b2b'],
    followAsk: ASK[conv].follow[person ? 'person' : 'b2b'],
    inMarket: brief.market ? ` in ${brief.market}` : '',
  };
}

const fill = (s: string, v: Record<string, string>) => s.replace(/%(\w+)%/g, (_, k: string) => v[k] ?? '');

const WAIT: Record<TouchId, number> = { intro: 0, review: 2, educate: 3, demo: 3, final: 5 };
const ORDER: Record<number, TouchId[]> = { 1: [], 2: ['final'], 3: ['review', 'final'], 4: ['review', 'demo', 'final'], 5: ['review', 'educate', 'demo', 'final'] };

/** Builds the whole sequence for a template from the user's answers. */
export function buildFromTemplate(t: TemplateConfig, briefIn: CampaignBrief, knobs: Knobs): Automation {
  const brief = sanitizeBrief({ ...mergeBrief(briefFromTemplate(t), briefIn), templateId: t.id });
  const v = slots(t, brief);
  const hi = knobs.tone === 'formal' ? 'Dear {{name}},' : knobs.tone === 'direct' ? '{{name}},' : knobs.tone === 'friendly' ? 'Hi {{name}},' : 'Hello {{name}},';
  const bye = knobs.tone === 'formal' ? 'Kind regards,' : 'Best regards,';
  const sign = `${bye}${brief.signOff ? `\n\n${brief.signOff}` : ''}`;

  const touch = (id: TouchId, sendIf: AutoEmail['sendIf']): AutoEmail => {
    const paras = t.copy[id].filter((p) => !(p.includes('%features%') && !v.features)).map((p) => fill(p, v)).filter((p) => p.trim());
    return { subject: fill(t.subjects[id], v), body: [hi, ...paras, sign].join('\n\n'), waitDays: knobs.gapDays !== null && id !== 'intro' ? knobs.gapDays : WAIT[id], sendIf: id === 'intro' ? 'no_reply' : id === 'final' ? 'no_reply' : sendIf };
  };
  const emails = [touch('intro', 'no_reply'), ...(ORDER[knobs.count] ?? ORDER[5]).map((id) => touch(id, knobs.sendIf))];

  return sanitizeAutomation({
    name: brief.name || t.name, emails, stopOnReply: knobs.stopOnReply, replyRules: { notifyInterested: true, outOfOfficePauseDays: 3 },
    sendMode: 'review', dailyCap: knobs.dailyCap, windowStart: 9, windowEnd: 17, weekdaysOnly: true, brief,
  }) as Automation;
}

/** Same as buildFromTemplate, reading the sequence settings (count, gap, daily limit) from a sentence. */
export const planFromTemplate = (t: TemplateConfig, brief: CampaignBrief, text = ''): Automation => buildFromTemplate(t, brief, parseKnobs(text));

export interface Strategy {
  summary: string;
  audience: string[];
  angles: string[];
  cta: { recommended: string; alternatives: string[] };
  plan: string[];
  agents: Array<{ id: string; focus: string }>;
}

/** The campaign strategy shown to the user, assembled from the template and their answers. Nothing here is a forecast. */
export function strategyFor(t: TemplateConfig, brief: CampaignBrief, a: Automation): Strategy {
  const days = dayNumbers(a);
  const conv = CONVERSIONS.find((c) => c.id === (brief.conversion ?? t.conversion))?.label ?? t.conversion;
  return {
    summary: `${t.name}: ${brief.goal || t.primaryObjective.replace('_', ' ')}${brief.market ? ` in ${brief.market}` : ''}. Conversion: ${conv}. ${a.emails.length} email${a.emails.length === 1 ? '' : 's'} from your own mailbox; every follow-up waits for your click.`,
    audience: [...(brief.audience ? [`Your focus: ${brief.audience}${brief.market ? ` (${brief.market})` : ''}`] : []), ...t.audienceCriteria],
    angles: t.messagingStrategy,
    cta: { recommended: brief.conversion === t.conversion || !brief.conversion ? t.cta.recommended : conv, alternatives: t.cta.alternatives },
    plan: a.emails.map((e, i) => `Day ${days[i]}: ${e.subject.replace('{{subject}}', 'the first email')}`),
    agents: Object.entries(t.agents).map(([id, focus]) => ({ id, focus })),
  };
}
