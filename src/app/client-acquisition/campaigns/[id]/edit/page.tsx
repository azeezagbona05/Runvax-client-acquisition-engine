'use client';

import CampaignDetail from '@/components/acq/CampaignDetail';

/** Edit a campaign: opens its page with the editing form already open. */
export default function EditCampaignPage({ params }: { params: { id: string } }) {
  return <CampaignDetail id={params.id} openEdit />;
}
