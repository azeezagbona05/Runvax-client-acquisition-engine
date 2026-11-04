import { redirect } from 'next/navigation';

// Email campaigns now live inside Client Acquisition.
export default function EmailCampaignsRedirect() {
  redirect('/client-acquisition/campaigns');
}
