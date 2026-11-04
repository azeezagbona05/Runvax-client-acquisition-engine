/** RUNVAX mark and wordmark in the Client Acquisition blue. */
export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
        <defs>
          <linearGradient id="acqLogoG" x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#a855f7" />
            <stop offset="1" stopColor="#6b21a8" />
          </linearGradient>
        </defs>
        <path d="M4 5.5h13.2c4.7 0 7.6 2.5 7.6 6.3 0 2.9-1.7 4.9-4.4 5.8l5.4 9.9h-5.3l-4.7-9.1h-4.6V27H4V5.5Zm4.2 3.9v5.5h8.6c2.2 0 3.6-1 3.6-2.8 0-1.8-1.4-2.7-3.6-2.7H8.2Z" fill="url(#acqLogoG)" />
        <path d="M17.5 27 28 5.5h-4.6L15 22.6 17.5 27Z" fill="#a855f7" opacity=".85" />
      </svg>
      {!compact && <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: '#7e22ce' }}>RUNVAX</span>}
    </span>
  );
}
