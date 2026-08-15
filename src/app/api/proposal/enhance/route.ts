import { NextRequest, NextResponse } from 'next/server';
import { checkAndIncrementAI, requireFeature } from '@/lib/usage';
import { generate, hasProvider } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Proposal-level rewrites. Deliberately separate from /api/enhance: that one is
// tuned for short single-channel messages, where "make it shorter" is almost
// always right. A proposal is a structured commercial document — the rewrite has
// to preserve headings, tables, packages and every figure in it.

const MODES: Record<string, string> = {
  improve:
    'Improve the whole proposal — sharper writing, clearer value, better flow. Keep every section, all figures and the same overall length.',
  persuasive:
    'Strengthen the persuasive case. Make the problem more vivid and the outcome more concrete. Do not add pressure tactics or fake scarcity.',
  premium:
    'Reposition this as a premium engagement. More authoritative and confident, less eager. Justify the value of the quoted price without changing the price itself.',
  simpler:
    'Rewrite in plainer language for a non-technical business owner. Remove jargon and explain any technical term that must stay. Keep it respectful, never condescending.',
  shorter:
    'Tighten the proposal. Cut padding and repetition so it can be skimmed in two minutes. Keep every section heading, every package and every figure.',
  objections:
    'Strengthen how this proposal pre-empts objections (too expensive, not the right time, we already know a developer, we will do it in-house). Weave the answers into the existing sections, or add one short section if there is a natural place for it.',
  roi:
    'Strengthen the business case. Make the cost of doing nothing and the expected return more concrete and specific to this business type. Use realistic, defensible numbers — never invent precise statistics or cite fake studies.',
  grammar:
    'Fix only spelling, grammar, punctuation and formatting consistency. Do NOT change tone, structure, length, wording choices or meaning.',
};

export async function POST(req: NextRequest) {
  if (!hasProvider('openai') && !hasProvider('gemini')) {
    return NextResponse.json({ error: 'No AI provider configured' }, { status: 500 });
  }

  const { text, mode, instruction, context } = await req.json() as {
    text?: string;
    mode?: string;
    /** Free-text steer from the "Tell it what to change" box. */
    instruction?: string;
    context?: Record<string, unknown>;
  };

  if (!text?.trim()) {
    return NextResponse.json({ error: 'No proposal to enhance' }, { status: 400 });
  }

  // Same gate as generating a proposal — enhancing is part of that feature.
  const gate = await requireFeature(req, 'proposals');
  if (!gate.ok) return gate.error!;

  const usage = await checkAndIncrementAI(req);
  if (!usage.ok) return usage.error!;

  const directive = mode === 'custom'
    ? (instruction?.trim() || MODES.improve)
    : (MODES[mode ?? 'improve'] ?? MODES.improve);

  const system = `You are a senior proposal writer for a web design agency, editing a proposal that has already been generated and may have been hand-edited by the agency owner.

Rewrite the document according to the instruction. This is an edit, not a fresh draft.

PRESERVE EXACTLY — these are commercial commitments, not prose:
— Every price, currency symbol and number. Never change, round, add or remove a figure.
— Bank name, account number and account name, and any payment link.
— Timelines, delivery dates, revision counts, validity periods and deposit/balance percentages.
— The client's business name, the agency's name, and all contact details.
— Package names and what each package includes.
— Any URL or portfolio link.

PRESERVE STRUCTURALLY:
— Markdown formatting: headings (#, ##), bold, bullet lists and especially tables — pipe tables must stay valid, with the same columns and rows.
— Section order. Do not reorder, merge or drop sections unless the instruction explicitly asks for it.

NEVER:
— Invent statistics, studies, awards, client names or testimonials.
— Add placeholders like [INSERT X] — if information is missing, write around it.
— Add commentary about your edit, or wrap the output in a code fence.

Return ONLY the complete rewritten proposal in markdown, starting from its first line.`;

  const ctxBlock = context && Object.keys(context).length
    ? `\n\nContext about the client (use only if it makes the proposal more specific):\n${JSON.stringify(context)}`
    : '';

  try {
    const result = await generate({
      feature: 'proposal_enhance',
      system,
      prompt: `INSTRUCTION: ${directive}${ctxBlock}\n\nPROPOSAL TO REWRITE:\n\n${text}`,
      // Proposals run long — a truncated rewrite would silently drop the payment
      // terms at the bottom, so this ceiling is generous on purpose.
      maxTokens: 6000,
      temperature: mode === 'grammar' ? 0.2 : 0.7,
    });

    const out = result.text.trim().replace(/^```(?:markdown|md)?\s*|\s*```$/g, '');
    if (!out) return NextResponse.json({ error: 'Enhancer returned nothing' }, { status: 502 });

    return NextResponse.json({ text: out });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to enhance proposal' },
      { status: 500 },
    );
  }
}
