# 20-clinic pilot plan

**Purpose:** find out whether this system can efficiently identify dental clinics worth approaching and help Harzotech win paying clients. **The goal is learning, not 20 pitches.**

**Status:** a plan. Targets below are **hypotheses** chosen to force a decision, not historical performance. No results exist yet. Outreach stays **disabled** until the gates in Stage D are met. Readiness facts are in `03-readiness-assessment.md`; decisions in `05-owner-decisions.md`.

**Note on size:** 20 clinics can show whether the process works end to end and whether anything gets a reaction. It cannot give reliable conversion rates. Treat every number from it as an early signal.

## Stage A: prospect selection (target: 1 to 2 days, estimate)
1. **Source (independent, written down).** Use your own research, referrals, association member lists, or the clinics' own websites. Not Google Maps or Places. Record the source for each batch.
2. **Minimum record per clinic:** business name; website; area (one of Ikoyi, Victoria Island, Lekki, Ikeja GRA, Surulere, Yaba, Ajah, Gbagada, or note another); source; and, **if the clinic's own site publishes one**, a role inbox (info@, reception@, appointments@) and a business phone. Nothing about individuals.
3. **Selection criteria (hypothesis to test).** A working website, so there is something to observe; appointment-driven (a normal dental clinic); no obvious online booking or chat on the homepage; independent practice or small group (a decision-maker reachable); publishes a role inbox. Skip chains with central marketing, labs, suppliers and closed practices.
4. **Pick 25, finish with 20.** Some will fail research (dead site, no inbox). Load as a CSV using the template (it has the `email` column), or the paste box for clinics without an inbox.
5. **Check:** the preview shows accepted, duplicate and rejected counts. Nothing is created until you attest.

## Stage B: research (target: 10 to 15 minutes per clinic, **hypothesis to measure**)
For each clinic, open **its own website** and record, in the clinic's Evidence form (one submission can cover several observations from one page):
- Booking: is online booking present? Does a "book" button just lead to a contact form?
- Enquiry routes: contact form, WhatsApp link, chat widget, click-to-call, published opening hours.
- Basics: mobile-friendly, https, service pages.
- For each: the page URL, a short note, and confidence (low, medium, high).

**Rules:** record only what you can see on the page; no inference presented as fact; leave a signal out if unsure. Keep a time log (start, stop) per clinic. The system then re-scores and shows the readiness checklist: what is missing for a pitch.

**Qualification method (consistent for all 20):** use the system's score band and its readiness checklist. A clinic is "pitch-worthy" only if it shows at least one observed weakness relevant to the offer, has a role inbox, and is not suppressed. Record any clinic you drop and why.

## Stage C: offer and pitch (needs owner decisions first)
1. Owner completes decisions D2 to D9 (`05`). Engineering enters the approved offer into the product configuration (one reviewed change).
2. Generate a draft for each pitch-worthy clinic. Drafts are fixed templates built only from your recorded evidence, contain no price and end with an opt-out line.
3. **Human review of every pitch** (checklist): every fact traces to recorded evidence; no claim the owner has not approved; wording honest about what exists today (B2); sender identity correct; opt-out line present; tone acceptable. Edit, approve or reject. Approving after an edit is required. If you change the evidence, regenerate.
4. Mark ready. **Ready is not sent.** Nothing is sent from RUNVAX.

## Stage D: commercial validation (disabled until all gates are met)
**Gates, all required before a single real message:**
- G1 Offer approved and entered in the product (B1).
- G2 Counsel's written outreach opinion received, **or** a written owner decision to proceed without it (that decision is the owner's, not engineering's) (B3).
- G3 Privacy notice updated and sender identity settled (B4).
- G4 Named person responsible for replies, with a backup; stop rule agreed (B5).
- G5 Local suppression key set, database backed up.

**Process once open (proposed):** one email per clinic, to the published role inbox only, sent by hand from the sender's own mailbox using the approved text; record "sent" in RUNVAX with the date. No automatic follow-up. A second contact only after a reply. Record every reply, opt-out, meeting, proposal, win and loss the **same day**, with the reason where given. Any complaint, or any message that does not match an approved pitch, **pauses the pilot**.

**Run in parallel, not instead (hypothesis worth testing):** use the same 20 researched records for **warm routes** that do not depend on cold email: personal introductions, referrals, or inviting clinics to ask for a free website review. Warm contact may need less legal clearance and can teach you about the offer and the buyer sooner. Counsel should still confirm what applies.

## Stage E: evaluation (after about 4 weeks of Stage D, or when the stop rule triggers)
Review: list quality (how many of 25 were usable), research effort, pitch quality (review edits needed), replies, meetings, proposals, wins, and the reasons given for "no". Then decide:
- **Continue:** signals present, process affordable.
- **Improve:** which stage lost the most value (list, evidence, wording, offer, channel)?
- **Scale:** only if the numbers justify it and counsel has cleared the broader programme.
- **Stop:** no meaningful reaction and no learning to act on.

## Pilot scorecard
Fill from the funnel view and a simple spreadsheet kept by the named person. **Targets are hypotheses.**

| Metric | How measured | Initial target (hypothesis) |
|---|---|---|
| Clinics imported | Import counts | 25 |
| Clinics fully researched | Evidence recorded, readiness checked | 20 |
| Evidence sufficient for a credible pitch | Share of researched clinics with at least 1 observed relevant weakness and a role inbox | At least 60% (so 12 or more of 20) |
| Research time per clinic | Time log | 15 minutes or less; if far above, the process will not scale |
| Pitches generated, approved, marked ready | Funnel drafts counts | 12 or more |
| Review edits per pitch | Count of edits before approval | Falling over time |
| Outreach authorised and completed | Gates met; "sent" recorded | Only after Stage D gates |
| Replies, positive replies | Recorded outcomes | At least 1 positive reply or meeting from about 12 sent counts as a signal; 0 means review list and wording before more sending |
| Meetings, proposals, paying clients | Recorded outcomes with amounts | At least 1 meeting; proposal and win are bonuses at this size |
| Opt-outs and complaints | Recorded outcomes | Any complaint pauses the pilot |
| Human effort per qualified prospect | Time log divided by pitch-worthy clinics | Record the figure; compare with the value of a client |
| Reasons for rejection or failure | Notes on each dropped, declined or silent clinic | Captured for every one |

**What proves commercial progress:** a positive reply or a meeting from a researched clinic; a proposal; a payment. **What does not:** pitches generated, tests passing, documents written.

## Fastest safe route to 20 reviewed pitches
1. Today: owner decides D0, D1 and O-1; creates the local pilot database (`03`, section 6).
2. Days 1 to 2: assemble and import the list (Stage A).
3. Days 2 to 4: research (Stage B, about 5 hours if the 15-minute estimate holds).
4. In parallel from day 1: send counsel the questions (`02`, update the pilot size to 20) and complete the owner sheet (`01`, decisions D2 to D9).
5. Once the offer is entered: generate and review pitches (Stage C), about 1 to 2 hours.
6. Stop there. Real contact waits for Stage D gates.
