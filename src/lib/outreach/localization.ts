import type { ProspectContext } from './types';

interface PriceBandTable {
  [industry: string]: string;
}

interface CountryConfig {
  currency: string;
  bands: PriceBandTable;
  defaultBand: string;
  channelNorm: string;
  toneRegister: string;
  localObjections: string[];
}

const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  NG: {
    currency: '₦',
    bands: {
      salon: '₦150,000–₦250,000',
      'beauty salon': '₦150,000–₦250,000',
      'hair salon': '₦150,000–₦250,000',
      barbershop: '₦100,000–₦180,000',
      'real estate': '₦500,000–₦1,500,000',
      clinic: '₦300,000–₦800,000',
      hospital: '₦500,000–₦1,500,000',
      pharmacy: '₦200,000–₦400,000',
      restaurant: '₦200,000–₦350,000',
      hotel: '₦350,000–₦800,000',
      school: '₦250,000–₦600,000',
      gym: '₦150,000–₦300,000',
      fashion: '₦150,000–₦300,000',
      logistics: '₦200,000–₦450,000',
    },
    defaultBand: '₦150,000–₦500,000',
    channelNorm: 'WhatsApp is the primary business communication channel in Nigeria. Always mention WhatsApp integration as a feature.',
    toneRegister: 'Warm, respectful, direct, peer-to-peer. Use warm Nigerian English — not formal British English, not American slang. Sound like a knowledgeable friend sharing an insight.',
    localObjections: [
      '"I get all my clients through referrals and Instagram"',
      '"I don\'t have time to manage a website"',
      '"Websites are expensive and I don\'t see the ROI"',
      '"My customers don\'t use Google — they just call or walk in"',
    ],
  },
  GH: {
    currency: 'GH₵',
    bands: {
      salon: 'GH₵3,000–GH₵6,000',
      'beauty salon': 'GH₵3,000–GH₵6,000',
      'real estate': 'GH₵15,000–GH₵40,000',
      restaurant: 'GH₵5,000–GH₵12,000',
      clinic: 'GH₵8,000–GH₵20,000',
    },
    defaultBand: 'GH₵3,000–GH₵15,000',
    channelNorm: 'WhatsApp is widely used for business in Ghana. Mobile-first design is essential.',
    toneRegister: 'Warm, respectful, conversational. Peer-to-peer tone. Avoid corporate formality.',
    localObjections: [
      '"I rely on word of mouth and social media"',
      '"The cost is too high for my business right now"',
      '"I\'m not sure my customers look online"',
    ],
  },
  KE: {
    currency: 'KES',
    bands: {
      salon: 'KES 25,000–KES 60,000',
      'beauty salon': 'KES 25,000–KES 60,000',
      'real estate': 'KES 120,000–KES 350,000',
      restaurant: 'KES 30,000–KES 80,000',
      clinic: 'KES 50,000–KES 150,000',
    },
    defaultBand: 'KES 25,000–KES 150,000',
    channelNorm: 'Mobile-first. WhatsApp and M-Pesa integration are strong trust signals in Kenya.',
    toneRegister: 'Professional but warm. Peer-to-peer. Nairobi market responds to competence and clarity.',
    localObjections: [
      '"My business runs on referrals and Instagram"',
      '"Websites are expensive"',
      '"I don\'t have time"',
    ],
  },
  ZA: {
    currency: 'R',
    bands: {
      salon: 'R8,000–R18,000',
      'beauty salon': 'R8,000–R18,000',
      'real estate': 'R40,000–R120,000',
      restaurant: 'R12,000–R30,000',
      clinic: 'R20,000–R60,000',
    },
    defaultBand: 'R8,000–R60,000',
    channelNorm: 'WhatsApp is dominant. Mobile-first design critical. Google Business Profile integration is valued.',
    toneRegister: 'Confident, concise, warm. South African business owners appreciate directness with respect.',
    localObjections: [
      '"I have a Facebook page that does the job"',
      '"Load-shedding and data costs put people off browsing"',
      '"My clients book by WhatsApp already"',
    ],
  },
  US: {
    currency: '$',
    bands: {
      salon: '$1,500–$4,000',
      'beauty salon': '$1,500–$4,000',
      'real estate': '$5,000–$15,000',
      restaurant: '$2,000–$6,000',
      clinic: '$3,000–$10,000',
    },
    defaultBand: '$1,500–$10,000',
    channelNorm: 'Email is primary for cold outreach. Be concise and professional. Subject line matters most.',
    toneRegister: 'Confident, concise, professional. Lead with value. Americans respond to ROI framing.',
    localObjections: [
      '"We already have a Google Business listing"',
      '"Our marketing agency handles our digital presence"',
      '"We\'re too busy to take on a new project"',
    ],
  },
  UK: {
    currency: '£',
    bands: {
      salon: '£1,000–£3,000',
      'beauty salon': '£1,000–£3,000',
      'real estate': '£4,000–£12,000',
      restaurant: '£1,500–£4,500',
      clinic: '£2,500–£8,000',
    },
    defaultBand: '£1,000–£8,000',
    channelNorm: 'Email is primary. Slightly formal tone. Quality signals matter — avoid pushy language.',
    toneRegister: 'Professional, understated, credible. British businesses respond to proof over promises.',
    localObjections: [
      '"We already have a Yell listing and Google Business"',
      '"Our current website works fine"',
      '"We\'re not sure the ROI is there"',
    ],
  },
  CA: {
    currency: 'C$',
    bands: {
      salon: 'C$2,000–C$5,000',
      'beauty salon': 'C$2,000–C$5,000',
      'real estate': 'C$6,000–C$18,000',
      restaurant: 'C$2,500–C$7,000',
      clinic: 'C$4,000–C$12,000',
    },
    defaultBand: 'C$2,000–C$12,000',
    channelNorm: 'Email primary for cold outreach. Professional and warm tone. Bilingual awareness for Quebec.',
    toneRegister: 'Professional, friendly, direct. Canadians value politeness and clarity equally.',
    localObjections: [
      '"We use Wix or Squarespace and it works fine"',
      '"We\'re already on Google Maps"',
      '"Budget is tight right now"',
    ],
  },
  UG: {
    currency: 'UGX',
    bands: { salon: 'UGX 600,000–UGX 1,500,000', 'real estate': 'UGX 3,000,000–UGX 8,000,000' },
    defaultBand: 'UGX 600,000–UGX 3,000,000',
    channelNorm: 'WhatsApp is primary. Mobile-first essential.',
    toneRegister: 'Warm, respectful, peer-to-peer.',
    localObjections: ['"Referrals and Instagram are enough"', '"Too expensive"'],
  },
  TZ: {
    currency: 'TZS',
    bands: { salon: 'TZS 250,000–TZS 600,000', 'real estate': 'TZS 1,200,000–TZS 4,000,000' },
    defaultBand: 'TZS 250,000–TZS 2,000,000',
    channelNorm: 'WhatsApp is primary. Mobile-first essential.',
    toneRegister: 'Warm, respectful, direct.',
    localObjections: ['"Referrals are enough"', '"Cost is a concern"'],
  },
  RW: {
    currency: 'RWF',
    bands: { salon: 'RWF 200,000–RWF 500,000', 'real estate': 'RWF 1,000,000–RWF 3,500,000' },
    defaultBand: 'RWF 200,000–RWF 1,500,000',
    channelNorm: 'Mobile-first. WhatsApp widely used.',
    toneRegister: 'Professional, warm. Rwanda market values innovation and growth.',
    localObjections: ['"Social media is sufficient"', '"Not in the budget now"'],
  },
  SN: {
    currency: 'FCFA',
    bands: { salon: 'FCFA 150,000–FCFA 400,000', 'real estate': 'FCFA 700,000–FCFA 2,500,000' },
    defaultBand: 'FCFA 150,000–FCFA 1,000,000',
    channelNorm: 'WhatsApp and Facebook primary. Mobile-first essential.',
    toneRegister: 'Warm, respectful, relationship-first.',
    localObjections: ['"Facebook works fine"', '"Too expensive"'],
  },
  CM: {
    currency: 'FCFA',
    bands: { salon: 'FCFA 150,000–FCFA 400,000', 'real estate': 'FCFA 700,000–FCFA 2,500,000' },
    defaultBand: 'FCFA 150,000–FCFA 1,000,000',
    channelNorm: 'WhatsApp and Facebook primary. Bilingual (French/English) market.',
    toneRegister: 'Warm, relationship-first. Formal address can build trust initially.',
    localObjections: ['"Facebook page is enough"', '"Website costs are too high"'],
  },
};

function resolvePriceBand(config: CountryConfig, industry: string): string {
  const key = industry.toLowerCase();
  for (const [pattern, band] of Object.entries(config.bands)) {
    if (key.includes(pattern)) return band;
  }
  return config.defaultBand;
}

export function localizationInstruction(
  ctx: ProspectContext,
): { text: string; priceBand: string } {
  const config = COUNTRY_CONFIGS[ctx.country] ?? COUNTRY_CONFIGS['NG'];
  const priceBand = resolvePriceBand(config, ctx.industry);

  const channelLimits: Record<string, string> = {
    whatsapp: '≤120 words total — count before outputting, shorten if needed. No subject line. End with one question answerable in a single tap.',
    email: '≤200 words body. Include a subject line. No more than 3 short paragraphs.',
    dm: '≤80 words. Most casual register. Single-sentence hook.',
  };

  const text = `LOCALIZATION — ${ctx.country}, ${ctx.city}, ${ctx.industry} — MANDATORY

Currency: ${config.currency} only. Never use $, £, or any other currency symbol.
Price band for this market/industry: A ${ctx.industry} website in this market is typically ${priceBand}. If pricing comes up, stay in that band.

Channel: ${ctx.channel}
Hard limits: ${channelLimits[ctx.channel] ?? channelLimits.email}

Tone register: ${config.toneRegister}

${config.channelNorm}

Local objection awareness: This prospect is in ${ctx.country}. Common local objections include: ${config.localObjections.join(', ')}. If ONE is relevant to this message, address it proactively and briefly — do NOT list all of them.`;

  return { text, priceBand };
}
