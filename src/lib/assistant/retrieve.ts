// Keyword retrieval over the knowledge base.
//
// Deliberately not embeddings: the KB is ~30 articles that change only when a
// human edits them, so a TF-IDF-ish scorer runs in microseconds with no vector
// store, no embedding API call, and no index to keep in sync. Swap this out for
// embeddings only if the KB grows past a few hundred articles.

import { KNOWLEDGE_BASE, KbArticle } from './knowledge';

export interface ScoredArticle {
  article: KbArticle;
  score: number;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'so', 'to', 'of', 'in', 'on', 'for',
  'with', 'at', 'by', 'from', 'as', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'have', 'has', 'had', 'i', 'me', 'my', 'you', 'your', 'it', 'its',
  'this', 'that', 'these', 'those', 'can', 'could', 'will', 'would', 'should', 'shall',
  'may', 'might', 'must', 'not', 'no', 'yes', 'how', 'what', 'when', 'where', 'why', 'who',
  'which', 'there', 'here', 'get', 'got', 'want', 'need', 'please', 'help', 'about',
]);

/** Cheap suffix stripper — matches "searching"/"searches" to "search". */
function stem(word: string): string {
  if (word.length <= 4) return word;
  for (const suffix of ['ing', 'ies', 'ers', 'ed', 'es', 's']) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      const base = word.slice(0, word.length - suffix.length);
      return suffix === 'ies' ? `${base}y` : base;
    }
  }
  return word;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map(stem);
}

function termFrequencies(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  tokens.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
  return tf;
}

interface IndexedArticle {
  article: KbArticle;
  title: Map<string, number>;
  tags: Map<string, number>;
  body: Map<string, number>;
  /** Tag phrases kept whole, so "market brief" can match as a unit. */
  phrases: string[];
}

// Built once per process — the KB is static at runtime.
const INDEX: IndexedArticle[] = KNOWLEDGE_BASE.map((article) => ({
  article,
  title: termFrequencies(tokenize(article.title)),
  tags: termFrequencies(tokenize(article.tags.join(' '))),
  body: termFrequencies(tokenize(article.body)),
  phrases: article.tags.filter((t) => t.includes(' ')).map((t) => t.toLowerCase()),
}));

// Inverse document frequency: a term in every article ("website") says nothing;
// a term in one ("paystack") is decisive.
const IDF: Map<string, number> = (() => {
  const docCount = new Map<string, number>();
  INDEX.forEach((entry) => {
    const seen = new Set<string>();
    [entry.title, entry.tags, entry.body].forEach((m) => m.forEach((_v, term) => seen.add(term)));
    seen.forEach((term) => docCount.set(term, (docCount.get(term) ?? 0) + 1));
  });
  const idf = new Map<string, number>();
  const n = INDEX.length;
  docCount.forEach((count, term) => idf.set(term, Math.log(1 + n / count)));
  return idf;
})();

const TITLE_WEIGHT = 4;
const TAG_WEIGHT = 3;
const BODY_WEIGHT = 1;
const PHRASE_BONUS = 6;

/**
 * Rank knowledge-base articles against a natural-language question.
 * `limit` caps how many come back; articles scoring zero are dropped.
 */
export function retrieve(query: string, limit = 4): ScoredArticle[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const queryTerms = new Set(tokens);
  const lowerQuery = query.toLowerCase();

  const scored = INDEX.map((entry) => {
    let score = 0;

    queryTerms.forEach((term) => {
      const idf = IDF.get(term);
      if (!idf) return;   // term appears nowhere in the KB

      // Saturating counts: five body mentions shouldn't outrank a title hit.
      const titleHits = entry.title.get(term) ?? 0;
      const tagHits = entry.tags.get(term) ?? 0;
      const bodyHits = entry.body.get(term) ?? 0;

      if (titleHits) score += TITLE_WEIGHT * idf;
      if (tagHits) score += TAG_WEIGHT * idf;
      if (bodyHits) score += BODY_WEIGHT * idf * (1 + Math.log(bodyHits));
    });

    // Whole multi-word tags present verbatim in the question are a strong signal
    // ("market brief", "app password", "rate card").
    entry.phrases.forEach((phrase) => {
      if (lowerQuery.includes(phrase)) score += PHRASE_BONUS;
    });

    // Normalise by article length so long articles don't win on volume alone.
    const lengthPenalty = Math.sqrt(entry.body.size) / 10;
    return { article: entry.article, score: score / Math.max(1, lengthPenalty) };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Retrieval for a conversation: weights the newest question heaviest but keeps
 * earlier turns in play, so "how do I fix it?" still resolves against whatever
 * "it" was two messages ago.
 */
export function retrieveForConversation(userMessages: string[], limit = 4): ScoredArticle[] {
  const recent = userMessages.slice(-3);
  if (recent.length === 0) return [];

  const totals = new Map<string, ScoredArticle>();
  recent.forEach((message, i) => {
    // Newest message weighted 1.0, the one before 0.5, the one before that 0.25.
    const weight = 1 / 2 ** (recent.length - 1 - i);
    retrieve(message, limit + 2).forEach((hit) => {
      const existing = totals.get(hit.article.id);
      const score = hit.score * weight;
      if (existing) existing.score += score;
      else totals.set(hit.article.id, { article: hit.article, score });
    });
  });

  return Array.from(totals.values()).sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Render retrieved articles as the context block for the model prompt. */
export function formatContext(hits: ScoredArticle[]): string {
  if (hits.length === 0) return '(No knowledge base article matched this question.)';
  return hits
    .map(({ article }) => {
      const where = article.href ? `\nIn-app location: ${article.href}` : '';
      return `<article id="${article.id}" title="${article.title}">${where}\n${article.body}\n</article>`;
    })
    .join('\n\n');
}
