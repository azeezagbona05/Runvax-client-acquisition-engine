# Closing the browser-link bypass for acquisition clinics

**Local only. Nothing pushed, merged, deployed or migrated; no schema change; flag untouched.**

## The gap
The send routes (`/api/send-email`, `/api/proposal/send-email`, `/api/whatsapp/send`) refuse acquisition clinics (409) and suppressed recipients (403). Buttons that open `wa.me` or `mailto:` in the browser never reach those routes.

## The fix (two layers, one source of truth)
1. **Render time:** a prospect whose server-returned `source` is `industry-acquisition` gets a disabled control with the notice "This clinic is managed by Industry Acquisition…". No link exists in the page. This only hides actions.
2. **Click time:** `POST /api/outreach/check` (signed-in, not flag- or admin-gated, 100 targets max) decides. It calls `checkOutreachTarget()` in `src/lib/acquisition/recipientGuard.ts`, which reuses `checkRecipient()` (same domain, subdomain, phone and suppression matching as the send routes) and also refuses a saved prospect that is an engine clinic by source or linked acquisition record, using what the **server** stores, never only what the page sends. "Managed" outranks "suppressed". Fail-closed: any error → refused. The tab is opened inside the click and closed again if refused; ordinary links carry no external `href`.

Shared client code: `src/lib/outreachGate.ts`, `src/components/OutreachLink.tsx`.

## Entry points found and handled
Pipeline page (board cards, table), prospect detail modal / conversation panel, bulk outreach modal (per-row Send, Start queue, Open all), follow-up sequence modal (WhatsApp and `mailto:`), Outreach modal WhatsApp link, `/dashboard`, home/search page (results table, card, drawer, bulk wa.me), QuickFire modal. Unrelated plain `mailto:info@runvax.com` support links are not prospect outreach and are left alone. A static test fails if a new `wa.me` / `mailto:` / `window.open` site appears outside the gate.

## Evidence (synthetic data, throwaway local MySQL, keys blanked, external requests aborted, no message sent)
- Unit: 652 / 652 on Node 20, 22 and 24 (was 609; +43: server check 20, client/UI/tripwire 23). `tsc` clean. Integration 18 / 18 on real MySQL. `next build` passes on Node 20, 22, 24.
- Browser (Chrome, desktop 1440 and mobile 390):
  - Ordinary (source NULL) and manual prospects: WhatsApp opened through the guarded flow (`wa.me` request seen, no alert).
  - Acquisition clinic and suppressed-domain acquisition clinic: disabled control, no link, no request.
  - **Stale UI** (page response rewritten to drop `source`): every acquisition clinic's button looked live, and every click was refused by the server with an alert; no `wa.me` request.
  - A saved ordinary prospect whose email sits on an engine clinic's domain: refused at click time.
  - Bulk modal: acquisition clinics excluded with a note; "Open all tabs" opened only the two ordinary chats and refused the server-managed one with an alert. Follow-up modal for an acquisition clinic shows the notice.
  - Table view: acquisition rows blocked, others guarded; zero raw `wa.me`/`mailto:` hrefs in any DOM inspected.
- Not exercised in a browser (covered by jsdom tests and the static tripwire only): the conversation panel's generated-reply links (needs AI, keys blank), `/dashboard`, QuickFire, Outreach modal, search-result card/drawer.

## Follow-up verification (after `c832a34`)
A second pass exercised the surfaces left unverified above, plus the whole lifecycle, on a disposable MySQL (flag on, keys blanked, every external request aborted, nothing sent). It found and fixed these:

| Finding | Severity | Fix |
|---|---|---|
| `POST /api/proposal` (proposal *generation*) also emails a client-supplied `prospectEmail` and had **no recipient guard**. An earlier tripwire had classed it as not prospect-facing. | Real server-side bypass (no UI caller passes it today; a crafted request could) | Same `checkRecipient()` before sending; refusal reported in the response; tripwire re-classified and now checks ordering; 5 tests, fail-first proven |
| `guardCron()` compared against `Bearer ${CRON_SECRET}`, so with `CRON_SECRET` unset the header `Bearer undefined` was accepted on every cron route (including the task-queue drain) | Fail-open auth (existing, not acquisition-specific) | Refuse everything when the secret is unset or empty; 2 tests |
| Repeated clicks on `Open WhatsApp` (card preview) made 3 checks and opened 3 chats; the same pattern existed in every direct `openOutreach` caller | Usability / duplicate-send | Central in-flight guard inside `openOutreach`, `followOutreach` and `openOutreachBatch`; duplicates are silent no-ops; unit + browser tested |
| `tel:` links on search cards, table and drawer ignored acquisition and suppression state | Gap (a call is outreach too) | Routed through the gate (`OutreachLink sameTab`): disabled for acquisition clinics, server-checked otherwise |
| Gate had no client timeout: a hung server left a blank tab open indefinitely | Usability | 10 s timeout, fail-closed, tab closed, user told |
| Search-page API bulk send ignored every response status, so refused recipients looked sent | Usability / misleading | `src/lib/bulkSend.ts`: per-recipient outcome, a summary naming each refused recipient and why, stops on 401; 6 tests + browser |
| Explanations on disabled controls were tooltip-only (invisible on touch screens) | Usability | Visible notice on cards, QuickFire, dashboard queue; Share hidden for acquisition clinics; bulk-email failures show the reason inline |

**Copy and share:** copying a phone number, email or message, and the system share sheet, are **not** controlled: they hand data to the person, not to a send path, and the share sheet has no recipient the server could check. Share is simply not offered for acquisition clinics.

**Browser evidence (desktop 1440 and mobile 390):** search results (cards, table, drawer, Outreach modal WhatsApp + Email, conversation panel), QuickFire, bulk wa.me, bulk API send (real server, 409 for acquisition numbers), bulk email, dashboard Outreach Queue. Each for an ordinary prospect, an unsaved copy of an acquisition clinic, a saved acquisition clinic and a domain-suppressed one, with stale (`source` stripped) state, a 500, a network failure, a hung server, and repeated clicks.

## Limits
See `docs/pilot/04-outstanding-blockers.md` §C.

## Utility-route review (after `66acfe2`)
Six routes had no auth check. Callers were traced first: the five with callers are used only from signed-in screens (guest search results are pointer-disabled, so guests never reach them), and two diagnostics have no caller.

| Route | Risk found | Disposition |
|---|---|---|
| `scrape-meta` | Anonymous, fetched any URL and followed redirects (SSRF to localhost, private networks, cloud metadata; returned page title/description) | Signed-in only; shared `safeFetch` (public addresses only, every redirect re-checked, http(s) and ports 80/443 only, body capped); 30/min per user |
| `enrich-email` | Anonymous; fetched caller-named websites (same SSRF) and ran paid/third-party search lookups | Signed-in only; all outbound page fetches go through `safeFetch`; 120/min per user |
| `verify-email` | Anonymous; wrote the address into an SMTP command (CR/LF injection) and connected to whatever host the MX named | Signed-in only; strict address pattern; refuses MX hosts that resolve to private addresses; 60/min per user |
| `details` | Anonymous; each cache miss spends Google Places quota; id was placed unencoded in the upstream path | Signed-in only; id must be a URL-safe token |
| `test-cse` | Anonymous; spent search quota, accepted a caller-supplied key and echoed 12 characters of the server key | Admin only (no caller) |
| `humanize-probe` | Anonymous; every call spent paid AI credits (no caller) | Admin only |

Residual: `safeFetch` checks the resolved address and then lets the normal fetch resolve again, so a hostile DNS server answering differently the second time is not fully excluded (the acquisition crawler pins the connection; these routes do not). `verify-email` now returns "invalid" for unusual but legal address characters. Rate limits are in-memory and best-effort per server instance.
