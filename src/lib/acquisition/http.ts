import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AdminActionError } from './admin';
import { ImportError } from './imports/service';
import { redactSecrets } from './redact';
import { DraftError } from './drafts';
import { TransitionError } from './lifecycle';

// Shared request/response handling for /api/acquisition routes.

export class BodyTooLargeError extends Error {}

export async function readJson(req: NextRequest, maxBytes = 64 * 1024): Promise<unknown> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new BodyTooLargeError(`Request body over ${maxBytes} bytes`);
  const text = await req.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new BodyTooLargeError(`Request body over ${maxBytes} bytes`);
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new AdminActionError('Body must be JSON'); }
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof BodyTooLargeError) return NextResponse.json({ error: err.message }, { status: 413 });
  if (err instanceof ZodError) {
    return NextResponse.json({ error: 'Invalid request', issues: err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`) }, { status: 400 });
  }
  if (err instanceof AdminActionError || err instanceof ImportError || err instanceof DraftError || err instanceof TransitionError) return NextResponse.json({ error: err.message }, { status: 400 });
  console.error('[acquisition api]', redactSecrets(err instanceof Error ? err.message : String(err)));
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}
