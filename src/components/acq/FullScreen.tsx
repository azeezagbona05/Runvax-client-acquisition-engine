'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

/**
 * Wraps a big panel with a "Full screen" button. Opening it lets the panel fill the whole window; Esc or the button closes it.
 * The content is never remounted, so whatever is selected or typed inside stays exactly as it was.
 */
export default function FullScreen({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const was = useRef(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closer.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', key);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', key); };
  }, [open]);
  // Hand focus back to the button that opened it.
  useEffect(() => { if (was.current && !open) opener.current?.focus(); was.current = open; }, [open]);

  return (
    <div className={`acq-fs${open ? ' open' : ''}`} {...(open ? { role: 'dialog', 'aria-modal': true, 'aria-label': title } : {})}>
      <div className="acq-fs-bar">
        {open
          ? <><b className="acq-fs-title">{title}</b><button ref={closer} type="button" className="acq-btn acq-btn-sm" onClick={() => setOpen(false)}><Minimize2 size={14} /> Exit full screen</button></>
          : <button ref={opener} type="button" className="acq-btn acq-btn-sm" aria-label={`Full screen: ${title}`} onClick={() => setOpen(true)}><Maximize2 size={14} /> Full screen</button>}
      </div>
      <div className="acq-fs-body"><div className="acq-fs-inner">{children}</div></div>
    </div>
  );
}
