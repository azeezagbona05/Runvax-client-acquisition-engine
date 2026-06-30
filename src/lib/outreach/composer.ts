import type { ProspectContext, RouterSelection, SenderProfile } from './types';
import { persuasionInstruction } from './persuasion';
import { ctaInstruction } from './cta';
import { localizationInstruction } from './localization';
import {
  POSITIONING,
  DIGITAL_CONCEPTS,
  REVIEW_ANGLE,
  HARD_BANS,
  whatsappFormatting,
  checklistInstruction,
  senderIdentity,
} from './assets';

// Determines whether this intent generates multi-part output (whatsapp + email)
// or a single message (reply, proposal, reports).
function isMultiChannel(intent: ProspectContext['intent']): boolean {
  return intent === 'cold_first_touch' || intent === 'audit_outreach';
}

// Builds the output contract block — tells the model exactly what to return.
function outputContractBlock(ctx: ProspectContext, profile: SenderProfile): string {
  if (isMultiChannel(ctx.intent)) {
    return `OUTPUT FORMAT — FOLLOW EXACTLY, NO DEVIATIONS:

---WHATSAPP---
[WhatsApp message — STRICTLY ≤120 words. Short paragraphs (1–2 sentences), blank line between each.
FORMATTING: *bold* for business name / key numbers / core offer; _italic_ for emotional lines and the CTA question.
CHECKLIST: include exactly 3 ✅ lines (4–6 words each) between the agitation and the CTA — these must be feature-specific to a ${ctx.industry} and must dismantle the top objections.
End with the CTA on its own line in _italic_.
Do NOT add a signature.]

---EMAIL-SUBJECT---
[Subject line — max 8 words. Specific to this business and city. Intriguing, not salesy.]

---EMAIL-BODY---
[Email body — STRICTLY ≤200 words. Short paragraphs, one idea each.
Open with the same core hook as the WhatsApp, phrased differently.
Include a checklist titled "Here's what your digital front door (website) would include:" with 4–6 ✅ items — concrete, ${ctx.industry}-specific, objection-dismantling.
End with ONE clear, low-friction CTA.
Sign: ${profile.senderName} from ${profile.businessName}.]`;
  }

  // Single-channel intents
  const channelInstructions: Record<string, string> = {
    whatsapp: `Output a single WhatsApp message, ≤120 words, formatted with *bold* and _italic_ as specified. No delimiters.`,
    email: `Output a subject line on the first line (max 8 words), then a blank line, then the email body (≤200 words). No delimiters.`,
    dm: `Output a single DM message, ≤80 words, casual register. No delimiters.`,
  };

  return `OUTPUT FORMAT:
${channelInstructions[ctx.channel] ?? channelInstructions.email}
Output only the final message — no preamble, no "here's the message:", no framework labels.`;
}

export function composePrompt(
  ctx: ProspectContext,
  selection: RouterSelection,
  profile: SenderProfile,
): { system: string; user: string } {
  const { primary, secondary, principle, ctaLevel, objectionReframe } = selection;
  const { text: locText, priceBand } = localizationInstruction(ctx);

  // ── Block 1: Role ──────────────────────────────────────────────────────────
  const roleBlock = `You are an elite local-business sales specialist and copywriter operating in ${ctx.city}, ${ctx.country}. You help web designers and digital agencies close deals with local SMBs. You know the local market, local pricing, and how local business owners think and communicate.`;

  // ── Block 2: Framework ────────────────────────────────────────────────────
  const frameworkBlock = [
    `PRIMARY FRAMEWORK: ${primary.name}`,
    `Apply in this order:`,
    primary.structure.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    `Template guidance: ${primary.template}`,
    secondary
      ? `\nSECONDARY BLEND: ${secondary.name}\nWhere the primary gives structure, let ${secondary.name} add texture:\n${secondary.structure.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : '',
    `\nDo NOT label these steps in the message. The reader feels the shape; they don't see it.`,
  ].filter(Boolean).join('\n');

  // ── Block 3: Persuasion ───────────────────────────────────────────────────
  const persuasionBlock = persuasionInstruction(principle, ctx);

  // ── Block 4: Localization ─────────────────────────────────────────────────
  const localizationBlock = locText;

  // ── Block 5: CTA ──────────────────────────────────────────────────────────
  const ctaBlock = ctaInstruction(ctaLevel, ctx);

  // ── Block 6: House style ──────────────────────────────────────────────────
  const houseStyleParts = [
    POSITIONING,
    DIGITAL_CONCEPTS,
    ctx.reviewCount ? REVIEW_ANGLE : '',
    ctx.channel === 'whatsapp' ? whatsappFormatting() : '',
    checklistInstruction(ctx.industry),   // spike fix: always included
    senderIdentity(profile),
    HARD_BANS,
  ].filter(Boolean);
  const houseStyleBlock = houseStyleParts.join('\n\n');

  // ── Block 7: Hard constraints ─────────────────────────────────────────────
  const constraintsBlock = `RULES YOU MUST FOLLOW:
- The business owner is the HERO of this message. You are their guide. Never position yourself as the star.
- Use ONLY the currency symbol for their country (${ctx.country}).
- Do NOT fabricate statistics, reviews, or results you don't have data for.
- Do NOT use placeholder text like [INSERT NAME] — use the real data provided.
- Do NOT mention competitor tool names (Apollo, ZoomInfo, HubSpot, etc).
- Channel: ${ctx.channel}. Obey the word limit for this channel strictly.${objectionReframe ? `\n- OBJECTION REFRAME to use if the objection arises: "${objectionReframe}"` : ''}`;

  // ── Block 8: Quality self-check ───────────────────────────────────────────
  const qualityBlock = `QUALITY SELF-CHECK — RUN SILENTLY BEFORE WRITING. IF ANY FAILS, REWRITE.
4 C's: Clear? Concise? Compelling? Credible?
4 U's: Is the opener Useful? Urgent? Unique? Ultra-specific to THIS business?
Hero check: Is the business owner the hero?
Checklist check: Are the ✅ features concrete, industry-specific, and objection-dismantling — not generic?
If any check fails, rewrite before outputting. Output only the final message — no preamble, no explanation, no framework labels.`;

  // ── Block 9: Output contract ──────────────────────────────────────────────
  const outputBlock = outputContractBlock(ctx, profile);

  // Assemble system prompt in fixed order — never reorder.
  // Output contract goes in the USER message (higher model attention, clearer expectation).
  const system = [
    roleBlock,
    frameworkBlock,
    persuasionBlock,
    localizationBlock,
    ctaBlock,
    houseStyleBlock,
    constraintsBlock,
    qualityBlock,
  ].join('\n\n---\n\n');

  // User prompt: prospect data as clean JSON + output contract.
  const prospectJson = JSON.stringify({
    businessName: ctx.businessName,
    shortName: ctx.businessName.includes('(')
      ? ctx.businessName.split('(')[0].trim()
      : ctx.businessName,
    industry: ctx.industry,
    city: ctx.city,
    country: ctx.country,
    hasWebsite: ctx.hasWebsite,
    socialOnly: ctx.socialOnly,
    leadScore: ctx.leadScore,
    ...(ctx.rating != null && { rating: ctx.rating }),
    ...(ctx.reviewCount != null && { reviewCount: ctx.reviewCount }),
    ...(ctx.competitorWithSite && { competitorWithSite: ctx.competitorWithSite }),
    channel: ctx.channel,
    intent: ctx.intent,
    ...(ctx.followupStep != null && { followupStep: ctx.followupStep }),
    priceBand,
  }, null, 2);

  const requireAll = isMultiChannel(ctx.intent)
    ? '\n\nYOU MUST produce all three sections in the exact order shown above.\nDo not stop after the WhatsApp section. All three are required.'
    : '';

  const user = `${prospectJson}\n\n${outputBlock}${requireAll}`;

  return { system, user };
}
