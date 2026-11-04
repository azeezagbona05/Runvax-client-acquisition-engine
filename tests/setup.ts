/**
 * Global test guard rails. Runs before every test file.
 *
 * The repo's .env points DATABASE_URL at the production database, and Prisma
 * reads .env on its own — so nothing here may ever reach a real client,
 * network, mailbox or model provider:
 *   - DATABASE_URL is forced to a local placeholder and asserted to be local;
 *   - @/lib/prisma is replaced by an in-memory fake, and a real PrismaClient
 *     throws if anything constructs one;
 *   - fetch, nodemailer, node:http(s) requests and DNS lookups throw unless a
 *     test stubs them explicitly.
 */
import { vi, beforeEach } from 'vitest';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import { fakePrisma, resetFakePrisma } from './helpers/fakePrisma';

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'mysql://test:test@127.0.0.1:3306/runvax_test_unused';
const host = new URL(process.env.DATABASE_URL).hostname;
if (host !== '127.0.0.1' && host !== 'localhost') {
  throw new Error(`Refusing to run tests against non-local database host "${host}"`);
}

// Test-only suppression HMAC key. Not a secret; production keys live in the
// secret store (docs/suppression-keys.md) and are never committed.
process.env.IA_SUPPRESSION_KEY ??= 'test-only-suppression-key-not-a-secret-0000';
process.env.IA_SUPPRESSION_KEY_ID ??= 'kt';
// Never let a test read real provider keys from the environment.
for (const key of ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'APOLLO_API_KEY', 'RESEND_API_KEY', 'SMTP_PASS']) {
  delete process.env[key];
}

vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    constructor() {
      throw new Error('A real PrismaClient was constructed in a test');
    }
  },
  // Real Prisma uses sentinel objects; the in-memory fake just stores null.
  Prisma: { DbNull: null, JsonNull: null },
}));

vi.mock('@/lib/prisma', () => ({ prisma: fakePrisma }));

vi.mock('nodemailer', () => {
  const createTransport = vi.fn(() => ({
    sendMail: vi.fn(async () => {
      throw new Error('Unstubbed sendMail called in a test');
    }),
  }));
  return { default: { createTransport }, createTransport };
});

beforeEach(() => {
  resetFakePrisma();
  // Live-network tripwires: any real HTTP request or DNS lookup fails the test.
  const refuse = (what: string) => () => { throw new Error(`Live network call in a test: ${what}`); };
  vi.spyOn(http, 'request').mockImplementation(refuse('http.request') as never);
  vi.spyOn(https, 'request').mockImplementation(refuse('https.request') as never);
  vi.spyOn(http, 'get').mockImplementation(refuse('http.get') as never);
  vi.spyOn(https, 'get').mockImplementation(refuse('https.get') as never);
  vi.spyOn(dns.promises, 'lookup').mockImplementation(refuse('dns.lookup') as never);
  vi.spyOn(dns.promises, 'resolveMx').mockImplementation(refuse('dns.resolveMx') as never);
  globalThis.fetch = vi.fn(async (input: unknown) => {
    throw new Error(`Unstubbed fetch in a test: ${String(input)}`);
  }) as unknown as typeof fetch;
});
