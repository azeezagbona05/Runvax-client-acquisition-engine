/**
 * Industry-specific outreach drafts for the six channels. They are drafts: nothing here is sent by itself. Each one
 * asks for a single thing, carries an opt-out, and makes no promise or statistic. Where the draft needs something only the sender
 * can know (one specific thing noticed about the business), it says so in brackets instead of making it up.
 */
import { industryById, type Industry, type IndustryId } from './industryIntel';

export type DraftChannel = 'cold_email' | 'linkedin_connect' | 'linkedin_followup' | 'whatsapp' | 'followup_email' | 'meeting';
export interface Draft { channel: DraftChannel; label: string; subject?: string; body: string; note?: string }

export const CHANNEL_LABEL: Record<DraftChannel, string> = {
  cold_email: 'Cold email', linkedin_connect: 'LinkedIn connection', linkedin_followup: 'LinkedIn follow-up',
  whatsapp: 'WhatsApp introduction', followup_email: 'Follow-up email', meeting: 'Meeting invitation',
};
const OPT_OUT = 'If this is not relevant, just tell me and I will not contact you again.';
export const LINKEDIN_CONNECT_MAX = 300;

/** The approach for an industry, as instructions to whoever (or whatever) writes the message. */
export function outreachGuidance(ind: Industry): string[] {
  return [
    `Identify a specific ${ind.angle.gap} issue from publicly available business information.`,
    `Reference ${ind.angle.reference}.`,
    `Explain how the offer can help them ${ind.angle.benefit}.`,
    'Avoid generic AI hype and any promised result.',
    'End with one simple question.',
  ];
}

export function draftsFor(id: IndustryId, opts: { offer?: string } = {}): Draft[] {
  const ind = industryById(id);
  if (!ind) return [];
  const offer = opts.offer?.trim() || ind.offers[0].name;
  const noticed = `[One specific thing you noticed about {{business}} from its public website or listing, for example ${ind.angle.reference}.]`;
  return [
    {
      channel: 'cold_email', label: CHANNEL_LABEL.cold_email, subject: `${offer} for {{business}}`,
      body: [`Hi {{firstName}},`, noticed, `One area worth a look for {{business}} is ${ind.angle.gap}. ${offer} is built to help ${ind.angle.benefit}.`, `Would it be useful if I showed you what that could look like for {{business}}?`, OPT_OUT].join('\n\n'),
    },
    {
      channel: 'linkedin_connect', label: CHANNEL_LABEL.linkedin_connect,
      body: `Hi {{firstName}}, I work with ${ind.plural} on ${ind.angle.gapShort}. I would like to connect and follow what {{business}} is doing.`,
      note: `Keep it under ${LINKEDIN_CONNECT_MAX} characters and do not pitch in the connection request.`,
    },
    {
      channel: 'linkedin_followup', label: CHANNEL_LABEL.linkedin_followup,
      body: [`Thanks for connecting, {{firstName}}.`, noticed, `${offer} helps ${ind.plural} ${ind.angle.benefit}. Would a short chat next week be useful?`].join('\n\n'),
    },
    {
      channel: 'whatsapp', label: CHANNEL_LABEL.whatsapp,
      body: `Hello {{firstName}}, this is [your name]. I sent you a note about ${offer} for {{business}}. Is it OK if I share a short overview here? Reply STOP and I will not message you again.`,
      note: 'Use only where the person has agreed to WhatsApp contact, or the law and rules of their country allow it. Never message personal numbers without consent.',
    },
    {
      channel: 'followup_email', label: CHANNEL_LABEL.followup_email, subject: 'Re: {{subject}}',
      body: [`Hi {{firstName}},`, `A quick follow-up on my note about ${ind.angle.gapShort} at {{business}}. ${offer} is meant to help you ${ind.angle.benefit}.`, `Is it worth a 15-minute look?`, OPT_OUT].join('\n\n'),
    },
    {
      channel: 'meeting', label: CHANNEL_LABEL.meeting, subject: `A short call about ${ind.angle.gapShort}?`,
      body: [`Hi {{firstName}},`, `I would like to show you how ${offer} could work for {{business}}. It takes about 15 minutes.`, `Would [day, time] or [day, time] suit you?`, OPT_OUT].join('\n\n'),
    },
  ];
}
