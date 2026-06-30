import type { PersuasionPrinciple, ProspectContext } from './types';

export function persuasionInstruction(
  principle: PersuasionPrinciple,
  ctx: ProspectContext,
): string {
  const { businessName, industry, city, country, reviewCount, leadScore, competitorWithSite } = ctx;

  switch (principle) {
    case 'reciprocity':
      return `PERSUASION PRINCIPLE: Reciprocity (Cialdini)
Give something of genuine value before asking for anything. Lead with a real insight that the prospect didn't have before — delivered as a gift, not a hook. For ${businessName}, the gift is naming what they've already earned: ${reviewCount ? `their ${reviewCount} Google reviews represent real, hard-won trust that most businesses never achieve` : `their established position in ${city}`}. Naming this specifically IS the reciprocity trigger. The offer at the end (free mockup, quick audit) is the tangible give. Make the reader feel they received something before you asked for anything.`;

    case 'commitment':
      return `PERSUASION PRINCIPLE: Commitment & Consistency (Cialdini)
People honour their prior commitments. If ${businessName} has already expressed interest or taken any action (replied, clicked, asked a question), reference it as the natural next step. Frame the current ask as consistent with what they have already agreed to or expressed. Small steps: "You already said X — this next step is just the natural extension of that." Never ask for a leap; ask for a step.`;

    case 'social_proof':
      return `PERSUASION PRINCIPLE: Social Proof (Cialdini)
People follow what people like them do. ${businessName} is a ${industry} in ${city} — name a peer. Use: "Similar ${industry} businesses in ${country} who made this move are now..." or reference ${competitorWithSite ? `${competitorWithSite}, who already has a digital front door, and what that means for their visibility` : `businesses in ${city} that already have websites showing up when people search`}. Make it feel like the peer is someone they would recognise or relate to — same niche, same market, same starting point.`;

    case 'authority':
      return `PERSUASION PRINCIPLE: Authority (Cialdini)
People trust those who demonstrate expertise. Signal expertise by naming specific, non-obvious insights about ${industry} businesses in ${country}: how AI search works in 2026, what a lead score of ${leadScore} indicates about their digital footprint, why social media pages don't rank. Do NOT claim authority — demonstrate it by knowing things they don't. One sharp, specific insight delivered confidently is worth more than ten credentials.`;

    case 'liking':
      return `PERSUASION PRINCIPLE: Liking (Cialdini)
People buy from people they like. Create genuine warmth: show you noticed something real about ${businessName}, show you understand the specific pressures of running a ${industry} in ${city}. Use language that feels peer-to-peer, not consultant-to-client. Find common ground. Do not flatter — recognise. The difference: "You have 89 reviews — that's real" vs. "Your business is amazing." Real is likeable. Flattery is forgettable.`;

    case 'scarcity':
      return `PERSUASION PRINCIPLE: Scarcity (Cialdini)
People value what is limited or time-bound. For ${businessName}, the natural scarcity is real, not manufactured: the window to be an early-mover on AI search optimisation in ${city} is closing. Each month without a digital front door is a month ${competitorWithSite ? `${competitorWithSite} and others` : 'competitors'} capture the searchers that should have found them. Make the cost of waiting real and specific — not a deadline you invented, but the compound cost of each passing month.`;

    case 'unity':
      return `PERSUASION PRINCIPLE: Unity (Cialdini)
People say yes to those they see as "one of us." Establish shared identity: you are both building something in ${city}, you both understand the ${industry} market, you both want local businesses to thrive. Use "we" thoughtfully. Reference the shared goal: ${country} businesses deserve to compete with the best-presented businesses anywhere. This is not a transaction — it's two people who want the same thing for local business.`;
  }
}
