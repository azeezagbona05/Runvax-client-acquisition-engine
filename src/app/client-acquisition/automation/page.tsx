'use client';

import { Suspense } from 'react';
import AutomationBuilder from '@/components/acq/automation/AutomationBuilder';

export default function AutomationPage() {
  return <Suspense fallback={null}><AutomationBuilder /></Suspense>;
}
