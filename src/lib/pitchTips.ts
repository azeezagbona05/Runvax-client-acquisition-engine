// Free, instant writing tips for outreach drafts — pure heuristics, no API cost.
// Returns up to `max` short, actionable suggestions based on the current text.

export type PitchKind = 'whatsapp' | 'email' | 'generic';

const CLICHES = [
  /i hope this (message|email|finds you)/i,
  /my name is .{0,30} and i/i,
  /are you interested in/i,
  /to whom it may concern/i,
  /dear sir\/?\s?madam/i,
];

export function pitchTips(text: string, kind: PitchKind = 'generic', max = 3): string[] {
  const t = text.trim();
  const tips: string[] = [];
  if (!t) return tips;

  const words = t.split(/\s+/).filter(Boolean).length;
  const hasQuestion = /\?/.test(t);
  // Count emoji via surrogate pairs (avoids the unicode-property `u` flag)
  const emojiCount = (t.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g) || []).length;
  const hasChecklist = /✅|•\s|^[-*]\s/m.test(t);
  const shouty = (t.match(/\b[A-Z]{4,}\b/g) || []).length;

  // Clichés first — highest value
  if (CLICHES.some((re) => re.test(t))) tips.push('Drop the generic opener — it reads like a template. Start with something specific about them.');

  if (!hasQuestion) tips.push('End with a soft question to invite a reply.');

  if (kind === 'whatsapp') {
    if (words > 130) tips.push(`Trim it — WhatsApp pitches land best under ~120 words (you're at ${words}).`);
    if (emojiCount > 3) tips.push('Ease up on emojis — 1–2 placed naturally is ideal.');
    if (!hasChecklist) tips.push('Add a tiny ✅ checklist of 2–3 features to picture the result.');
  }

  if (kind === 'email') {
    if (words < 40) tips.push('A little thin — add one concrete benefit or proof point.');
    if (words > 230) tips.push(`Tighten it — keep cold emails skimmable (you're at ${words} words).`);
    if (!hasChecklist) tips.push('Add a short "what your site would include" checklist to pre-empt objections.');
  }

  if (shouty > 0) tips.push('Avoid words in ALL CAPS — it reads as shouting.');

  if (!/\b(you|your)\b/i.test(t)) tips.push('Make it about them — use "you/your" more than "I/we".');

  return tips.slice(0, max);
}
