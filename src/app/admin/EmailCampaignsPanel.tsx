'use client';

import PlatformCampaigns from './PlatformCampaigns';

/** Admin > Email campaigns: campaigns for RUNVAX's own users (the one builder). Real sends are logged in the audit trail; test emails go to the signed-in admin only. */
export default function EmailCampaignsPanel() {
  return (
    <div className="space-y-5 py-4">
      <p className="text-xs text-gray-500">Email campaigns. Real sends are logged in the audit trail. Test emails go to your admin address only.</p>
      <PlatformCampaigns />
    </div>
  );
}
