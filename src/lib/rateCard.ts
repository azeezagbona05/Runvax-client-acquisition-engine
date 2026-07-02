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
      description: 'Clean, mobile-friendly website for small businesses getting online for the first time',
      priceMin: 150000,
      priceMax: 250000,
      currency: 'NGN',
      timeline: '2–3 weeks',
      pages: '3–5 pages',
      features: [
        'Responsive mobile-first design',
        'Contact form with email notifications',
        'Google Maps embed & directions',
        'WhatsApp chat button',
        'Social media links',
        'Basic SEO setup',
        'Click-to-call phone numbers',
        'Live chat widget (WhatsApp-based)',
      ],
    },
    {
      id: crypto.randomUUID?.() ?? 'pkg-2',
      name: 'Business Pro',
      description: 'Full business website with portfolio, blog, and interactive tools to keep visitors engaged',
      priceMin: 300000,
      priceMax: 500000,
      currency: 'NGN',
      timeline: '3–5 weeks',
      pages: '6–10 pages',
      features: [
        'Everything in Starter Site',
        'Portfolio / gallery with lightbox viewer',
        'Blog with categories and search',
        'On-page SEO + Google Analytics',
        'Appointment / booking request form',
        'FAQ accordion section',
        'Customer testimonials slider',
        'Newsletter signup (Mailchimp / ConvertKit)',
        'Pop-up lead capture widget',
        'Business hours & holiday notice widget',
      ],
    },
    {
      id: crypto.randomUUID?.() ?? 'pkg-3',
      name: 'Premium Plus',
      description: 'Advanced website with powerful mini-apps — ideal for real estate, finance, and professional services',
      priceMin: 1200000,
      priceMax: 1500000,
      currency: 'NGN',
      timeline: '6–9 weeks',
      pages: '12–15 pages',
      features: [
        'Everything in Business Pro',
        'ROI / Investment Calculator (custom-built)',
        'Mortgage / Loan repayment calculator',
        'Property / listing search & filter (real estate)',
        'Interactive pricing estimator tool',
        'Lead scoring & CRM webhook integration',
        'Client portal / login area',
        'Advanced property gallery with map view',
        'Virtual tour embed support',
        'Email automation sequences (welcome, follow-up)',
        'Custom quote / proposal request form',
        'Live currency converter widget',
        'PDF brochure download gated behind lead form',
      ],
    },
    {
      id: crypto.randomUUID?.() ?? 'pkg-4',
      name: 'E-commerce Store',
      description: 'Full online store with product catalog, payment integration, and customer management',
      priceMin: 2000000,
      priceMax: 2500000,
      currency: 'NGN',
      timeline: '8–12 weeks',
      pages: '15+ pages',
      features: [
        'Everything in Premium Plus',
        'Full product catalog with variants & options',
        'Paystack / Flutterwave payment integration',
        'Order management & tracking dashboard',
        'Customer accounts & wishlists',
        'Inventory & stock alert system',
        'Discount codes & promotional banners',
        'Abandoned cart email recovery',
        'Product reviews & ratings',
        'Logistics / delivery fee calculator',
        'Multi-vendor support (optional)',
        'Mobile shopping app PWA (installable)',
      ],
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
