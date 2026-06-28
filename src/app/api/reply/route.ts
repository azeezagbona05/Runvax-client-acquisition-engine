import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkAndIncrementAI } from '@/lib/usage';
import { Business, ReplyType } from '@/types';

const REPLY_CONTEXTS: Record<ReplyType, string> = {
  interested: `They said YES or showed clear interest. This is a warm lead. Your job now:
- Express genuine delight (briefly, not excessively)
- Immediately move toward the next concrete step: a call, a quick voice note, or sending the proposal
- Don't over-explain — they're interested, keep momentum going
- Suggest a specific time/action: "Can we do a 5-min call today or tomorrow?"`,

  asked_price: `They asked "how much?" — this is a POSITIVE signal, not resistance. Strategy:
- Never give a single number first — give a range based on their specific needs
- Anchor high briefly, then bring it down to the accessible range
- Link the price immediately to value and ROI, not just cost
- Make the next step easy: "It depends on a few things — can I ask you 2 quick questions?"
- Price range context: Nigerian web design ₦150k–₦500k+ depending on scope`,

  asked_examples: `They want to see examples / portfolio. Strategy:
- Don't just dump links — qualify and personalise
- Ask what type of site they want to see (similar business, or style preference)
- If you have portfolio, describe what you'll send and why it's relevant to THEM
- If limited portfolio, offer to show a quick demo or mock-up concept
- Keep asking forward: "I'll send 2-3 examples — once you've seen them, can we jump on a quick call?"`,

  said_think_about_it: `They said "I'll think about it" — this is a soft stall, not a no. Strategy:
- Acknowledge and respect it — don't push
- Add ONE piece of value they can think about (a specific insight about their niche in 2026)
- Set a gentle follow-up anchor: "Take your time — should I check back in 3 days?"
- Make it easy to come back: leave the door wide open`,

  objection_instagram: `They say "I have Instagram/Facebook, I don't need a website." This is the most common objection. Reframe:
- Validate Instagram — it's great for community and engagement
- The real issue: Instagram is rented land (Meta can ban, reduce reach, change algorithm anytime)
- In 2026, AI tools like ChatGPT and Perplexity recommend businesses from WEBSITES, not Instagram pages
- Google shows websites in search results, not Instagram profiles — they're invisible in search
- A website works 24/7, Instagram posts fade in 24-48 hours
- Frame it as BOTH, not either/or: "Instagram brings the audience, your website converts them"`,

  objection_referrals: `They say "We get customers by referral, we don't need a website." Reframe:
- Validate referrals — that means they're doing great work, people trust them
- The website MULTIPLIES referrals: when someone is referred, first thing they do is Google the business
- Without a website, referred customers can't verify the business, can't see pricing/gallery, may lose confidence
- A website makes referrals stick — it's the "stamp of credibility" that converts word-of-mouth into booked clients
- In 2026, AI tools recommend businesses too — referrals + digital presence = unstoppable`,

  objection_expensive: `They said it's too expensive. Strategy:
- Don't defend the price immediately — ask what they expected
- Reframe as investment vs. expense: "If this website brings you just 2 new clients per month..."
- Calculate ROI: if their average sale is ₦X, a ₦200k website pays for itself in one month
- Offer flexible payment: 50% deposit, balance on delivery
- Compare to alternatives: running ads monthly vs. website one-time
- Mention the 2026 angle: not having a website is also costing them, silently`,

  objection_no_time: `They said "I'm too busy / don't have time." Reframe:
- Acknowledge they're busy — that means business is good
- The hook: busy businesses with no website are leaving money on the table daily
- Your job: make it ZERO effort for them — you handle everything, they just answer a few questions
- Timeline: 7-8 days, 2-3 brief conversations, rest is on you
- The time they spend explaining their business to you pays off in a website that saves them from explaining it to every new customer forever`,

  not_interested: `They said no or not interested. This is NOT game over. Strategy:
- Thank them gracefully, no guilt trip
- Leave the door open with class — "I completely understand"
- Plant a future seed: "If anything changes or you ever want to explore it, I'm here"
- Optional: ask WHY (gently) — the answer teaches you something for future outreach
- A warm goodbye is better than silence — you may be back in 6 months`,

  no_reply: `They haven't replied. This is a follow-up for non-responders. Strategy:
- Don't reference the previous message accusatorially ("I sent you a message...")
- Bring NEW value — a different angle, a fresh insight, not a repeat
- Keep it even shorter than the first message
- Try a different hook: a question, a stat, or a local example
- Day 3: Light check-in with new value. Day 7: Try different angle. Day 14: "Breakup" message`,

  custom: `They sent a custom message. Respond thoughtfully based on what they actually said:
- Address their EXACT concern or question first
- Be genuine, not formulaic
- Match their energy — if casual, be casual; if formal, be professional
- Move toward the next step naturally
- Keep it concise — they're a busy business owner`,
};

export async function POST(req: NextRequest) {
  const {
    business,
    replyType,
    theirMessage,
    ourLastMessage,
    channel = 'whatsapp',
    followupNumber,
  }: {
    business: Business;
    replyType: ReplyType;
    theirMessage?: string;
    ourLastMessage?: string;
    channel?: 'whatsapp' | 'email';
    followupNumber?: number;
  } = await req.json();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set in .env.local' }, { status: 500 });
  }

  const usage = await checkAndIncrementAI();
  if (!usage.ok) return usage.error!;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const replyContext = REPLY_CONTEXTS[replyType] ?? REPLY_CONTEXTS.custom;

  const isFollowUp = replyType === 'no_reply';
  const followupLabel = followupNumber
    ? followupNumber === 1 ? 'Day 3 follow-up (first nudge)'
    : followupNumber === 2 ? 'Day 7 follow-up (new angle)'
    : 'Day 14 final "breakup" message (last chance — often triggers replies)'
    : 'follow-up';

  const systemPrompt = `You are a world-class sales conversation specialist for Nigerian web developers.

You write replies that:
✅ Feel completely human — not templated, not robotic
✅ Acknowledge what the prospect said before responding
✅ Never argue, pressure, or preach
✅ Are SHORT for WhatsApp (under 70 words max), longer for email (under 150 words)
✅ Always end with ONE soft question or clear next step — never two
✅ Keep the 2026 digital angle (GEO/AIEO/SEO) available but only use it if it fits naturally
✅ Sound like a knowledgeable, patient friend — not a salesperson`;

  const userPrompt = `PROSPECT:
- Business: ${business.name}
- Type: ${business.category}
- Location: ${business.address || 'Nigeria'}
- Has website: ${business.hasWebsite ? 'Yes' : 'No'}

${ourLastMessage ? `OUR LAST MESSAGE:\n"${ourLastMessage}"\n` : ''}
${theirMessage ? `THEIR REPLY:\n"${theirMessage}"\n` : `SITUATION: ${isFollowUp ? `No reply yet — this is ${followupLabel}` : 'See reply type below'}\n`}

REPLY SITUATION: ${replyType.replace(/_/g, ' ').toUpperCase()}
STRATEGY:
${replyContext}

CHANNEL: ${channel === 'whatsapp' ? 'WhatsApp (keep it SHORT, warm, conversational — under 70 words)' : 'Email (can be slightly longer, professional but warm — under 150 words)'}

Write the reply. Output ONLY the message text — no labels, no "Here's the reply:", just the message itself.`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const message = completion.choices[0]?.message?.content?.trim() ?? '';
    return NextResponse.json({ message, replyType, channel });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
