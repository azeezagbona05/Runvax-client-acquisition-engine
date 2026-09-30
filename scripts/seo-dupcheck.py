import glob, re, itertools, collections, os

paths = sorted(set(
    glob.glob('content/blog/web-design-clients-*.mdx') +
    glob.glob('content/blog/how-to-find-web-design-clients-in-*.mdx') +
    glob.glob('content/blog/how-to-get-web-design-clients-uk.mdx')
))

def body(p):
    t = open(p, encoding='utf8').read()
    parts = t.split('---', 2)
    return parts[2] if len(parts) > 2 else t

def shingles(text, n=6):
    w = re.findall(r"[a-z0-9']+", text.lower())
    return {' '.join(w[i:i+n]) for i in range(max(0, len(w)-n+1))}

def h2s(text):
    return tuple(re.findall(r'^## (.+)$', text, re.M))

docs = {os.path.basename(p)[:-4]: body(p) for p in paths}
print(f"geo posts analysed: {len(docs)}\n")

# structural templating
structs = collections.Counter(h2s(t) for t in docs.values())
print(f"distinct H2 structures across {len(docs)} posts: {len(structs)}")
for s, c in structs.most_common(3):
    print(f"  {c} post(s) share this {len(s)}-heading structure: {list(s)[:4]}{'...' if len(s) > 4 else ''}")

# pairwise similarity
print("\ntop content-similarity pairs (6-word shingle Jaccard):")
sh = {k: shingles(v) for k, v in docs.items()}
pairs = []
for a, b in itertools.combinations(sorted(sh), 2):
    inter = len(sh[a] & sh[b]); union = len(sh[a] | sh[b])
    if union:
        pairs.append((inter/union, a, b))
pairs.sort(reverse=True)
for j, a, b in pairs[:8]:
    print(f"  {j:5.1%}  {a}  <->  {b}")
print(f"\n  median pair similarity: {sorted(p[0] for p in pairs)[len(pairs)//2]:.1%}")

# sentences repeated verbatim across many posts
print("\nsentences appearing verbatim in 4+ geo posts:")
sent_docs = collections.defaultdict(set)
for k, t in docs.items():
    t = re.sub(r'\|.*\|', ' ', t)  # drop table rows
    for s in re.split(r'(?<=[.!?])\s+|\n\n', t):
        s = ' '.join(s.split())
        if len(s.split()) >= 8 and not s.startswith(('#', '-', '>', '|')):
            sent_docs[s].add(k)
rep = [(len(v), s) for s, v in sent_docs.items() if len(v) >= 4]
rep.sort(reverse=True)
for n, s in rep[:10]:
    print(f"  [{n} posts] {s[:110]}{'...' if len(s) > 110 else ''}")
print(f"  total such sentences: {len(rep)}")
