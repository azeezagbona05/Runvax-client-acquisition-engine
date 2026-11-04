// Daily budgets reset on the Africa/Lagos calendar day. Timestamps are stored
// in UTC as usual; only the "which day is it" bucket uses Lagos time.

const TZ = 'Africa/Lagos';

function lagosParts(at: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { y: get('year'), m: get('month'), d: get('day'), h: +get('hour'), min: +get('minute'), s: +get('second') };
}

/** YYYY-MM-DD in Africa/Lagos. */
export function lagosDay(at: Date = new Date()): string {
  const p = lagosParts(at);
  return `${p.y}-${p.m}-${p.d}`;
}

/** The next Africa/Lagos midnight, as a UTC instant. */
export function nextLagosMidnight(at: Date = new Date()): Date {
  const p = lagosParts(at);
  const elapsedMs = ((p.h * 60 + p.min) * 60 + p.s) * 1000 + at.getUTCMilliseconds();
  return new Date(at.getTime() - elapsedMs + 24 * 60 * 60 * 1000);
}
