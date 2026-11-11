'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Info, CheckCircle2, AlertTriangle, X, Wrench } from 'lucide-react';
import { useSiteStatus } from '@/context/SiteStatusContext';
import { bannerVisible, type BannerTone } from '@/lib/siteSettingsShared';

const TONE: Record<BannerTone, { box: string; Icon: typeof Info }> = {
  info: { box: 'bg-purple-600/15 border-purple-500/30 text-purple-100', Icon: Info },
  success: { box: 'bg-emerald-600/15 border-emerald-500/30 text-emerald-100', Icon: CheckCircle2 },
  warning: { box: 'bg-amber-500/15 border-amber-500/35 text-amber-100', Icon: AlertTriangle },
};
const TONE_LIGHT: Record<BannerTone, string> = {
  info: 'bg-purple-50 border-purple-200 text-purple-900',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  warning: 'bg-amber-50 border-amber-300 text-amber-900',
};
const DISMISS_KEY = 'rv_banner_dismissed';
const hash = (t: string) => { let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return String(h); };

/** The admin's announcement banner. Dismissible per message: a new or changed message shows again. */
export function SiteBanner({ light = false }: { light?: boolean }) {
  const s = useSiteStatus();
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => { try { setDismissed(localStorage.getItem(DISMISS_KEY)); } catch { /* ignore */ } }, []);
  if (!bannerVisible(s)) return null;
  const id = hash(s.banner.text + s.banner.linkUrl);
  if (dismissed === id) return null;
  const Icon = TONE[s.banner.tone].Icon;
  const box = light ? `${TONE_LIGHT[s.banner.tone]} rounded-xl border mb-3` : `${TONE[s.banner.tone].box} border-b`;
  const link = s.banner.linkUrl && s.banner.linkLabel ? s.banner : null;
  return (
    <div role="status" data-site-banner className={`flex items-start gap-2.5 px-4 py-2.5 text-[13px] leading-snug ${box}`}>
      <Icon size={15} className="mt-0.5 shrink-0" aria-hidden />
      <p className="flex-1 min-w-0">
        {s.banner.text}
        {link && (/^\//.test(link.linkUrl)
          ? <Link href={link.linkUrl} className="ml-2 font-bold underline underline-offset-2">{link.linkLabel}</Link>
          : <a href={link.linkUrl} target="_blank" rel="noopener noreferrer" className="ml-2 font-bold underline underline-offset-2">{link.linkLabel}</a>)}
      </p>
      <button type="button" aria-label="Dismiss announcement" onClick={() => { setDismissed(id); try { localStorage.setItem(DISMISS_KEY, id); } catch { /* ignore */ } }} className="shrink-0 opacity-70 hover:opacity-100">
        <X size={15} />
      </button>
    </div>
  );
}

const APP_PATHS = ['/client-acquisition', '/command-centre', '/dashboard', '/pipeline', '/settings', '/email-campaigns', '/market-brief'];

/**
 * Maintenance mode: the app areas show a "back soon" page to everyone except a signed-in admin. Marketing pages, sign-in
 * and the admin panel stay reachable (so the admin can switch it off). The API refuses requests too: this is not just cosmetic.
 */
export function MaintenanceScreen() {
  const s = useSiteStatus();
  const pathname = usePathname() ?? '';
  const { data: session } = useSession();
  if (!s.maintenance.on) return null;
  if ((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin) return null;
  if (!APP_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null;
  return (
    <div role="alert" data-maintenance className="fixed inset-0 z-[300] flex items-center justify-center bg-gray-950 px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-600/15 text-purple-300"><Wrench size={26} aria-hidden /></div>
        <h1 className="text-2xl font-black text-white">We&apos;ll be right back</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-400">{s.maintenance.message}</p>
        <Link href="/" className="mt-6 inline-block text-sm font-bold text-purple-300 hover:text-purple-200">Back to the home page</Link>
      </div>
    </div>
  );
}
