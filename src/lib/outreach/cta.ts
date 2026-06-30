import type { CtaLevel, ProspectContext } from './types';

export function ctaInstruction(level: CtaLevel, ctx: ProspectContext): string {
  const { industry, city } = ctx;

  const rule = `RULE YOU MUST FOLLOW: End with EXACTLY ONE call to action. Do not stack multiple CTAs. Do not ask two questions. One question. One tap to answer. That's it.`;

  switch (level) {
    case 'micro':
      return `CALL TO ACTION LEVEL: Micro
The lowest-friction ask possible. Not a call. Not a commitment. An offer of something free and immediately useful — a quick mockup of what their digital front door could look like, a 5-minute audit of their current online presence, or a before/after comparison for a ${industry} in ${city}. The goal is one reply, not a closed deal.

${rule}`;

    case 'soft_call':
      return `CALL TO ACTION LEVEL: Soft Call
Ask for a short, low-commitment conversation — a 10-minute call, a quick WhatsApp voice note, a brief chat at a time that suits them. Frame it as for their benefit: "I can show you exactly what this would look like for your business in 10 minutes." Remove all pressure.

${rule}`;

    case 'direct_close':
      return `CALL TO ACTION LEVEL: Direct Close
This prospect is ready. Ask for the next concrete step: send the proposal, confirm the start date, or ask "should we start Monday?" Confident but not pushy. The close should feel like a natural next step they are already half-expecting.

${rule}`;

    case 'interest':
      return `CALL TO ACTION LEVEL: Interest Check
A priority question rather than a direct ask. "Is this something you'd want to move on in the next few weeks, or is the timing not right?" This surfaces intent without pressure and gives them an honest out. Both "yes" and "not yet" are useful answers.

${rule}`;

    case 'two_option':
      return `CALL TO ACTION LEVEL: Two-Option Close
Give two paths forward — both of which move things in a useful direction. Example: "If now isn't the right time, just say the word and I'll close this out. If you'd still like that free mockup, I can have it ready by [day]." Neither option is a rejection — one is a yes, one is a graceful close. Both honour their time.

${rule}`;
  }
}
