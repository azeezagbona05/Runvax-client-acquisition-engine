'use client';

import CampaignDetail from '@/components/acq/CampaignDetail';

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  return <CampaignDetail id={params.id} />;
}
