import { TOOLS } from './tools';

/** A small, stateless MCP server (JSON-RPC 2.0 over Streamable HTTP). Only what is needed: initialize, ping, tools/list, tools/call. */
export const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
export const SERVER_INFO = { name: 'runvax', title: 'RUNVAX', version: '1.0.0' };
const INSTRUCTIONS = 'RUNVAX is a B2B client-acquisition platform. These tools read the connected account\'s campaigns, prospect replies, AI agents, assistant leads and articles. They never send anything or change anything.';

type Id = string | number | null;
interface Rpc { jsonrpc?: string; id?: Id; method?: string; params?: Record<string, unknown> }
const ok = (id: Id, result: unknown) => ({ jsonrpc: '2.0' as const, id, result });
const err = (id: Id, code: number, message: string) => ({ jsonrpc: '2.0' as const, id, error: { code, message } });

/** One JSON-RPC message in, one response out (null for a notification, which gets no reply). */
export async function handleRpc(msg: Rpc, userId: string): Promise<ReturnType<typeof ok> | ReturnType<typeof err> | null> {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(msg?.id ?? null, -32600, 'Invalid request');
  const isNote = msg.id === undefined; const id = msg.id ?? null;
  switch (msg.method) {
    case 'initialize': {
      const asked = String(msg.params?.protocolVersion ?? '');
      return ok(id, { protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0], capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS });
    }
    case 'ping': return isNote ? null : ok(id, {});
    case 'tools/list': return ok(id, { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } })) });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === msg.params?.name);
      if (!tool) return err(id, -32602, `Unknown tool: ${String(msg.params?.name ?? '')}`.slice(0, 120));
      try {
        const data = await tool.run((msg.params?.arguments ?? {}) as Record<string, unknown>, userId);
        return ok(id, { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], isError: !!(data as { error?: unknown })?.error });
      } catch { return ok(id, { content: [{ type: 'text', text: 'RUNVAX could not complete that request. Try again in a moment.' }], isError: true }); }
    }
    default:
      return isNote ? null : err(id, -32601, 'Method not found');
  }
}
