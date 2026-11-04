# Consolidated owner decisions

Only decisions that materially affect the pilot. Source detail: `01-owner-decision-sheet.md` (offer) and `02-counsel-questions.md` (legal). This list supersedes neither; it orders them.

**When needed:** **Local** = before local testing; **Pitch** = before pitches can be marked ready; **Live** = before any real outreach; **Prod** = before production deployment.

## Part 1: decisions for the owner

| # | Question | Recommended default | If delayed | Needed |
|---|---|---|---|---|
| **D0** | Where will the pilot database live? | A new database on the owner's own machine, e.g. `runvax_pilot`, with a backup. Never the production database | Stage A cannot start safely | **Local** |
| **O-1** | May we prepare records of real clinics (public business facts from their own sites, role inboxes and business numbers only) **before** counsel replies, given the counsel questions Q-N1/Q-N4 are open? | Yes, for local preparation with data minimised as in `03`, section 6. This is a risk decision for the owner, not a legal conclusion. Prefer to ask counsel first if the owner is uncomfortable | Stages A and B wait on counsel | **Local** |
| **D1** | Which 20 clinics, and where did each name come from? | Own research and referrals first; association lists second; list the source per batch. Choose 25 to finish with 20. Not Google Maps | Nothing to research | **Local** |
| **D2** | What is the offer: scope, deliverables, implementation, integrations (website chat in; WhatsApp later; booking systems out)? | Smallest credible version, e.g. an AI Receptionist that answers routine questions from clinic-approved information and hands appointment requests to staff, website chat only, no booking-system integration | Pitches cannot be marked ready | **Pitch** |
| **D3** | Does a working AI Receptionist or demo exist today? | If not, say so: frame the pilot as inviting a small number of clinics to shape a first version, and never imply it is live | Risk of an untrue pitch | **Pitch** |
| **D4** | Price policy | No price in the pitch; discuss on the call. Set an internal range before the first call | Fine until a call is booked | **Pitch** (policy), **Live** (range) |
| **D5** | Approved claims | None beyond what the evidence shows about the clinic's own site. Keep the blocked list (never miss, 24/7, guarantee, more patients, etc.) | Pitches stay strictly factual (a safe default) | **Pitch** |
| **D6** | Sender identity: legal entity, named sender, postal address | The named human sender plus the registered entity; settle exact wording with counsel | Cannot send | **Live** |
| **D7** | Support and onboarding model after a "yes" | A sentence in the owner sheet is enough for now | Questions in the first call | **Live** |
| **D8** | Pitch wording: the sample says Harzotech "is preparing" the product | Keep "is preparing" if D3 is no; revise to match the facts | Tone risk | **Pitch** |
| **D9** | Who is the named person responsible for replies, with a backup? | The owner, with a named backup | Opt-outs could be missed | **Live** |
| **D10** | Contact frequency | One email per clinic, no automatic follow-up; a second only after a reply | Ambiguity | **Live** |
| **D11** | Success and stop rules | Use the scorecard in `04`. Stop on any complaint or any message that does not match an approved pitch | No agreed finish line | **Live** |
| **D12** | Run warm routes in parallel (introductions, referrals, a free website review invitation)? | Yes, and ask counsel what applies to each | The pilot depends only on cold email | **Live** |
| **D13** | Update the pilot size in the counsel questions and the sheet from 10 to 20 | Yes, before sending them | Counsel answers for a different size | **Local** |

## Part 2: legal and privacy questions governing outreach (from any source)
These remain **separate blockers for real-world contact**. They are open; nothing here treats any of them as settled. Full text in `02-counsel-questions.md`.

| Q | Question | Needed |
|---|---|---|
| Q-N2 (central) | May an unsolicited email to a clinic's role inbox rely on legitimate interest under the NDPA 2023, or is consent required? Does it matter if the inbox identifies an individual? | Live |
| Q-N1 / Q-N4 | Is recording published contact points and website observations before contact legitimate; are role inboxes and business numbers personal data? | Local (see O-1) and Live |
| Q-N5 | What notice must be given, when, and what must the privacy policy add? | Live |
| Q-N3 | Which form of legitimate-interest assessment does the NDPC's guidance require? | Live |
| Section D | Objections, source disclosure, erasure and the keyed-hash record, record of processing | Live |
| Q-N6 / Q-N8 / DPO | DPIA, NDPC registration, data protection officer | Before scaling; counsel says if the pilot needs them |
| Q-N7 / Q-N9 / Q-N10 | Retention, hosting and transfers, erasure versus backups | Local-pilot data stays on your machine; Prod for hosting |
| Section I | Does a 20-clinic manual pilot change the obligations; conditions counsel would accept | Live |

**Without waiting for counsel:** the owner may decide to proceed with outreach after weighing the risk; that is a recorded business decision, not engineering's and not legal clearance.

## Part 3: Route B (Google Places) policy questions, kept separate
Route B stays **off** and does **not** block Route A or the pilot. Questions L1 to L7 in `docs/places-activation-dependencies.md`: L1 prospecting as a permitted use; L2 place IDs plus our research as a "directory"; L3 fetching a site first learned from Places; L4 in-memory name filtering; L5 attribution if details are shown; L6 which terms apply (the account owner can answer from the billing address); L7 a completed legitimate-interest assessment. Decide only after the pilot shows the Route A list is the limiting factor.

## Order of work
1. D0, O-1, D1, D13 (today).
2. Send counsel the questions (updated); complete D2 to D5, D8 (offer).
3. D3 honestly; D6, D9 to D12 before Stage D.
