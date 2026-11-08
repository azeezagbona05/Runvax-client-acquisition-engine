'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A number that glides to its new value instead of jumping. `initial` makes it count up from there (for example 0) when it first appears.
 * Shows the final value straight away for people who prefer reduced motion. Safe when React runs effects twice in development.
 */
export default function CountUp({ value, ms = 700, initial }: { value: number; ms?: number; initial?: number }) {
  const [shown, setShown] = useState(initial ?? value);
  const cur = useRef(initial ?? value); // the number on screen right now, so an interrupted glide continues from where it was
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || cur.current === value) { cur.current = value; setShown(value); return; }
    const start = performance.now(), a = cur.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const v = Math.round(a + (value - a) * (1 - Math.pow(1 - k, 3)));
      cur.current = v; setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <>{shown.toLocaleString('en-US')}</>;
}
