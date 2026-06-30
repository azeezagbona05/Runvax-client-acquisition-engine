import type { Framework } from '../types';

export const followupFrameworks: Framework[] = [
  {
    id: 'value_add_nudge',
    name: 'Value-Add Nudge',
    category: 'followup',
    structure: [
      'Value — lead with something genuinely useful (insight, stat, idea)',
      'Bridge — connect the value back to their situation',
      'Nudge — one soft ask, continuing from the last message',
    ],
    whenToUse: 'First and second follow-ups. Never leads with "just checking in." Earns attention before asking for it.',
    template: 'Open with a fresh insight they didn\'t have before (a local market stat, a competitor move, a 2026 search change). Bridge to their specific situation. Nudge — don\'t push.',
    bestChannels: ['whatsapp', 'email'],
    bestTemperature: ['cold', 'warm'],
  },
  {
    id: 'three_touch',
    name: 'Three-Touch Sequence',
    category: 'followup',
    structure: [
      'Touch 1 — Value-add nudge (new insight)',
      'Touch 2 — Social proof (peer story or result)',
      'Touch 3 — Breakup message (scarcity, final offer)',
    ],
    whenToUse: 'Full follow-up sequence after no reply to initial outreach. Each touch stands alone; together they tell a story.',
    template: 'Touch 1: fresh insight + soft ask. Touch 2: peer story + "wanted to share". Touch 3: breakup framing with one last offer.',
    bestChannels: ['whatsapp', 'email'],
    bestTemperature: ['cold'],
  },
  {
    id: 'breakup',
    name: 'Breakup Message',
    category: 'followup',
    structure: [
      'Respect their time — acknowledge this is the last message',
      'Final value — one last useful thing',
      'Two-option close — both options move things forward',
    ],
    whenToUse: 'Third follow-up or standalone when no reply after multiple touches. Creates scarcity and urgency without being pushy.',
    template: 'Tell them this is the last message. Drop one final useful thing (a quick audit finding, a competitor note). Give two options: "if now isn\'t the right time, I\'ll close this out — or if you\'d like that free [X], just say the word."',
    bestChannels: ['whatsapp', 'email'],
    bestTemperature: ['cold', 'warm'],
  },
  {
    id: 'permission_to_close',
    name: 'Permission-to-Close',
    category: 'followup',
    structure: [
      'Acknowledge the silence without accusation',
      'Give them an easy out',
      'Leave the door open',
    ],
    whenToUse: 'When a previously interested prospect has gone quiet. Removes pressure and often re-opens the conversation.',
    template: '"I haven\'t heard back — totally fine if things have changed. Should I close this off, or would it help to revisit in [timeframe]?" The permission framing paradoxically often prompts a reply.',
    bestChannels: ['whatsapp'],
    bestTemperature: ['warm'],
  },
];
