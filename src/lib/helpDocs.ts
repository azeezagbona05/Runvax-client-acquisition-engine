// Help & support documentation. Plain data so it can be searched in the browser and tested.
// Keep every statement true of the product as built: no promises about features that are not there.

export type DocBlock = { p: string } | { steps: string[] } | { list: string[] } | { tip: string };
export type DocArticle = { id: string; section: string; title: string; summary: string; body: DocBlock[]; keywords?: string };

export const DOC_SECTIONS = ['Getting started', 'Finding prospects', 'Campaigns', 'Replies and pipeline', 'AI agents', 'Account and sending', 'Troubleshooting'] as const;

export const DOCS: DocArticle[] = [
  {
    id: 'what-is-runvax', section: 'Getting started', title: 'What RUNVAX does',
    summary: 'Find your next customers, then use an AI workforce to approach, engage and win them.',
    body: [
      { p: 'RUNVAX helps you find the businesses you want to work with, and gives you an AI team to approach them, keep the conversation going and turn replies into customers.' },
      { list: ['Find Prospects: search an industry and a place and see who is worth contacting.', 'Campaigns: describe your goal in plain English and RUNVAX writes the whole email sequence, follow-ups included.', 'Inbox and Opportunities: the people who replied and are interested are gathered in one place.', 'AI Agents: build a Visibility Agent that writes articles for your site and a Sales Assistant that chats with your visitors.'] },
      { tip: 'You stay in control. You review the emails, and you start every campaign yourself.' },
    ],
  },
  {
    id: 'first-campaign-quickstart', section: 'Getting started', title: 'Your first 10 minutes',
    summary: 'The shortest path from sign-up to a campaign ready to send.',
    body: [
      { steps: ['Open Settings, then Email and SMTP, and connect the mailbox you want to send from.', 'Fill in your profile: your name and business, so emails are signed properly.', 'Open Find Prospects, search an industry and a place, and add the people you want to contact.', 'Open Campaigns, describe who you want to reach and what you offer, and let RUNVAX write the sequence.', 'Read every email, send a test to yourself, then start the campaign.'] },
    ],
    keywords: 'quickstart setup begin onboarding',
  },
  {
    id: 'find-prospects', section: 'Finding prospects', title: 'Finding prospects',
    summary: 'Search by industry and place, review the results and add people to a campaign.',
    body: [
      { steps: ['Open Find Prospects.', 'Choose an industry (or type your own) and a country and city.', 'Review the results. Each one shows the business, its contact details and whether it has a website.', 'Select the ones you want and add them to a campaign, or open one to see more detail.'] },
      { p: 'Opening a prospect and looking up a contact email uses lookups that cost real money, so some of these are limited by your plan and need a verified email address.' },
    ],
    keywords: 'search leads businesses industry city email lookup',
  },
  {
    id: 'import-leads', section: 'Finding prospects', title: 'Adding leads to a campaign',
    summary: 'Pick people from your lead lists or search results and add them to a campaign.',
    body: [
      { p: 'Open a campaign and choose to import leads, or start a new campaign with the leads you have selected. Pick people from your lead lists or your prospect search and add them. People who have unsubscribed are left out.' },
      { tip: 'Only contact people you have a legitimate reason to write to. Every email carries an unsubscribe link and RUNVAX honours it automatically.' },
    ],
    keywords: 'import contacts lead lists add',
  },
  {
    id: 'build-campaign', section: 'Campaigns', title: 'Building a campaign',
    summary: 'Describe your goal and RUNVAX writes the sequence. You review and start it.',
    body: [
      { steps: ['Open Campaigns and choose New campaign.', 'Describe who you want to reach and what you want to happen (for example, book a call).', 'RUNVAX writes an introduction and follow-ups. Edit any subject or body.', 'Set the wait before each follow-up and what triggers it.', 'Send a test to yourself, check how it looks, then start the campaign.'] },
      { p: 'Each email can use the person\'s name and business. You will see a preview of how it reads for a real contact before anything is sent.' },
    ],
    keywords: 'new campaign sequence ai write subject goal',
  },
  {
    id: 'follow-ups', section: 'Campaigns', title: 'How follow-ups work',
    summary: 'Follow-ups wait the days you set and only go to people who meet the condition.',
    body: [
      { p: 'Every follow-up has a wait (in days) and a condition: no reply, not opened, opened, or clicked. People marked as replied are never sent a follow-up.' },
      { p: 'When a follow-up is due, the campaign shows it as due. You send it with one click, so nothing goes out that you have not seen.' },
      { tip: 'People who opened your first email can get different wording from people who did not.' },
    ],
    keywords: 'followup follow up wait condition opened clicked no reply',
  },
  {
    id: 'sending-limits', section: 'Campaigns', title: 'Sending limits',
    summary: 'Why there is a daily limit and how to see what is left.',
    body: [
      { p: 'Each account has a daily sending limit, and each campaign has its own daily cap. This protects your sender reputation, so more of your emails reach the inbox. The sidebar shows how many you have sent today.' },
      { p: 'If a campaign stops at its limit, continue the next day. Raising the limit is not the same as improving results: smaller, well-targeted batches usually do better.' },
    ],
    keywords: 'daily limit cap quota deliverability spam',
  },
  {
    id: 'unsubscribes', section: 'Campaigns', title: 'Unsubscribes and opting out',
    summary: 'Every email has an unsubscribe link, and it is respected straight away.',
    body: [
      { p: 'Each email RUNVAX sends for you includes an unsubscribe link. When someone uses it they are marked as unsubscribed and never emailed again by that campaign.' },
      { p: 'If someone asks you to stop by replying, mark them as unsubscribed in the campaign so they are left out of future sends.' },
    ],
    keywords: 'stop opt out remove gdpr',
  },
  {
    id: 'replies', section: 'Replies and pipeline', title: 'Reading and answering replies',
    summary: 'Replies arrive in your own mailbox. Mark them in RUNVAX so follow-ups stop and the pipeline stays right.',
    body: [
      { p: 'Your campaigns send from your own mailbox, so replies arrive there. Read and answer them as you normally would.' },
      { steps: ['Open the campaign and mark the person as replied. They will never be sent a follow-up.', 'Then choose Interested or Not interested, in the campaign table or in Inbox and Opportunities.', 'People you mark as interested appear in Inbox and Opportunities, ready for your next step.'] },
    ],
    keywords: 'inbox reply interested mark replied opportunities',
  },
  {
    id: 'pipeline', section: 'Replies and pipeline', title: 'Moving people through the pipeline',
    summary: 'Track each person from first contact to a won customer.',
    body: [
      { p: 'Every lead sits at a stage, from first contact through replied and interested to customer. Move people between stages as the conversation develops, and add the value of a deal when you win it so you can see what your outreach is worth.' },
    ],
    keywords: 'stage crm deal won opportunities',
  },
  {
    id: 'agents-overview', section: 'AI agents', title: 'AI agents: what you can build',
    summary: 'A Visibility Agent writes articles for your site. A Sales Assistant talks to visitors.',
    body: [
      { list: ['Visibility Agent: writes articles about your business so more of the right people find you.', 'Sales Assistant: chats with visitors on your website, answers from what you tell it and collects their details as leads.'] },
      { p: 'Describe what you want in plain English and RUNVAX sets the agent up. Before you save anything, use Try it to chat with the agent or read a sample article.' },
      { tip: 'Watch the video "Create an AI agent" on this page for a full walkthrough.' },
    ],
    keywords: 'visibility sales assistant chatbot articles seo',
  },
  {
    id: 'agents-deploy', section: 'AI agents', title: 'Putting an agent on your website, WordPress or Telegram',
    summary: 'Deploy once you are happy with how it answers.',
    body: [
      { steps: ['Open AI Agents and choose your agent.', 'Use Try it until the answers sound right. Add what it should know about your business.', 'Choose where it should run: your website, WordPress or Telegram, and follow the on-screen steps.', 'Switch the agent on.'] },
      { p: 'An agent only runs once you switch it on, and every visitor is told they are talking to an AI.' },
    ],
    keywords: 'embed widget install script wordpress plugin telegram bot',
  },
  {
    id: 'connect-mailbox', section: 'Account and sending', title: 'Connecting your mailbox',
    summary: 'Send from your own address so replies come back to you.',
    body: [
      { steps: ['Open Settings, then Email and SMTP.', 'Enter your mail server details (host, port, username and password) from your email provider.', 'Send yourself a test to confirm it works.'] },
      { p: 'Many providers need an app password instead of your normal password. Your provider\'s help pages explain how to create one.' },
    ],
    keywords: 'smtp imap gmail outlook app password sender',
  },
  {
    id: 'plans-trial', section: 'Account and sending', title: 'Plans, trial and billing',
    summary: 'What your plan includes and where to see it.',
    body: [
      { p: 'Your current plan and usage are shown in the sidebar and in Settings. Limits such as searches per day and AI messages depend on your plan.' },
      { p: 'For anything about a charge, a refund or a plan change, open a ticket in the Billing category so we can look at your account.' },
    ],
    keywords: 'pricing upgrade invoice refund payment pro',
  },
  {
    id: 'security', section: 'Account and sending', title: 'Keeping your account secure',
    summary: 'Passwords, verified email and biometric sign-in.',
    body: [
      { p: 'Verify your email address so we can reach you and unlock features that use paid lookups. In Settings, Security, you can add Face ID or a fingerprint on a device you trust.' },
      { p: 'RUNVAX will never ask for your password by email. If something looks wrong, change your password and open a ticket.' },
    ],
    keywords: 'password verify biometric face id login',
  },
  {
    id: 'trouble-no-code', section: 'Troubleshooting', title: 'I did not get a verification or reset email',
    summary: 'Check spam, wait a minute, then resend.',
    body: [
      { steps: ['Check your spam or promotions folder, and search for RUNVAX.', 'Wait a minute or two, then ask for a new one. Only the newest link works.', 'Make sure the address is spelled correctly.', 'Still nothing? Open a ticket from your account and we will check it.'] },
    ],
    keywords: 'verification email link not arriving reset password',
  },
  {
    id: 'trouble-not-sending', section: 'Troubleshooting', title: 'My campaign is not sending',
    summary: 'The usual causes, in the order to check them.',
    body: [
      { list: ['The campaign has not been started yet. Review it and press Start.', 'Your mailbox is not connected, or the password is wrong. Re-test it in Settings, Email and SMTP.', 'You reached the daily limit. It resets the next day.', 'Some contacts were skipped because they have unsubscribed or their address failed a check.'] },
      { p: 'The Email Activity page shows every send, open, click and reply, newest first.' },
    ],
    keywords: 'stuck failed error smtp limit paused',
  },
  {
    id: 'trouble-agent', section: 'Troubleshooting', title: 'My AI agent is not answering well',
    summary: 'Give it more to work with and test again.',
    body: [
      { list: ['Make sure the agent is switched on.', 'Add more about your business: what you sell, prices, hours and common questions.', 'Use Try it to test a question and adjust until the answer is right.', 'If it says it does not know, that is deliberate. It will not invent facts that you have not given it.'] },
    ],
    keywords: 'chatbot wrong answer knowledge train',
  },
];

const STOP = new Set(['the', 'and', 'for', 'not', 'are', 'was', 'with', 'this', 'that', 'my', 'is', 'in', 'to', 'of', 'it', 'on', 'be', 'do', 'how', 'can', 'i', 'a']);

/**
 * Case-insensitive search over title, summary, keywords and text. Articles that contain every word come first;
 * if none does (people type whole sentences), articles that contain at least half of the words are returned,
 * best match first.
 */
export function searchDocs(query: string, docs: DocArticle[] = DOCS): DocArticle[] {
  const words = Array.from(new Set(query.toLowerCase().split(/[\s,.;:!?]+/).filter((w) => w.length > 1 && !STOP.has(w))));
  if (!words.length) return query.trim() ? [] : docs;
  const text = (d: DocArticle) => [d.title, d.summary, d.section, d.keywords ?? '', ...d.body.map((b) => ('p' in b ? b.p : 'tip' in b ? b.tip : 'steps' in b ? b.steps.join(' ') : b.list.join(' ')))].join(' ').toLowerCase();
  const scored = docs.map((d) => { const t = text(d); return { d, score: words.filter((w) => t.includes(w)).length }; });
  const all = scored.filter((x) => x.score === words.length);
  const pool = all.length ? all : scored.filter((x) => x.score >= Math.max(1, Math.ceil(words.length / 2)));
  return pool.sort((a, b) => b.score - a.score).map((x) => x.d);
}
