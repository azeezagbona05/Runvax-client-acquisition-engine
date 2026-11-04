import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { modelFor, estimateCostMicros, type AgentKey } from './models';
import { UNTRUSTED_POLICY, wrapUntrusted } from './untrusted';

/**
 * The only way acquisition agents call a model. Output is constrained with
 * OpenAI structured outputs and then re-validated with the same Zod schema
 * before anything can use it, so malformed or off-schema output becomes a
 * failed attempt rather than application state. The model gets no tools: it
 * returns data, and backend code decides what (if anything) to do with it.
 */

/** The subset of the OpenAI client this module uses — lets tests inject a fake. */
export interface StructuredClient {
  chat: {
    completions: {
      parse: (body: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<{
        choices: Array<{ message: { parsed?: unknown; refusal?: string | null } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
      }>;
    };
  };
}

export class StructuredOutputError extends Error {}

export interface RunStructuredParams<T extends z.ZodType> {
  agent: AgentKey;
  schema: T;
  schemaName: string;
  /** Trusted instructions written by us. */
  instructions: string;
  /** Trusted, structured facts from our own database. */
  facts?: Record<string, unknown>;
  /** Third-party content (pages, replies, rows) — always wrapped as data. */
  untrusted?: Array<{ label: string; content: string; maxChars?: number }>;
  runId?: string;
  signal?: AbortSignal;
  maxTokens?: number;
  client?: StructuredClient;
}

let defaultClient: StructuredClient | null = null;

function getClient(): StructuredClient {
  if (!process.env.OPENAI_API_KEY) throw new StructuredOutputError('OPENAI_API_KEY is not configured');
  if (!defaultClient) {
    defaultClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 40_000, maxRetries: 1 }) as unknown as StructuredClient;
  }
  return defaultClient;
}

export async function runStructured<T extends z.ZodType>(params: RunStructuredParams<T>): Promise<z.infer<T>> {
  const client = params.client ?? getClient();
  const model = modelFor(params.agent);

  const userParts = [
    params.facts ? `Known facts (from our records):\n${JSON.stringify(params.facts)}` : '',
    ...(params.untrusted ?? []).map((u) => wrapUntrusted(u.label, u.content, u.maxChars)),
  ].filter(Boolean);

  const completion = await client.chat.completions.parse(
    {
      model,
      max_tokens: params.maxTokens ?? 1200,
      temperature: 0.2,
      response_format: zodResponseFormat(params.schema, params.schemaName),
      messages: [
        { role: 'system', content: `${params.instructions}\n\n${UNTRUSTED_POLICY}` },
        { role: 'user', content: userParts.join('\n\n') || 'No input provided.' },
      ],
    },
    { signal: params.signal },
  );

  const inputTokens = completion.usage?.prompt_tokens ?? 0;
  const outputTokens = completion.usage?.completion_tokens ?? 0;
  if (params.runId) {
    await prisma.acquisitionAgentRun.update({
      where: { id: params.runId },
      data: {
        provider: 'openai',
        model,
        inputTokens,
        outputTokens,
        costUsdMicros: estimateCostMicros(model, inputTokens, outputTokens),
      },
    });
  }

  const message = completion.choices[0]?.message;
  if (!message) throw new StructuredOutputError('Model returned no choices');
  if (message.refusal) throw new StructuredOutputError(`Model refused: ${message.refusal.slice(0, 200)}`);

  // Never trust the SDK's parse alone — validate again before use.
  const checked = params.schema.safeParse(message.parsed);
  if (!checked.success) {
    throw new StructuredOutputError(`Model output failed validation: ${checked.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ').slice(0, 500)}`);
  }
  return checked.data;
}
