# Controlled 10-clinic pilot: readiness checklist

**Date:** 2026-10-18. **Branch:** `feat/industry-acquisition-phase1`. Local only: nothing pushed, merged, deployed or migrated. The feature flag stays off; automatic outreach is not enabled.

**Pilot defined:** about 10 dental clinics from an *independent* list (not Google Maps), pitched **by email, sent by hand outside RUNVAX**, with every outcome recorded in the tool. No OpenAI, no Places, no crawler, no delivery adapter, no scheduler.

## 1. What was fixed this round: the Pipeline bypass

**Problem:** engine clinics are ordinary CRM rows, so the Pipeline's email and WhatsApp buttons worked on them and skipped the engine's approval gate and suppression list.

**Fix:** RUNVAX sends to prospects through exactly three server routes (`/api/send-email`, `/api/proposal/send-email`, `/api/whatsapp/send`). Each now runs a recipient check before sending (`src/lib/acquisition/recipientGuard.ts`, 19 added lines across the three routes):

| Recipient | Result |
|---|---|
| Belongs to an acquisition clinic: its inbox, **any address at its domain or a subdomain**, or its phone in any format | **409**, nothing sent. The engine's review queue is the only way to reach it |
| On the account's suppression list (opt-out, objection, erasure), even after the contact record is erased | **403**, nothing sent |
| Anything else (ordinary RUNVAX prospects) | Unchanged |

**Properties:**
- **Data-based, not flag-based.** Clinics imported earlier stay protected if the flag is turned off.
- **Fail-safe.** If the acquisition tables don't exist yet (before the migration), the check allows the send, so production keeps working before and after the migration. Any other error refuses the send (503).
- **Browser-opened `wa.me` and `mailto:` links never reach the server**, so no server check can cover them. They send nothing from RUNVAX.
- A tripwire test fails if a new route that messages prospects is added without the check.

## 2. Verification results

| Check | Result |
|---|---|
| New sending tests (no message is ever sent) | 14; **7 fail without the fix**, 7 pin unchanged behaviour |
| New CRM baseline (list, save, update, ownership, engine rows stay ordinary) | 7 |
| Existing baselines (email, WhatsApp, tasks, middleware, gating) | pass, unchanged |
| Rex and Atlas on **real MySQL** | pass: ordinary prospects (including `source = NULL`) still processed; engine clinics excluded; suppressed clinic excluded |
| Full unit suite | **609 / 609 on Node 20.20, 22.23 and 24.22** |
| Real-MySQL integration suite | **18 / 18** |
| Clean `npm ci`, `tsc`, `next build` on Node 20 / 22 / 24 | all pass |

**Real browser, local throwaway database, synthetic clinics:**
- **Intake → pitch review:** CSV preview, queue, a blocked readiness list with reasons, **5 observations in one submission**, a re-score from the panel, readiness flips to "can be generated", pitch, edit, approve. Offer unapproved, so mark-ready was refused with the reason.
- **Sales half**, with a temporary local-only offer approval (then reverted byte-for-byte): offer change marked the old pitch stale (`offer_changed`) → regenerate → approve → mark ready → record sent → positive reply → meeting → proposal (NGN 450,000) → won (NGN 400,000). The funnel showed exactly those figures.
- **The bypass is closed in the live app:** 8 of 8 engine recipients refused (409), including after the deal; an ordinary prospect passed the check; a normal customer account was unaffected.
- **Defects fixed (essential only):** the "next step" section was at the bottom of a ~3,500 px profile, so it's now first; "evidence that would help" shows readable labels; a confirmation no longer appears twice.

## 3. Technical blockers (engineering and operations)

| # | Item | Status |
|---|---|---|
| T1 | **Apply 3 additive migrations to production** (`1_industry_acquisition`, `2_acquisition_intelligence`, `3_sales_workflow`) after a backup, plus the one-time baseline. Rehearsed repeatedly on throwaway MySQL with rollback. Runbook corrected this round (it still said one migration and 11 tables; it's three and 19) | **Needs your explicit approval and a change window.** Also not yet run: the read-only production schema check (`docs/production-schema-verification.md`) |
| T2 | **Production environment:** `IA_SUPPRESSION_KEY` and `IA_SUPPRESSION_KEY_ID` in the secret store (the feature fails closed without them); the pilot admin in `ADMIN_EMAILS`; `INDUSTRY_ACQUISITION_ENABLED=true` for the pilot only; `IA_CRAWLER_ENABLED`, `IA_PLACES_ENABLED` and `autoDraftEnabled` left off | Not done. Key generation and storage need an owner |
| T3 | **Deploy this branch** (merge, push, deploy) | Needs your approval. Order doesn't matter relative to T1 (tested) |
| T4 | **Offer approval into config:** once the owner approves, `catalogue.ts` needs `status: 'approved'`, a description and scope, `approvalState: 'approved_by_owner'` with who and when, a new `configVersion`, and any approved claims, then a deploy. **Without it nothing can be marked ready, and "sent" can't be recorded.** The config rejects an approval missing any of these | Small change, **waiting on owner content (section 4)** |

**Verified NOT blockers for this pilot:**
- sender identity (a delivery-time rule, deferred by design);
- a delivery adapter (sending is manual);
- the crawler, Places, OpenAI and a scheduler;
- named-contact entry (role inboxes only);
- evidence entry (a ~2-minute checklist per clinic).

## 4. Offer approval (owner decisions, no engineering)

- [ ] **Approve or rewrite the AI Receptionist wording** (`docs/offer-ai-receptionist-proposal.md`). In particular, the current text says Harzotech *"is preparing"* an AI Receptionist. Is that accurate?
- [ ] **Price:** shown in pitches or not? (Today: never. Pricing language is a gate block.)
- [ ] **Approved claims:** none today. Add only what can be substantiated.
- [ ] **The call to action** says "a short call". Who takes the calls, and when?
- [ ] **Who sends** the emails, from which mailbox, with which name and postal address.
- [ ] **The 10 clinics and their source:** an independent list, never Google Maps.
- [ ] **Success and stop rules**, for example a target for replies and meetings, and stopping on any complaint.

## 5. Legal requirements (counsel; not for engineering to decide)

The open questions are in `docs/compliance/dental-pilot-lia.md`. The assessment so far covers **research only**, not outreach.

- [ ] **Q-N2 (the gate):** may unsolicited B2B email go to clinic role inboxes (and named staff) on legitimate interest, or is prior consent required? (*Onimisi v. GTCO*, 2026, found no lawful basis for marketing a non-customer.)
- [ ] **Q-N1:** is prospect research itself a legitimate interest, for small clinics where business and owner overlap?
- [ ] **Q-N5:** privacy-notice update (the policy doesn't mention prospecting) and any notice owed to the people whose data was obtained from elsewhere.
- [ ] **Q-N4:** are role inboxes and business phones personal data?
- [ ] **Also for counsel to rule on before scaling:** Q-N6 (DPIA), Q-N8 (NDPC registration), Q-N9 (cross-border: database host appears to be in the UK, app on Vercel), Q-N7 (retention against the policy's 24 months), Q-N10 (backups and erasure).
- [ ] WhatsApp is **not used** in this pilot (email only), so the NCC questions (Q-N11) don't gate it.

## 6. Operating process for the pilot

- [ ] **Reply and opt-out owner:** replies come to the sender's mailbox, so one named person records each reply, opt-out and meeting in the tool the same day. An opt-out blocks the clinic and domain everywhere in RUNVAX, including the send routes.
- [ ] **Stop rule:** any complaint or any unexpected message pauses the pilot.
- [ ] **Rollback:** unset the flag and redeploy (instant); migration rollbacks are documented and rehearsed.

## 7. Recommended single next action

**Take one finished, representative pitch to counsel and book the outreach opinion (Q-N2) this week.**

Why this one:
- It is the only item with a long lead time outside our control.
- It decides whether the pilot is email as designed, consent-first, or a redesign.
- Every other blocker is either under a day of work or a one-hour owner decision, and the owner's wording review fits into the same week.
- It gives counsel the real wording to review rather than a hypothetical.

**Sample pitch for counsel** (generated by the tool from observed evidence; the clinic name is a placeholder):

> **Subject:** [Clinic]: a question about patient enquiries and appointment requests
>
> Hello [Clinic] team,
>
> When I looked at [clinic-domain] on [date], I couldn't find a way to book an appointment online, and I couldn't find an enquiry form.
>
> Harzotech is preparing an AI Receptionist for dental clinics: it would answer routine patient questions using information the clinic approves, and pass appointment requests to your team to confirm.
>
> Would a short call be useful to see whether this could fit how your clinic works?
>
> Kind regards,
> Harzotech
>
> If you'd prefer not to hear from us, reply STOP and we won't contact you again.
