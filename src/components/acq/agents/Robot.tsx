/** The friendly robot in the AI Agents banner. Drawn in SVG so it stays sharp at any size. */
export default function Robot({ size = 190 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" aria-hidden>
      <defs>
        <radialGradient id="rbHead" cx="40%" cy="30%" r="80%"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dfe6ff" /></radialGradient>
        <linearGradient id="rbFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#241a6e" /><stop offset="1" stopColor="#120c47" /></linearGradient>
        <linearGradient id="rbEar" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b497ff" /><stop offset="1" stopColor="#6a3fe0" /></linearGradient>
        <linearGradient id="rbBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#cdd7ff" /></linearGradient>
      </defs>
      {/* body */}
      <path d="M44 200c0-34 24-52 56-52s56 18 56 52H44Z" fill="url(#rbBody)" />
      <circle cx="100" cy="178" r="15" fill="#5b3fe0" /><text x="100" y="184" textAnchor="middle" fontSize="17" fontWeight="800" fill="#fff" fontFamily="Inter, Arial, sans-serif">R</text>
      <rect x="86" y="140" width="28" height="14" rx="6" fill="#aab7f5" />
      {/* ears */}
      <circle cx="30" cy="86" r="20" fill="url(#rbEar)" /><circle cx="30" cy="86" r="10" fill="#e6dcff" opacity=".9" />
      <circle cx="170" cy="86" r="20" fill="url(#rbEar)" /><circle cx="170" cy="86" r="10" fill="#e6dcff" opacity=".9" />
      <path d="M44 64c8-30 32-42 56-42s48 12 56 42" stroke="#8b6cf0" strokeWidth="7" strokeLinecap="round" fill="none" />
      {/* head */}
      <rect x="40" y="44" width="120" height="104" rx="52" fill="url(#rbHead)" />
      <rect x="52" y="60" width="96" height="72" rx="34" fill="url(#rbFace)" />
      {/* eyes and smile */}
      <path d="M72 96c0-9 6-15 13-15s13 6 13 15" stroke="#5be0ff" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M102 96c0-9 6-15 13-15s13 6 13 15" stroke="#5be0ff" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M86 112c8 9 20 9 28 0" stroke="#5be0ff" strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <ellipse cx="72" cy="75" rx="10" ry="5" fill="#fff" opacity=".18" transform="rotate(-25 72 75)" />
    </svg>
  );
}
