import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminSession } from '@/lib/adminSessionShared';
import { getSiteSettings, saveSiteSettings, clearSiteSettingsCache } from '@/lib/siteSettings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  clearSiteSettingsCache();
  return NextResponse.json({ settings: await getSiteSettings() });
}

/** PUT the full settings object (or any part of it). Validated and clamped; every change is written to the admin audit log. */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Send the settings as JSON.' }, { status: 400 });
  try {
    const { settings, changes } = await saveSiteSettings(body, session.user.email);
    return NextResponse.json({ settings, changes });
  } catch (e) {
    console.error('[site-settings] save failed', e);
    return NextResponse.json({ error: 'Could not save. If this is the first time, the site-settings migration may not be applied yet.' }, { status: 500 });
  }
}
