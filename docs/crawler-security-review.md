# Crawler and security review: acquisition engine (Phase 2)

**Date:** 2026-10-14. **Scope:** `src/lib/acquisition/**`, `/api/acquisition/*`, `/acquisition`.

**Method:**
- Code review.
- Temporary probe tests run **against local fixtures with every network call mocked**. They were not committed; the results are recorded below.
- No live prospect sites, Places, DNS or providers were touched.
- The only external access was reading Harzotech's own public homepage and privacy policy, for item 1.

## 1. Crawler identity page

| Question | Finding |
|---|---|
| Does a genuine Harzotech site exist? | Yes: `https://harzotech.com/` (Harzotech Nig Ltd; info@harzotech.com; /contact, /privacy-policy, /terms-of-service) |
| Is there a crawler / bot policy page? | **None linked** from the navigation or footer. I didn't probe unlinked URLs, and **no URL is invented or assumed** |
| Does the privacy policy cover research or crawling? | **No.** The policy (effective 14 May 2025) doesn't mention business research, prospecting, crawling or B2B contact data |
| Fixture note | Unit tests use `https://harzotech.com/crawler-policy` only as a fixture string. **That page does not exist as far as I could see.** Recommend switching fixtures to an obviously fake domain (plan item P0-9) |

**Requirement:** the crawler stays disabled until Harzotech publishes a real page and `IA_CRAWLER_POLICY_URL` points at it. That's a change to **harzotech.com**, outside RUNVAX, and it's the site owner's decision and deployment.

**Proposed page content** (for `https://harzotech.com/crawler-policy` or similar; text needs legal review):

> **RunvaxResearchBot**
> - **Who we are:** Harzotech Nig Ltd, Lagos — info@harzotech.com.
> - **What it is:** a low-volume research crawler that reads the public pages of business websites (home, contact, about, services, booking) to understand how a business can be contacted and booked online.
> - **User agent:** `RunvaxResearchBot/1.0 (+https://harzotech.com/crawler-policy)`.
> - **What it respects:**
>   - `robots.txt` (product token `RunvaxResearchBot`, else `*`);
>   - `Crawl-delay`, with at least 2 seconds between requests;
>   - at most a handful of pages per site;
>   - no logins, forms, query strings or paywalls.
> - **What it keeps:** short factual notes (e.g. "has an online booking link"), with the page address and date. Page copies are deleted within 24 hours. No patient information is collected.
> - **Opt out:** add `User-agent: RunvaxResearchBot` / `Disallow: /` to your `robots.txt`, or email info@harzotech.com. We will stop crawling your domain and record it on our do-not-crawl list.
> - **Your data rights:** see our privacy policy (which needs a section on business research — LIA Q-N5).

## 2. Findings

> **Status update (2026-10-14, Phase 2B P0):** F1, F2, F3, F4/F17, F6, F7, F8, F9, F10, F13 and F14 are **fixed and verified locally**, as is the fixture URL (P0-9). See `docs/phase-2b-p0-report.md`. F5, F11 and F12 remain open (P1).

Severity is an engineering judgement:
- **High:** fix before any live use.
- **Medium:** fix before a pilot.
- **Low:** hardening.

| # | Area | Finding | Evidence (fixture probe) | Severity | Recommended fix |
|---|---|---|---|---|---|
| F7 | Deletion | **Erase contacts is incomplete.** Contact rows are deleted and tombstoned, but the same phone/email can remain in `AcquisitionSignal.evidenceQuote` (e.g. a `tel:` link quote), in `AcquisitionFinding.evidence`, and in `Prospect.businessData` (from the import) | Probe: after erasure on the S2 fixture, the phone and `reception@` address were still found in signals, findings and `businessData` | **High** | Mask contact values inside quotes at extraction (e.g. `tel:080…[masked]`). On erasure, redact matching values from quotes, findings and the engine-created `businessData`. Test: no erased value anywhere in any acquisition table or engine-created prospect |
| F8 | Retention | **Expired import previews are never purged.** `purgeExpiredImports()` exists but nothing calls it, so parsed rows (including contact columns) stay after the 24 h expiry | Probe: expired batch still contained `ada@…` after a queue run | **High** | Call it at the start of every acquisition API request and every queue run; test |
| F14 | Suppression | **Unsalted SHA-256 is weak for phones.** Nigerian mobile numbers are a small space, so a hash can be reversed by enumeration. Emails are guessable by dictionary | Analysis | **Medium** | Use keyed HMAC-SHA-256 with a server secret (`IA_SUPPRESSION_KEY`), with a documented key backup (losing the key breaks matching). Migrate existing local rows by re-hashing when the plain value is known; tombstones without a plain value can't be re-keyed, so keep dual-check during migration |
| F6 | Availability | **Extractor is quadratic on hostile HTML** (lazy `<form…</form>` scan) | Probe: 125 KB → 70 ms, 250 KB → 269 ms, 500 KB → 1,071 ms (4× per doubling); a ~1.5 MB hostile page is ~10 s. A benign 1.25 MB page takes 71 ms | **Medium** | Scan forms with `indexOf` (linear), cap the number of tag matches per page, cap extraction time per page; add a performance test (≤500 ms on a 1.5 MB hostile page) |
| F4 / F17 | Availability | **A large `Crawl-delay` is honoured in full** (probe: 60 s), and the 30 s site deadline is checked only between pages. Worst case (robots + 4 pages × (8 s + delay)) exceeds the 45 s task timeout, causing retries | Probe: a 60 000 ms sleep was requested | **Medium** | If `Crawl-delay` > 10 s, fetch the home page only and defer the rest to a later task. Check the deadline before every sleep and request. Test with a fake clock |
| F2 | Domain / SSRF scope | **Hosting-platform tenants count as one site and one organisation** (`*.netlify.app`, `*.github.io`, `*.wordpress.com`, `*.blogspot.com`, `*.vercel.app`, `*.myshopify.com`). The fetcher would follow a redirect from one tenant to another; dedupe would merge two unrelated clinics on the same platform | Probe confirmed for all six platforms (Wix is already excluded by `domainFromUrl`) | **Medium** | Use the Public Suffix List, including its private section (`tldts`, or a vendored snapshot; plan P1-2) |
| F1 | Domain / SSRF scope | **IP-literal hosts are accepted** as clinic sites, and "same site" compares the last two octets (`93.184.216.34` ≈ `8.8.216.34`). Private addresses are still blocked by the address check, and numeric/hex IPv4 forms are normalised by the URL parser, so this is a scope bug, not an SSRF bypass | Probe | **Medium** | Reject IP-literal hosts in `normalizeSiteUrl` and on every redirect hop (clinic sites have hostnames) |
| F5 | Politeness | **Per-host spacing is per call.** Two concurrent tasks for the same domain (branches) aren't spaced against each other | Probe: two concurrent fetches both ran without spacing | **Low–Medium** | A per-domain lease in the DB (`AcquisitionProviderUsage`-style row keyed by domain, holding `nextAllowedAt`), reserved atomically |
| F9 | Authorisation | **A suspended admin's existing session keeps access**: `requireAdmin()` checks the email allowlist but not `User.isSuspended` | Code review | **Medium** | Add a DB `isSuspended` check in `requireAcquisitionAccess()`; test 403 |
| F10 | CSRF | State-changing routes rely on NextAuth's `SameSite=Lax` session cookie; there's no `Origin` check | Code review | **Low** | Reject POST/DELETE whose `Origin` isn't the app origin; test |
| F13 | Retention | **The page cache is purged only after queue runs.** Expired rows are never served, but stay stored until the next run | Code review | **Low–Medium** | Purge on every acquisition API request, as for F8 |
| F3 | Redirects | A redirect `Location` carrying credentials (`https://user:pw@…`) is followed. The transport doesn't send them, but they should be refused | Probe | **Low** | Reject redirect URLs with credentials or non-standard ports (same rules as `normalizeSiteUrl`) |
| F11 | Abuse | No rate limit on the admin API (admin-only) | Code review | **Low** | A simple per-admin limit on import and action routes |
| F12 | Data handling | The page cache stores raw HTML (≤1.5 MB, ≤24 h) that may contain staff names or patient testimonials | Code review | **Low–Medium** (LIA Q-N13) | Option: store only the HTML regions the extractors need, or strip text outside `<head>`, links, forms and JSON-LD before caching |

## 3. What was reviewed and found sound

| Control | Status |
|---|---|
| Private / loopback / link-local / metadata / NAT64 / 6to4 / Teredo / IPv4-mapped address blocking | ✅ (tests) |
| Address re-check after every redirect; at most 3 redirects; off-site redirects refused | ✅ (tests) |
| DNS rebinding | ✅ The live transport pins the socket to the checked address through the `lookup` hook, with no second resolution. Node's keep-alive reuses only sockets opened to checked addresses. TLS hostname verification uses the original host (`servername`) |
| `robots.txt` (our token or `*`, longest match, Allow on ties, wildcards; 404 → allow; 401/403/429/5xx/timeout → disallow; ≥2 s delay) | ✅ (tests) |
| Timeouts: 8 s hard per request, 45 s per task, leases, retries 10/20/40 min, then dead | ✅ (tests; see F4/F17) |
| Size / type limits: 1.5 MB, `text/html` only, no decompression requested | ✅ |
| Credentials: no cookies, auth headers or keys sent to sites; the user agent carries only the policy URL; errors redacted before storage | ✅ |
| Budgets: atomic reservation before every request (including robots), Africa/Lagos day, concurrency-safe on real MySQL | ✅ (integration test) |
| Admin authorisation: flag → 404, signed out → 401, non-admin → 403 on every route and method | ✅ (tests; see F9/F10) |
| Live-access switches: Places / web fetch / PSI / DNS hard-coded off, with a tripwire test; no Places transport at all | ✅ |
| Suppression enforcement on every contact write path; Google-sourced imports rejected | ✅ (tests; see F14) |

## 4. Test plan for the fixes

Each fix gets a regression test that **fails on the current code**, using the same fixture and mocked-network approach. Two exceptions:
- **F14 and F8:** these also get an integration test on a disposable MySQL.
- **F5:** this needs a real-concurrency test on a disposable MySQL.
