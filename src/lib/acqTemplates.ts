/** Starter wording for new campaigns. Placeholders: {{name}} (first name), {{business}}, {{website}}. */
export interface AcqTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  followUpSubject: string;
  followUpBody: string;
}

export const ACQ_TEMPLATES: AcqTemplate[] = [
  {
    id: 'website-pitch',
    name: 'Website for a business without one',
    description: 'For local businesses with little more than a basic online listing or a social media page.',
    subject: 'A website for {{business}}',
    body: `Hi {{name}},

I came across {{business}} online and noticed customers can't find a proper website for you. Most people check Google (and increasingly an AI assistant) before they visit or call, so a business without a site quietly loses those customers to one that has it.

I build simple, fast websites for local businesses: your services, your location, reviews and a way to enquire or book, working while you're busy.

Could I send you a short example of what this could look like for {{business}}?

Thanks,`,
    followUpSubject: 'Re: {{subject}}',
    followUpBody: `Hi {{name}},

Just floating this back to the top of your inbox. Happy to send a quick example for {{business}} if it would help. No obligation either way.

Thanks,`,
  },
  {
    id: 'ai-automation',
    name: 'AI receptionist and follow-up automation',
    description: 'For clinics, salons, agencies and other businesses that live on enquiries.',
    subject: 'Never miss an enquiry at {{business}}',
    body: `Hi {{name}},

Most businesses like {{business}} lose enquiries simply because nobody could reply fast enough: after hours, on weekends, or while the team is busy with customers.

I set up AI assistants that answer common questions, take bookings and follow up with leads on WhatsApp and email, then hand the conversation to you when it matters.

Would a 10-minute walkthrough on how this would work for {{business}} be useful?

Thanks,`,
    followUpSubject: 'Re: {{subject}}',
    followUpBody: `Hi {{name}},

Checking in on my note about answering {{business}}'s enquiries automatically. If it's not a priority right now, no problem. I can send a short example whenever it suits.

Thanks,`,
  },
  {
    id: 'redesign',
    name: 'Redesign an outdated website',
    description: 'For businesses whose site is slow, dated or not mobile friendly.',
    subject: 'Quick idea for {{website}}',
    body: `Hi {{name}},

I had a look at {{website}} on my phone and a few things stood out: it loads slowly and it's harder than it should be for a customer to find your contact details or book. Those are usually the first things that cost a business enquiries.

I redesign websites for local businesses so they load fast, look current on mobile, and turn visitors into calls and bookings.

Would you like me to send three specific suggestions for {{business}}? It's free.

Thanks,`,
    followUpSubject: 'Re: {{subject}}',
    followUpBody: `Hi {{name}},

Following up on the ideas for {{website}}. Happy to send the three suggestions whenever you like.

Thanks,`,
  },
  {
    id: 'restaurant-ordering',
    name: 'Online ordering for restaurants',
    description: 'For restaurants and cafes that take orders by phone or DM.',
    subject: 'Taking orders online at {{business}}',
    body: `Hi {{name}},

Customers increasingly choose where to eat from their phone. If ordering at {{business}} means a phone call or a DM, some of them will simply order somewhere easier.

I build a simple online menu and ordering page for restaurants: orders arrive on WhatsApp or email, and you keep every naira instead of paying marketplace commissions.

Can I show you a quick example with your menu?

Thanks,`,
    followUpSubject: 'Re: {{subject}}',
    followUpBody: `Hi {{name}},

Just checking you saw my note about online ordering for {{business}}. Happy to put together a sample with your menu if you'd like to see it.

Thanks,`,
  },
];
