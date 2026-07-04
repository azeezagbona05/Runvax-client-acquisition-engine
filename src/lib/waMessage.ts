import { Business } from '@/types';
import { whatsappLink } from './phone';

function warmGreeting(shortName: string): string {
  const h = new Date().getHours();
  if (h < 12) return `Good morning ${shortName}! Hope you're having a great start to the day.`;
  if (h < 17) return `Good afternoon ${shortName}! Trust you're doing well today.`;
  return `Good evening ${shortName}! Hope your day has been good.`;
}

export function buildQuickWAMessage(business: Business): string {
  const shortName = business.name.includes('(')
    ? business.name.split('(')[0].trim()
    : business.name.length > 45
    ? business.name.slice(0, 45).trim() + '…'
    : business.name;

  const rawCat = business.category.toLowerCase();
  const isGeneric =
    rawCat === 'business' || rawCat === 'establishment' || rawCat === 'point of interest';
  const niche = isGeneric ? 'local' : rawCat;
  const nichePhrase = isGeneric ? 'businesses like yours' : `${niche} businesses`;

  const greeting = warmGreeting(shortName);

  const observation =
    business.reviewCount && business.reviewCount > 0
      ? `Noticed *${shortName}* has *${business.reviewCount} Google reviews* but no website yet. That's real trust you've built — without a website, new customers searching online can't find you properly.`
      : `Saw *${shortName}* on Google — no website linked to the profile yet. People searching for ${nichePhrase} in your area right now can't find you online.`;

  const cta = `Is this something you're thinking about for the business?`;

  return `${greeting}\n\n${observation}\n\n${cta}`;
}

export function buildWALink(business: Business): string | null {
  return whatsappLink(business, buildQuickWAMessage(business));
}
