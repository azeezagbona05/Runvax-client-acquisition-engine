/**
 * Integration guard rails: a real PrismaClient, but ONLY against a disposable
 * local MySQL on 127.0.0.1:3399, and the same live-network tripwires as the
 * unit suite. Refuses to start otherwise.
 */
import { vi, beforeEach } from 'vitest';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';

const url = process.env.TEST_DATABASE_URL ?? '';
if (!/^mysql:\/\/root@127\.0\.0\.1:3399\/[a-z_]+$/.test(url)) {
  throw new Error('Integration tests need TEST_DATABASE_URL=mysql://root@127.0.0.1:3399/<db> (a disposable local MySQL)');
}
process.env.DATABASE_URL = url;
// Test-only suppression HMAC key. Not a secret; production keys live in the
// secret store (docs/suppression-keys.md) and are never committed.
process.env.IA_SUPPRESSION_KEY ??= 'test-only-suppression-key-not-a-secret-0000';
process.env.IA_SUPPRESSION_KEY_ID ??= 'kt';
for (const key of ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'APOLLO_API_KEY', 'RESEND_API_KEY', 'SMTP_PASS']) delete process.env[key];

// The guard above deletes the AI keys, but Prisma re-reads .env when it loads and puts them back. So AI is switched off here by name:
// no integration test can reach a real model provider, whatever the environment holds.
vi.mock('@/lib/ai', async (orig) => ({ ...(await orig<typeof import('@/lib/ai')>()), hasProvider: () => false }));

vi.mock('nodemailer', () => {
  const createTransport = vi.fn(() => { throw new Error('nodemailer used in an integration test'); });
  return { default: { createTransport }, createTransport };
});

beforeEach(() => {
  const refuse = (what: string) => () => { throw new Error(`Live network call in a test: ${what}`); };
  vi.spyOn(https, 'request').mockImplementation(refuse('https.request') as never);
  vi.spyOn(http, 'get').mockImplementation(refuse('http.get') as never);
  vi.spyOn(https, 'get').mockImplementation(refuse('https.get') as never);
  vi.spyOn(dns.promises, 'resolveMx').mockImplementation(refuse('dns.resolveMx') as never);
  // http.request / dns.lookup stay real: the MySQL driver uses its own sockets,
  // but nothing in the acquisition code may call them (fixture transport only).
  globalThis.fetch = vi.fn(async (input: unknown) => { throw new Error(`fetch in an integration test: ${String(input)}`); }) as unknown as typeof fetch;
});
