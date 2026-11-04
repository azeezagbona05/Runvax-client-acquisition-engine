import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Claim your free Pro access',
  robots: { index: false, follow: false },
};

export default async function ClaimProLayout({ children }: { children: React.ReactNode }) {
  // The launch emails link here. Signed-out visitors sign in first and come straight back.
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/signin?next=%2Fclaim-pro');
  return <>{children}</>;
}
