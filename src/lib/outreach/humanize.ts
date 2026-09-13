// Anti-AI-tell rules for generated outreach copy.
//
// Patterns adapted from blader/humanizer (MIT), which distils Wikipedia's
// "Signs of AI writing" into 35 rules. Only the subset that applies to short
// sales messages is ported here — the rest of that list targets encyclopedic
// prose (vague sources, title-case headings, synonym cycling) and would fire
// constantly on an 80-word WhatsApp message without improving it.
//
// ONE list drives two consumers, so the prompt and the detector can never drift:
//   - promptBans()  → negative constraints in the composer system prompt (prevention)
//   - findAiTells() → advisory notes in the quality gate (measurement)
//
// Deliberately advisory: these notes never fail the gate. Failing the gate is
// what triggers the rewrite retry in generate.ts, and a lexical nitpick is not
// worth a second LLM call. The prompt is where these get fixed; the gate only
// tells you how often the prompt didn't work.

export interface AiTellRule {
  id: string;
  /** Shown in the composer prompt as a "never write this" line. */
  instruction: string;
  /** Omitted for rules that steer well but can't be detected without false positives. */
  pattern?: RegExp;
  /** Checked against the opening sentence only, where the construction is a tell. */
  openerOnly?: boolean;
}

/** Build an alternation regex from a word list, respecting word boundaries. */
function words(list: string[]): RegExp {
  return new RegExp(`\\b(${list.join('|')})\\b`, 'i');
}

export const AI_TELL_RULES: AiTellRule[] = [
  {
    id: 'not-just-x',
    instruction:
      '"It\'s not just a website, it\'s your storefront" and every "not just X, it\'s Y" construction. Say the one thing you mean.',
    // Two shapes: the explicit "it's not just…", and "not just X, but/it's Y".
    pattern: /\b(?:it'?s|this is|that'?s)\s+not\s+(?:just|only|merely)\b|\bnot\s+(?:just|only|merely)\b[^.!?]{0,60}?\b(?:but|it'?s|they'?re)\b/i,
  },
  {
    id: 'sales-adjectives',
    instruction:
      'Brochure adjectives: vibrant, renowned, stunning, nestled, bustling, thriving, iconic, breathtaking, world-class, unparalleled. Describe what is actually there instead.',
    pattern: words([
      'vibrant', 'renowned', 'stunning', 'nestled', 'bustling', 'thriving',
      'iconic', 'breathtaking', 'world-class', 'unparalleled',
    ]),
  },
  {
    id: 'ai-vocabulary',
    instruction:
      'Words that mark text as machine-written: delve, showcase, testament, underscore, tapestry, pivotal, myriad, seamless, cutting-edge, elevate.',
    pattern: words([
      'delve', 'delves', 'delving', 'showcase', 'showcases', 'showcasing',
      'testament', 'underscore', 'underscores', 'tapestry', 'pivotal',
      'myriad', 'seamless', 'seamlessly', 'cutting-edge', 'elevate', 'elevates',
    ]),
  },
  {
    id: 'filler-phrases',
    instruction:
      'Padding that costs you words against the limit: "in order to" (write "to"), "due to the fact that" ("because"), "has the ability to" ("can"), "at this point in time" ("now"), "for the purpose of" ("to").',
    pattern: /\b(in order to|due to the fact that|has the ability to|at this point in time|for the purpose of|in the event that|a large number of)\b/i,
  },
  {
    id: 'fake-candid-opener',
    instruction:
      'Opening on a staged confidence: "Honestly?", "Look,", "Here\'s the thing", "Truth be told". Open on the observation itself.',
    pattern: /^\W*(honestly|look|here'?s the thing|let'?s be honest|truth be told|real talk)\b/i,
    // Mid-message these read fine in conversation; as an opener they are a tell.
    openerOnly: true,
  },
  {
    id: 'pleasantry-opener',
    instruction:
      'Opening on a hollow pleasantry: "Hope you\'re doing well", "Hope all is well", "How are you today". Open on the reason you are writing.',
    // The long form ("I hope this message finds you well") is already covered by
    // HARD_BANS; the model still reaches for the contracted variants.
    // "I trust you are well" is deliberately absent — it reads as normal
    // correspondence in Nigerian business English rather than as filler.
    pattern: /\b(hope (you'?re|you are|all is|things are|business is)\s+(doing\s+)?(well|good|great)|how are you (doing )?today)\b/i,
  },
  {
    id: 'false-depth',
    instruction:
      'Pretending to reveal a deeper truth: "at its core", "the real question is", "what really matters", "at the end of the day".',
    pattern: /\b(at its core|the real question is|what really matters|at the end of the day)\b/i,
  },
  {
    id: 'generic-closer',
    instruction:
      'Closing on inspirational vapour: "the future looks bright", "exciting times ahead", "the possibilities are endless". End on the ask.',
    pattern: /\b(the future looks bright|exciting times ahead|possibilities are endless|sky'?s the limit)\b/i,
  },
  {
    id: 'chatbot-residue',
    instruction:
      'Assistant leftovers: "I hope this helps", "Should I continue?", "Would you like me to". You are writing a message, not answering a prompt.',
    // "Let me know if…" is deliberately absent — it is a legitimate CTA here.
    pattern: /\b(i hope (this|that) helps|should i continue|would you like me to)\b/i,
  },
  {
    id: 'stacked-hedging',
    instruction:
      'Stacked hedges: "could potentially", "might possibly", "may perhaps". One qualifier at most.',
    pattern: /\b(could potentially|might possibly|may perhaps|possibly might|potentially could)\b/i,
  },
  {
    id: 'announcing-the-point',
    instruction:
      'Announcing instead of saying: "Let\'s dive in", "Here\'s what you need to know", "without further ado".',
    pattern: /\b(let'?s dive in|here'?s what you need to know|without further ado|let'?s get into it)\b/i,
  },
  {
    id: 'unraised-objection',
    instruction:
      'Answering an objection nobody made: "Don\'t get me wrong", "I\'m not saying", "This isn\'t mainly about".',
    pattern: /\b(don'?t get me wrong|i'?m not saying|this isn'?t mainly about)\b/i,
  },
  {
    id: 'formulaic-comparison',
    instruction:
      'Formula comparisons like "X is the Uber of Y" or "your website is your digital handshake". Make the specific claim instead.',
    // No detector: the shape is too close to legitimate analogy to match safely.
  },
];

/** The negative-constraint block injected into the composer system prompt. */
export function promptBans(): string {
  return `AI-TELL BANS — these mark a message as machine-written. Never write them:
${AI_TELL_RULES.map((r) => `• ${r.instruction}`).join('\n')}`;
}

/** First sentence of a message, used for the opener-only rules. */
function firstSentence(text: string): string {
  return text.trim().split(/(?<=[.!?])\s+|\n/)[0] ?? '';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Blank out proper nouns before matching. Local business names routinely
 * contain the exact words these rules ban — "Elevate Fitness", "Iconic Events",
 * "Vibrant Beauty Lounge" — and every message contains the prospect's name, so
 * without this the detector fires on its own greeting.
 */
function scrubNames(text: string, names: string[]): string {
  return names
    .filter((n) => n && n.trim().length > 1)
    .reduce(
      (acc, name) => acc.replace(new RegExp(escapeRegExp(name.trim()), 'gi'), ' '),
      text,
    );
}

/**
 * Report AI tells found in a message. Advisory only — callers record these as
 * notes and must not fail the quality gate on them (see the module header).
 *
 * `names` are proper nouns to exempt: the prospect's business name and the
 * sender's agency name.
 */
export function findAiTells(text: string, label: string, names: string[] = []): string[] {
  const scrubbed = scrubNames(text, names);
  const opener = firstSentence(scrubbed);
  const notes: string[] = [];

  AI_TELL_RULES.forEach((rule) => {
    if (!rule.pattern) return;
    const target = rule.openerOnly ? opener : scrubbed;
    const hit = target.match(rule.pattern);
    if (hit) notes.push(`${label}: AI-tell [${rule.id}] — "${hit[0]}"`);
  });

  return notes;
}
