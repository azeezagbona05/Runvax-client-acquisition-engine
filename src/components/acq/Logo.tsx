/* eslint-disable @next/next/no-img-element */
/** RUNVAX logo: the full horizontal logo, or just the transparent R icon when space is tight. */
export default function Logo({ compact = false }: { compact?: boolean }) {
  return compact ? (
    <img src="/logo-icon.png" alt="RUNVAX" width={34} height={30} style={{ height: 30, width: 'auto', display: 'block' }} />
  ) : (
    <img src="/logo-horizontal.png" alt="RUNVAX Client Acquisition Platform" width={144} height={30} style={{ height: 34, width: 'auto', display: 'block' }} />
  );
}
