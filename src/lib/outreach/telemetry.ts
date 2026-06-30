import type { GenerationResult, ProspectContext } from './types';

interface TelemetryParams {
  prospectId?: string;
  userId?: string;
  result: GenerationResult;
  ctx: ProspectContext;
  priceBand?: string;
}

// Writes one OutreachEvent row per generation.
// Fire-and-forget — never blocks or throws into the request path.
// prisma/schema.prisma must have the OutreachEvent model before this runs.
export async function logOutreachEvent(params: TelemetryParams): Promise<void> {
  const { prospectId, userId, result, ctx, priceBand } = params;
  const { meta } = result;

  // Lazy-import prisma so this module doesn't break if called before schema migration.
  let prisma: import('@prisma/client').PrismaClient;
  try {
    const { prisma: p } = await import('@/lib/prisma');
    prisma = p;
  } catch {
    // Prisma not available yet — migration hasn't run. Skip silently.
    return;
  }

  try {
    await (prisma as unknown as Record<string, { create: (args: unknown) => Promise<unknown> }>)
      .outreachEvent
      .create({
        data: {
          prospectId: prospectId ?? null,
          userId: userId ?? null,
          frameworkId: meta.frameworkId,
          secondaryFrameworkId: meta.secondaryFrameworkId ?? null,
          persuasionPrinciple: meta.persuasionPrinciple,
          ctaLevel: meta.ctaLevel,
          channel: meta.channel,
          intent: meta.intent,
          industry: ctx.industry,
          city: ctx.city,
          country: ctx.country,
          leadScore: ctx.leadScore,
          priceBand: priceBand ?? null,
          passedQualityGate: meta.passedQualityGate,
          provider: meta.provider,
          model: meta.model ?? null,
          outcome: null, // filled later when stage changes to won/lost
        },
      });
  } catch {
    // Never surface telemetry errors to the caller.
  }
}
