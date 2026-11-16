import { PrismaClient } from '@prisma/client';
import { tunedDatabaseUrl, withRetry } from './prismaTuning';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function makeClient() {
  const url = tunedDatabaseUrl(process.env.DATABASE_URL);
  const base = url && url !== process.env.DATABASE_URL ? new PrismaClient({ datasourceUrl: url }) : new PrismaClient();
  // "Couldn't connect" errors mean the query never ran, so it is safe to try again; see prismaTuning.ts.
  // Same API as a plain client (the app never uses $on/$use), so it is exposed as PrismaClient for everything that expects one.
  return base.$extends({ query: { $allOperations: ({ operation, args, query }) => withRetry(() => query(args), operation) } }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
