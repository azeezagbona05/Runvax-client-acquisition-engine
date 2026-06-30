export interface WebsitePackage {
  id: string;
  name: string;
  description: string;
  priceMin: number;
  priceMax: number;
  currency: string;
  timeline: string;
  pages: string;
  features: string[];
}

export interface MaintenancePlan {
  id: string;
  name: string;
  pricePerMonth: number;
  currency: string;
  includes: string[];
}

export interface AddOn {
  id: string;
  name: string;
  price: number;
  currency: string;
  description: string;
}

export interface PaymentTerms {
  depositPct: number;
  milestonePct: number;
  completionPct: number;
  revisionRounds: number;
  extraRevisionCost: number;
  validityDays: number;
}

export interface RateCard {
  currency: string;
  packages: WebsitePackage[];
  maintenancePlans: MaintenancePlan[];
  addOns: AddOn[];
  paymentTerms: PaymentTerms;
  notes: string;
}

export const DEFAULT_RATE_CARD: RateCard = {
  currency: 'NGN',
  packages: [
    {
      id: crypto.randomUUID?.() ?? 'pkg-1',
      name: 'Starter Site',
      description: 'Clean, mobile-friendly website for small businesses',
      priceMin: 150000,
      priceMax: 250000,
      currency: 'NGN',
      timeline: '2–3 weeks',
      pages: '3–5 pages',
      features: ['Responsive design', 'Contact form', 'Google Maps embed', 'Social media links'],
    },
    {
      id: crypto.randomUUID?.() ?? 'pkg-2',
      name: 'Business Pro',
      description: 'Full business website with portfolio and blog',
      priceMin: 300000,
      priceMax: 500000,
      currency: 'NGN',
      timeline: '3–5 weeks',
      pages: '6–10 pages',
      features: ['Everything in Starter', 'Portfolio/gallery', 'Blog', 'SEO basics', 'WhatsApp chat button'],
    },
    {
      id: crypto.randomUUID?.() ?? 'pkg-3',
      name: 'E-commerce',
      description: 'Online store with product listings and payment integration',
      priceMin: 600000,
      priceMax: 1200000,
      currency: 'NGN',
      timeline: '5–8 weeks',
      pages: '10+ pages',
      features: ['Product catalog', 'Paystack/Flutterwave integration', 'Order management', 'Mobile-first', 'Inventory tracking'],
    },
  ],
  maintenancePlans: [
    {
      id: crypto.randomUUID?.() ?? 'maint-1',
      name: 'Basic Maintenance',
      pricePerMonth: 15000,
      currency: 'NGN',
      includes: ['Monthly content updates', 'Hosting management', 'Security monitoring'],
    },
    {
      id: crypto.randomUUID?.() ?? 'maint-2',
      name: 'Growth Support',
      pricePerMonth: 35000,
      currency: 'NGN',
      includes: ['Everything in Basic', 'Fortnightly updates', '2 hrs design changes/month', 'Monthly SEO report'],
    },
  ],
  addOns: [
    { id: crypto.randomUUID?.() ?? 'ao-1', name: 'SEO Setup', price: 50000, currency: 'NGN', description: 'Keyword research + on-page optimisation' },
    { id: crypto.randomUUID?.() ?? 'ao-2', name: 'Logo Design', price: 30000, currency: 'NGN', description: 'Professional logo with 2 revision rounds' },
    { id: crypto.randomUUID?.() ?? 'ao-3', name: 'Content Writing', price: 20000, currency: 'NGN', description: 'Professionally written copy for up to 5 pages' },
    { id: crypto.randomUUID?.() ?? 'ao-4', name: 'Google Business Setup', price: 15000, currency: 'NGN', description: 'Claim, verify, and optimise Google Business Profile' },
  ],
  paymentTerms: {
    depositPct: 50,
    milestonePct: 25,
    completionPct: 25,
    revisionRounds: 2,
    extraRevisionCost: 10000,
    validityDays: 14,
  },
  notes: '',
};

export function formatPrice(amount: number, currency: string): string {
  if (currency === 'NGN') return `₦${amount.toLocaleString()}`;
  if (currency === 'GHS') return `GH₵${amount.toLocaleString()}`;
  if (currency === 'KES') return `KSh${amount.toLocaleString()}`;
  if (currency === 'USD') return `$${amount.toLocaleString()}`;
  if (currency === 'GBP') return `£${amount.toLocaleString()}`;
  return `${currency} ${amount.toLocaleString()}`;
}

export function rateCardSummary(rc: RateCard): string {
  if (!rc.packages.length) return '';
  const lines: string[] = [];
  lines.push(`AGENCY RATE CARD (${rc.currency}):`);
  rc.packages.forEach((p) => {
    lines.push(`• ${p.name}: ${formatPrice(p.priceMin, rc.currency)}–${formatPrice(p.priceMax, rc.currency)} | ${p.timeline} | ${p.pages}`);
    if (p.features.length) lines.push(`  Includes: ${p.features.join(', ')}`);
  });
  if (rc.maintenancePlans.length) {
    lines.push('MAINTENANCE:');
    rc.maintenancePlans.forEach((m) => {
      lines.push(`• ${m.name}: ${formatPrice(m.pricePerMonth, rc.currency)}/month`);
    });
  }
  if (rc.addOns.length) {
    lines.push('ADD-ONS:');
    rc.addOns.forEach((a) => {
      lines.push(`• ${a.name}: ${formatPrice(a.price, rc.currency)} — ${a.description}`);
    });
  }
  const t = rc.paymentTerms;
  lines.push(`PAYMENT TERMS: ${t.depositPct}% deposit, ${t.milestonePct}% mid-project, ${t.completionPct}% on delivery. ${t.revisionRounds} revision rounds included. Quote valid ${t.validityDays} days.`);
  if (rc.notes) lines.push(`NOTES: ${rc.notes}`);
  return lines.join('\n');
}
