import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './acq.css';
import AcqProvider from '@/components/acq/AcqProvider';
import AcqShell from '@/components/acq/AcqShell';

export const metadata: Metadata = {
  title: 'Client Acquisition',
  robots: { index: false, follow: false },
};

export default function ClientAcquisitionLayout({ children }: { children: ReactNode }) {
  return (
    <AcqProvider>
      <AcqShell>{children}</AcqShell>
    </AcqProvider>
  );
}
