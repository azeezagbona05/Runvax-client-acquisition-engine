import { Business } from '@/types';
import { whatsappLink } from './phone';

export function buildQuickWAMessage(business: Business): string {
  const shortName = business.name.includes('(')
    ? business.name.split('(')[0].trim()
    : business.name.length > 45
    ? business.name.slice(0, 45).trim() + '…'
    : business.name;

  const boldName = `*${shortName}*`;

  const rawCat = business.category.toLowerCase();
  const isGeneric =
    rawCat === 'business' || rawCat === 'establishment' || rawCat === 'point of interest';
  const niche = isGeneric ? 'local' : rawCat;
  const nichePhrase = isGeneric ? 'businesses like yours' : `${niche} businesses`;

  const problem =
    business.reviewCount && business.reviewCount > 0
      ? `Hi! 👋 I came across ${boldName} on Google.\n\nYou have *${business.reviewCount} Google reviews* ⭐ — _that's real trust people have given you._ But when a new customer searches online right now, there's *no website to land on.*`
      : `Hi! 👋 I came across ${boldName} on Google.\n\nPeople are searching for ${nichePhrase} in your area every day — but _without a website, you're invisible_ to all of them.`;

  const agitate = `Every day, potential customers find your competitors instead — _not because they're better,_ but because *they show up online and you don't.*`;

  const solution = `I build *digital front doors* for ${nichePhrase} — mobile-first, found on Google *and* recommended by AI tools like ChatGPT. 🌐\n\n_Would you be open to a quick chat?_`;

  return `${problem}\n\n${agitate}\n\n${solution}`;
}

export function buildWALink(business: Business): string | null {
  return whatsappLink(business, buildQuickWAMessage(business));
}
