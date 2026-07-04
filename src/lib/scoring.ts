import { Business } from '@/types';

const HIGH_VALUE_CATEGORIES = [
  'hotel', 'motel', 'resort',
  'real estate', 'property', 'estate agent', 'realty',
  'law', 'legal', 'solicitor', 'barrister',
  'hospital', 'clinic', 'medical', 'doctor', 'dentist', 'optician',
  'school', 'college', 'university', 'academy',
  'event', 'catering', 'wedding', 'venue',
  'accounting', 'finance', 'consultant', 'audit',
  'logistics', 'transport', 'courier',
];

function isHighValue(category = '', types: string[] = []): boolean {
  const text = `${category} ${types.join(' ')}`.toLowerCase();
  return HIGH_VALUE_CATEGORIES.some((k) => text.includes(k));
}

export function scoreProspect(business: Business): number {
  let score = 0;

  // No website — core signal (+40 pts, normalised to 4/10)
  if (!business.hasWebsite) score += 4;

  // Rating quality
  if (business.rating) {
    if (business.rating >= 4.5) score += 2;
    else if (business.rating >= 4.0) score += 1.5;
    else if (business.rating >= 3.5) score += 1;
    else score += 0.5;
  }

  // Review volume — social proof already built
  if (business.reviewCount) {
    if (business.reviewCount >= 200) score += 1.5;
    else if (business.reviewCount >= 50) score += 1;
    else if (business.reviewCount >= 10) score += 0.5;
  }

  // Has phone — reachable
  if (business.phone) score += 0.5;

  // Still operational
  if (business.status === 'OPERATIONAL') score += 0.5;

  // High-value category — bigger deal size
  if (isHighValue(business.category, business.categoryTypes)) score += 1;

  // Email found — can reach via two channels
  if (business.email) score += 0.5;

  // Hours not listed on Google — more digital gaps = more opportunity
  if (business.hoursComplete === false) score += 0.5;

  return Math.min(Math.round(score * 10) / 10, 10);
}

export interface ScoreReason { label: string; pts: number }

export function scoreBreakdown(business: Business): ScoreReason[] {
  const reasons: ScoreReason[] = [];

  if (!business.hasWebsite) reasons.push({ label: 'No website', pts: 4 });

  if (business.rating) {
    if (business.rating >= 4.5)      reasons.push({ label: `Rating ${business.rating}★`, pts: 2 });
    else if (business.rating >= 4.0) reasons.push({ label: `Rating ${business.rating}★`, pts: 1.5 });
    else if (business.rating >= 3.5) reasons.push({ label: `Rating ${business.rating}★`, pts: 1 });
    else                             reasons.push({ label: `Rating ${business.rating}★`, pts: 0.5 });
  }

  if (business.reviewCount) {
    if (business.reviewCount >= 200)      reasons.push({ label: `${business.reviewCount} reviews`, pts: 1.5 });
    else if (business.reviewCount >= 50)  reasons.push({ label: `${business.reviewCount} reviews`, pts: 1 });
    else if (business.reviewCount >= 10)  reasons.push({ label: `${business.reviewCount} reviews`, pts: 0.5 });
  }

  if (business.phone)                    reasons.push({ label: 'Has phone number', pts: 0.5 });
  if (business.status === 'OPERATIONAL') reasons.push({ label: 'Currently open', pts: 0.5 });
  if (isHighValue(business.category, business.categoryTypes)) reasons.push({ label: 'High-value category', pts: 1 });
  if (business.email)                    reasons.push({ label: 'Email found', pts: 0.5 });
  if (business.hoursComplete === false)  reasons.push({ label: 'Hours not listed', pts: 0.5 });

  return reasons;
}

export function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 8) return { label: '🔥 Hot', color: 'text-red-400 bg-red-500/15 border-red-500/25' };
  if (score >= 6) return { label: '✅ Good', color: 'text-green-400 bg-green-500/15 border-green-500/25' };
  if (score >= 4) return { label: '👀 Warm', color: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/25' };
  return { label: '🔵 Cold', color: 'text-blue-400 bg-blue-500/15 border-blue-500/25' };
}

const PRICE_MAP: Array<{ keys: string[]; min: number; max: number }> = [
  { keys: ['hotel', 'motel', 'resort'], min: 500000, max: 1000000 },
  { keys: ['real estate', 'property', 'estate agent', 'realty'], min: 500000, max: 1500000 },
  { keys: ['law', 'legal', 'solicitor', 'barrister'], min: 400000, max: 800000 },
  { keys: ['hospital', 'clinic', 'medical', 'doctor', 'dentist', 'optician'], min: 400000, max: 700000 },
  { keys: ['school', 'college', 'university', 'academy', 'education'], min: 300000, max: 600000 },
  { keys: ['event', 'catering', 'wedding', 'venue'], min: 300000, max: 600000 },
  { keys: ['accounting', 'finance', 'consultant', 'audit'], min: 300000, max: 500000 },
  { keys: ['logistics', 'transport', 'courier', 'shipping'], min: 300000, max: 500000 },
  { keys: ['photography', 'photo', 'studio'], min: 200000, max: 400000 },
  { keys: ['church', 'mosque', 'ministry', 'worship'], min: 200000, max: 400000 },
  { keys: ['restaurant', 'eatery', 'buka', 'canteen'], min: 200000, max: 400000 },
  { keys: ['gym', 'fitness', 'sport'], min: 200000, max: 350000 },
  { keys: ['pharmacy', 'chemist', 'drug'], min: 200000, max: 350000 },
  { keys: ['salon', 'beauty', 'barber', 'spa', 'hair', 'nail'], min: 150000, max: 250000 },
  { keys: ['food', 'grocery', 'supermarket', 'store'], min: 150000, max: 300000 },
];

export function estimatePrice(
  category = '',
  types: string[] = []
): { min: number; max: number } {
  const text = `${category} ${types.join(' ')}`.toLowerCase();
  for (const entry of PRICE_MAP) {
    if (entry.keys.some((k) => text.includes(k))) {
      return { min: entry.min, max: entry.max };
    }
  }
  return { min: 150000, max: 300000 };
}

export function formatPrice(n: number): string {
  return '₦' + n.toLocaleString('en-NG');
}
