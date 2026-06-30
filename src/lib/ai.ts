import OpenAI from 'openai';

/**
 * Unified AI provider layer.
 *
 * Default provider = OpenAI. Switch to Gemini where you want it:
 *   - Globally:    AI_PROVIDER_DEFAULT=gemini
 *   - Per feature: AI_PROVIDER_<FEATURE>=gemini   (e.g. AI_PROVIDER_BRIEF=gemini)
 *
 * Gemini's edge is the Market Brief (live Google Search grounding) — set
 * AI_PROVIDER_BRIEF=gemini to turn that on; otherwise everything runs on OpenAI.
 *
 * If the chosen provider has no API key, it falls back to the other one.
 */

export type AIProvider = 'openai' | 'gemini';

export interface GenerateOptions {
  prompt: string;
  system?: string;
  json?: boolean;          // ask for JSON output
  search?: boolean;        // Gemini only: enable live Google Search grounding
  maxTokens?: number;
  temperature?: number;
  model?: string;          // override the default model
  provider?: AIProvider;   // force a provider
  feature?: string;        // resolve default provider via providerFor()
}

export interface AISource { title: string; uri: string }

export interface GenerateResult {
  text: string;
  provider: AIProvider;
  sources?: AISource[];    // grounding citations (Gemini search)
  inputTokens?: number;
  outputTokens?: number;
}

const GEMINI_DEFAULT_MODEL = 'gemini-2.0-flash';
const OPENAI_DEFAULT_MODEL = 'gpt-4o';

export function hasProvider(p: AIProvider): boolean {
  return p === 'gemini' ? !!process.env.GEMINI_API_KEY : !!process.env.OPENAI_API_KEY;
}

/** Resolve the provider for a feature. OpenAI is the default; Gemini is opt-in via env. */
export function providerFor(feature?: string): AIProvider {
  // 1. Per-feature override wins: AI_PROVIDER_BRIEF=gemini, etc.
  const envVal = feature ? process.env[`AI_PROVIDER_${feature.toUpperCase()}`] : undefined;
  if (envVal === 'gemini' || envVal === 'openai') return envVal;
  // 2. Global default override: AI_PROVIDER_DEFAULT=gemini
  const globalDefault = process.env.AI_PROVIDER_DEFAULT;
  if (globalDefault === 'gemini' || globalDefault === 'openai') return globalDefault;
  // 3. Fall back to OpenAI.
  return 'openai';
}

/** Pull a JSON object out of a model response (handles ```json fences / surrounding prose). */
export function extractJson<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let s = (fenced ? fenced[1] : text).trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first >= 0 && last > first) s = s.slice(first, last + 1);
  return JSON.parse(s) as T;
}

async function generateOpenAI(o: GenerateOptions): Promise<GenerateResult> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: o.model ?? OPENAI_DEFAULT_MODEL,
    max_tokens: o.maxTokens ?? 1200,
    ...(o.temperature != null ? { temperature: o.temperature } : {}),
    ...(o.json ? { response_format: { type: 'json_object' as const } } : {}),
    messages: [
      ...(o.system ? [{ role: 'system' as const, content: o.system }] : []),
      { role: 'user' as const, content: o.prompt },
    ],
  });
  return {
    text: completion.choices[0]?.message?.content ?? '',
    provider: 'openai',
    inputTokens: completion.usage?.prompt_tokens,
    outputTokens: completion.usage?.completion_tokens,
  };
}

interface GeminiPart { text?: string }
interface GeminiChunk { web?: { uri?: string; title?: string } }
interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    groundingMetadata?: { groundingChunks?: GeminiChunk[] };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
}

async function generateGemini(o: GenerateOptions): Promise<GenerateResult> {
  const model = o.model ?? GEMINI_DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: o.prompt }] }],
    generationConfig: {
      ...(o.temperature != null ? { temperature: o.temperature } : {}),
      ...(o.maxTokens ? { maxOutputTokens: o.maxTokens } : {}),
      // responseMimeType (JSON mode) cannot be combined with the search tool —
      // when grounding is on we rely on prompt-instructed JSON + extractJson().
      ...(o.json && !o.search ? { responseMimeType: 'application/json' } : {}),
    },
  };
  if (o.system) body.systemInstruction = { parts: [{ text: o.system }] };
  if (o.search) body.tools = [{ google_search: {} }];

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 240)}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('');

  const seen = new Set<string>();
  const sources: AISource[] = (cand?.groundingMetadata?.groundingChunks ?? [])
    .map((c) => c.web)
    .filter((w): w is { uri: string; title?: string } => !!w?.uri)
    .map((w) => ({ uri: w.uri, title: w.title || w.uri }))
    .filter((s) => (seen.has(s.uri) ? false : (seen.add(s.uri), true)));

  return {
    text,
    provider: 'gemini',
    sources,
    inputTokens: data.usageMetadata?.promptTokenCount,
    outputTokens: data.usageMetadata?.candidatesTokenCount,
  };
}

/** Generate text with the resolved provider, with a resilient fallback to the other. */
export async function generate(o: GenerateOptions): Promise<GenerateResult> {
  let provider = o.provider ?? providerFor(o.feature);
  if (!hasProvider(provider)) provider = provider === 'gemini' ? 'openai' : 'gemini';

  try {
    return provider === 'gemini' ? await generateGemini(o) : await generateOpenAI(o);
  } catch (err) {
    const other: AIProvider = provider === 'gemini' ? 'openai' : 'gemini';
    if (hasProvider(other)) {
      return other === 'gemini' ? await generateGemini(o) : await generateOpenAI(o);
    }
    throw err;
  }
}
