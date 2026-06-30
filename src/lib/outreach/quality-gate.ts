import type { OutreachOutput, ProspectContext } from './types';

const CURRENCY_SYMBOLS: Record<string, string[]> = {
  NG: ['₦'],
  GH: ['GH₵', 'GHS'],
  KE: ['KES'],
  ZA: ['R'],
  US: ['$', 'USD'],
  UK: ['£', 'GBP'],
  CA: ['C$', 'CAD'],
  UG: ['UGX'],
  TZ: ['TZS'],
  RW: ['RWF'],
  SN: ['FCFA', 'CFA'],
  CM: ['FCFA', 'CFA'],
};

const BANNED_PHRASES = [
  'i hope this finds you well',
  'i hope this message finds you',
  'as per my last',
  'i wanted to reach out',
  'just following up',
  'just checking in',
  'touching base',
  'synergy',
  'leverage',
  'game-changer',
  'game changer',
];

const BANNED_TOOL_NAMES = ['apollo', 'zoominfo', 'hubspot', 'salesforce', 'mailchimp'];

// Matches unfilled placeholders like [INSERT NAME] but NOT "digital front door (website)"
const PLACEHOLDER_RE = /\[[A-Z][A-Z\s]+\]/g;

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function hasPriceMention(text: string): boolean {
  return /\d[\d,.]*(k|thousand|hundred|million)?/.test(text.toLowerCase());
}

function correctCurrencyUsed(text: string, country: string): boolean {
  const symbols = CURRENCY_SYMBOLS[country] ?? [];
  // Only check if a price is actually mentioned
  if (!hasPriceMention(text)) return true;
  return symbols.some(s => text.includes(s));
}

function checkChannel(
  text: string,
  channel: string,
  notes: string[],
): boolean {
  const limits: Record<string, number> = { whatsapp: 120, email: 200, dm: 80 };
  const limit = limits[channel];
  if (!limit) return true;
  const wc = wordCount(text);
  if (wc > limit) {
    notes.push(`${channel} over word limit: ${wc} words (max ${limit})`);
    return false;
  }
  return true;
}

function runChecksOnText(
  text: string,
  label: string,
  channel: string,
  country: string,
  notes: string[],
): boolean {
  let pass = true;
  const lower = text.toLowerCase();

  // Banned phrases
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      notes.push(`${label}: banned phrase found — "${phrase}"`);
      pass = false;
    }
  }

  // Banned tool names
  for (const tool of BANNED_TOOL_NAMES) {
    if (lower.includes(tool)) {
      notes.push(`${label}: competitor tool name mentioned — "${tool}"`);
      pass = false;
    }
  }

  // Unfilled placeholders
  const placeholders = text.match(PLACEHOLDER_RE);
  if (placeholders) {
    notes.push(`${label}: unfilled placeholder(s) — ${placeholders.join(', ')}`);
    pass = false;
  }

  // Currency
  if (!correctCurrencyUsed(text, country)) {
    const expected = CURRENCY_SYMBOLS[country]?.[0] ?? '(unknown)';
    notes.push(`${label}: price mentioned but wrong currency — expected ${expected}`);
    pass = false;
  }

  // Word count
  if (!checkChannel(text, channel, notes)) pass = false;

  // CTA question count (only for whatsapp/dm)
  if (channel === 'whatsapp' || channel === 'dm') {
    const questions = (text.match(/\?/g) || []).length;
    if (questions === 0) {
      notes.push(`${label}: no CTA question found`);
      pass = false;
    }
    if (questions > 2) {
      notes.push(`${label}: too many questions (${questions}) — max 2`);
      pass = false;
    }
  }

  return pass;
}

export function runQualityGate(
  output: OutreachOutput,
  ctx: ProspectContext,
): { pass: boolean; notes: string[] } {
  const notes: string[] = [];
  let pass = true;

  if (output.whatsapp) {
    if (!runChecksOnText(output.whatsapp, 'WhatsApp', 'whatsapp', ctx.country, notes)) pass = false;
  }
  if (output.emailBody) {
    if (!runChecksOnText(output.emailBody, 'Email', 'email', ctx.country, notes)) pass = false;
  }
  if (output.dm) {
    if (!runChecksOnText(output.dm, 'DM', 'dm', ctx.country, notes)) pass = false;
  }
  if (output.message) {
    if (!runChecksOnText(output.message, 'Message', ctx.channel, ctx.country, notes)) pass = false;
  }

  return { pass, notes };
}
