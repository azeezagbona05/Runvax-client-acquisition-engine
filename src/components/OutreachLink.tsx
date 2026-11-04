'use client';

import { useRef, type ReactNode } from 'react';
import { useProspects } from '@/context/ProspectsContext';
import { ACQUISITION_NOTICE, followOutreach, isAcquisitionManaged, openOutreach, reportBlocked, type OutreachTarget } from '@/lib/outreachGate';

/** True when the saved prospect for this business is an Industry Acquisition clinic (server-provided state; render-only). */
export function useAcquisitionManaged(businessId?: string): boolean {
  const { get } = useProspects();
  return !!businessId && isAcquisitionManaged(get(businessId));
}

/**
 * A wa.me / mailto: action that cannot bypass the acquisition workflow.
 *  - managed: a disabled control with the explanation, no link at all.
 *  - otherwise: asks the server before opening. There is deliberately no real
 *    href to the external URL, so middle-click and "open in new tab" can't skip the check.
 */
export default function OutreachLink({ url, target, managed, sameTab, className = '', title, onOpened, children }: {
  url: string | null;
  target: OutreachTarget;
  managed?: boolean;
  /** tel: links: navigate the current page after the check instead of opening a tab. */
  sameTab?: boolean;
  className?: string;
  title?: string;
  onOpened?: () => void;
  children: ReactNode;
}) {
  const busy = useRef(false); // ignore repeated clicks while a check is in flight (no duplicate tabs or sends)
  if (managed) {
    return (
      <span aria-disabled="true" title={ACQUISITION_NOTICE} data-outreach="blocked" className={`${className} opacity-50 cursor-not-allowed`}>
        {children}<span className="sr-only"> ({ACQUISITION_NOTICE})</span>
      </span>
    );
  }
  if (!url) return <span className={className}>{children}</span>;
  return (
    <a
      href="#"
      role="button"
      data-outreach="guarded"
      title={title}
      className={className}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy.current) return;
        busy.current = true;
        try {
        const r = sameTab ? await followOutreach(url, target) : await openOutreach(url, target);
        if (r.ok) onOpened?.(); else reportBlocked([r]);
        } finally { busy.current = false; }
      }}
    >
      {children}
    </a>
  );
}
