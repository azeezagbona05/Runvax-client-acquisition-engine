import { NextRequest, NextResponse } from 'next/server';
import { handleRpc } from '@/lib/mcp/server';
import { verifyMcpToken } from '@/lib/mcp/token';
import { rateLimit } from '@/lib/rateLimiter';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const NO: Record<string, string> = { 'WWW-Authenticate': 'Bearer realm="RUNVAX"' };

/** The RUNVAX MCP endpoint (Streamable HTTP, stateless). Authenticated with a personal token made in Integrations. Read-only. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  if (!rateLimit(`mcp-ip:${ip}`, { maxRequests: 300, windowMs: 60_000 }).ok) return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Too many requests' } }, { status: 429 });
  const userId = await verifyMcpToken(req.headers.get('authorization'));
  if (!userId) return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized: use a RUNVAX Claude token from Integrations.' } }, { status: 401, headers: NO });
  if (!rateLimit(`mcp-user:${userId}`, { maxRequests: 120, windowMs: 60_000 }).ok) return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Too many requests' } }, { status: 429 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 }); }
  const batch = Array.isArray(body); const msgs: unknown[] = (batch ? (body as unknown[]) : [body]).slice(0, 20);
  const out = (await Promise.all(msgs.map((m) => handleRpc(m as never, userId)))).filter((r) => r !== null);
  if (out.length === 0) return new NextResponse(null, { status: 202 });
  return NextResponse.json(batch ? out : out[0]);
}
// This server keeps no sessions and sends no server-initiated messages.
export const GET = () => new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
export const DELETE = () => new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
