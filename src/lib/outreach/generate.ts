import { generate as aiGenerate } from '@/lib/ai';
import type { ProspectContext, GenerationResult, OutreachOutput, SenderProfile } from './types';
import { selectFrameworks } from './router';
import { composePrompt } from './composer';
import { runQualityGate } from './quality-gate';
import { logOutreachEvent } from './telemetry';
import { localizationInstruction } from './localization';

function parseOutput(
  text: string,
  ctx: ProspectContext,
): OutreachOutput {
  // Multi-channel intents use delimiters matching the existing outreach/route.ts format.
  if (ctx.intent === 'cold_first_touch' || ctx.intent === 'audit_outreach') {
    const whatsapp = text.match(/---WHATSAPP---([\s\S]*?)---EMAIL-SUBJECT---/)?.[1]?.trim();
    const emailSubject = text.match(/---EMAIL-SUBJECT---([\s\S]*?)---EMAIL-BODY---/)?.[1]?.trim();
    const emailBody = text.match(/---EMAIL-BODY---([\s\S]*?)$/)?.[1]?.trim();
    return { whatsapp, emailSubject, emailBody };
  }

  // Single-channel intents: populate the appropriate field.
  if (ctx.channel === 'whatsapp') return { whatsapp: text.trim() };
  if (ctx.channel === 'dm') return { dm: text.trim() };
  // email: first line is subject, rest is body
  const lines = text.trim().split('\n');
  const emailSubject = lines[0]?.trim();
  const emailBody = lines.slice(2).join('\n').trim(); // skip blank line
  return { emailSubject, emailBody };
}

// The only new production code that calls the AI layer.
// All existing endpoint AI calls remain untouched until Phase 2 is approved.
export async function generate(
  ctx: ProspectContext,
  profile: SenderProfile,
): Promise<GenerationResult> {
  const selection = selectFrameworks(ctx);
  const { system, user } = composePrompt(ctx, selection, profile);
  const { priceBand } = localizationInstruction(ctx);

  const aiRes = await aiGenerate({
    system,
    prompt: user,
    temperature: 0.9,
    maxTokens: 650,     // conversational messages are shorter — ~250 words total across both channels
    feature: 'outreach',
  });

  let output = parseOutput(aiRes.text, ctx);
  let qg = runQualityGate(output, ctx);

  // Tier-2 retry: only if QUALITY_GATE_LLM=true and gate failed.
  if (!qg.pass && process.env.QUALITY_GATE_LLM === 'true') {
    const critiquePrompt = `${user}\n\nPREVIOUS DRAFT HAD THESE ISSUES:\n${qg.notes.join('\n')}\n\nPlease rewrite, fixing ALL issues listed above. Keep everything else the same.`;
    const retryRes = await aiGenerate({
      system,
      prompt: critiquePrompt,
      temperature: 0.7,
      maxTokens: 1100,
      feature: 'outreach',
    });
    output = parseOutput(retryRes.text, ctx);
    qg = runQualityGate(output, ctx);
  }

  const result: GenerationResult = {
    output,
    meta: {
      frameworkId: selection.primary.id,
      secondaryFrameworkId: selection.secondary?.id,
      persuasionPrinciple: selection.principle,
      ctaLevel: selection.ctaLevel,
      channel: ctx.channel,
      intent: ctx.intent,
      passedQualityGate: qg.pass,
      qualityNotes: qg.notes.length ? qg.notes : undefined,
      priceBand,
      provider: aiRes.provider,
    },
  };

  // Fire-and-forget — never awaited in the critical path.
  void logOutreachEvent({
    prospectId: ctx.prospectId,
    userId: ctx.userId,
    result,
    ctx,
    priceBand,
  });

  return result;
}
