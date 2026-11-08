/** Finding the pieces of a knowledge base that matter for what a visitor just said. Keyword scoring (BM25-style): no vector database needed. */
const STOP = new Set('the a an and or of for to in on at is are was were be been it its this that these those with from your you we our us do does did can could would should will how what when where who why which about into as by not no yes please hi hello thanks thank have has had i me my they them their there here also any some more most very just than then so if but'.split(' '));
export const tokens = (s: string): string[] => (s.toLowerCase().match(/[a-z0-9À-ɏ]{2,}/g) ?? []).filter((w) => !STOP.has(w)).map((w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));

export interface Scored<T> { item: T; score: number }
/** The best `k` chunks for a query. Chunks that share no words with the query are never returned. */
export function rankChunks<T extends { text: string; label?: string | null }>(query: string, chunks: T[], k = 5): Array<Scored<T>> {
  const q = Array.from(new Set(tokens(query))); if (!q.length || !chunks.length) return [];
  const docs = chunks.map((c) => { const t = tokens(`${c.label ?? ''} ${c.text}`); const tf = new Map<string, number>(); for (const w of t) tf.set(w, (tf.get(w) ?? 0) + 1); return { c, tf, len: t.length || 1 }; });
  const avg = docs.reduce((a, d) => a + d.len, 0) / docs.length; const N = docs.length;
  const idf = new Map(q.map((w) => { const n = docs.filter((d) => d.tf.has(w)).length; return [w, Math.log(1 + (N - n + 0.5) / (n + 0.5))] as const; }));
  return docs.map((d) => ({ item: d.c, score: q.reduce((s, w) => { const f = d.tf.get(w) ?? 0; return f ? s + (idf.get(w) ?? 0) * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (d.len / avg)))) : s; }, 0) }))
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
}
