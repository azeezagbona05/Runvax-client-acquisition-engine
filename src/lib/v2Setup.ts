import { NextResponse } from 'next/server';

/** True when Prisma says a table or column is missing, i.e. the V2 migration has not been applied yet. */
export function isNotInstalled(err: unknown): boolean {
  return ['P2021', 'P2022'].includes((err as { code?: string })?.code ?? '');
}

export function notInstalledResponse(): NextResponse {
  return NextResponse.json({
    error: 'Client Acquisition needs one database update (migrations 5 to 9). Ask an administrator to apply it.',
    code: 'V2_NOT_INSTALLED',
  }, { status: 503 });
}

/** Runs a route body and turns "tables missing" into the friendly 503; everything else is rethrown. */
export async function guardInstalled(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try { return await fn(); } catch (e) { if (isNotInstalled(e)) return notInstalledResponse(); throw e; }
}
