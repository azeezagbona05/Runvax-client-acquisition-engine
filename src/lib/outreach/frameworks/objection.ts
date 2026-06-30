import type { Framework } from '../types';

export const objectionFrameworks: Framework[] = [
  {
    id: 'laer',
    name: 'LAER (Listen-Acknowledge-Explore-Respond)',
    category: 'objection',
    structure: [
      'Listen — name the objection back to them accurately',
      'Acknowledge — validate the feeling or concern without agreeing',
      'Explore — ask a question that opens up the objection',
      'Respond — answer with specificity, not a generic rebuttal',
    ],
    whenToUse: 'Any objection reply. Primary framework for reply_objection intent.',
    template: 'Name the objection back clearly. Validate it ("that\'s a fair concern"). Ask one question that unpacks it. Then respond with specifics — not a script, but their situation.',
    bestChannels: ['whatsapp', 'email'],
    bestTemperature: ['warm'],
  },
  {
    id: 'feel_felt_found',
    name: 'Feel-Felt-Found',
    category: 'objection',
    structure: [
      'Feel — "I understand how you feel..."',
      'Felt — "Others in [their situation] felt the same way..."',
      'Found — "What they found was..."',
    ],
    whenToUse: 'Secondary blend for objection replies. Humanises the response and uses social proof.',
    template: 'Validate their feeling. Name a peer who felt the same. Share what that peer discovered after making the change.',
    bestChannels: ['whatsapp', 'email'],
    bestTemperature: ['warm'],
  },
  {
    id: 'laarc',
    name: 'LAARC (Listen-Acknowledge-Assess-Respond-Confirm)',
    category: 'objection',
    structure: [
      'Listen',
      'Acknowledge',
      'Assess — diagnose whether it is a real objection or a deflection',
      'Respond',
      'Confirm — check they are satisfied with the response',
    ],
    whenToUse: 'Longer email objection replies where thoroughness matters.',
    template: 'Same as LAER but add an explicit check at the end: "Does that address your concern, or is there something else?"',
    bestChannels: ['email'],
    bestTemperature: ['warm'],
  },
  {
    id: 'arc',
    name: 'ARC (Acknowledge-Reframe-Continue)',
    category: 'objection',
    structure: [
      'Acknowledge — the objection is real',
      'Reframe — shift the frame without dismissing',
      'Continue — move the conversation forward',
    ],
    whenToUse: 'Short WhatsApp objection replies where speed matters. Tightest objection format.',
    template: 'Acknowledge briefly. Reframe the objection (see OBJECTION_REFRAMES below). Move to the next step.',
    bestChannels: ['whatsapp'],
    bestTemperature: ['warm'],
  },
];

// Pulled from objection handling best-practices for each category
export const OBJECTION_REFRAMES: Record<
  'has_social' | 'too_expensive' | 'referrals' | 'no_time' | 'other',
  string
> = {
  has_social:
    'Instagram and Facebook are great for community — but Google and AI assistants (like ChatGPT and Google AI) pull from websites, not social pages. When someone searches "best [niche] in [city]" or asks an AI, your Instagram doesn\'t show up — a website does. Both can work together: the social page builds community, the website captures the searchers.',

  too_expensive:
    'I hear you — and it\'s a fair concern. The way to think about it: a website is a one-time build that generates enquiries 24/7 for years. In [country], a professionally built salon site typically costs [price band]. Compare that to one missed client a week for a year — the maths usually favours the site. And I\'d never build something that doesn\'t pay for itself.',

  referrals:
    'Referrals are the best kind of client — they already trust you. But here\'s what happens: a referral hears about you, searches your name on Google, finds no website — and sometimes loses confidence, or the competitor with a site captures them instead. A website makes your referrals stickier and helps them trust what they\'ve been told.',

  no_time:
    'That\'s exactly why this makes sense — you wouldn\'t manage the site. We build it, optimise it, and hand it over. It runs 24/7 without you touching it. The only time it takes is the one-off week we\'d need to gather your photos and content — everything else is on us.',

  other:
    'That\'s a fair point. Tell me more — I want to make sure I\'m solving the right problem for you, not just assuming I know what\'s holding you back.',
};
