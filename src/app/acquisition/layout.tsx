import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { acquisitionPageAllowed } from '@/lib/acquisition/flag';

export const metadata: Metadata = {
  title: 'Industry Acquisition',
  robots: { index: false, follow: false },
};

// Evaluate the gate on every request — never prerender a build-time answer.
export const dynamic = 'force-dynamic';

// Server-side gate, independent of middleware: flag off, not an admin, or a
// suspended account (even with a still-valid session) → 404.
export default async function AcquisitionLayout({ children }: { children: React.ReactNode }) {
  if (!(await acquisitionPageAllowed())) notFound();
  return <div className="acq-scope">{children}</div>;
}
