# AI Receptionist offer: owner decision sheet

**For:** the business owner. **Status:** every row below is **unapproved**. Nothing in RUNVAX can mark a pitch ready, or record one as sent, until the offer is approved and put into the product's configuration.

**How to use it:** fill in the right-hand column. Where it says *not defined*, nobody has decided yet, and engineering has deliberately not guessed. Leave a row blank if it should stay out of the pitch.

**What is already fixed in the product (you don't need to decide these):**
- Pitches are plain text written from fixed templates, using only facts the admin observed on the clinic's own website.
- The text contains no price, no figures and no results from other clinics unless you approve them.
- Every pitch ends with an opt-out line ("reply STOP…").
- A human approves every pitch. RUNVAX sends nothing.

| # | Item | What exists today (engineering's *proposed* wording; not approved) | Your decision |
|---|---|---|---|
| 1 | **Service scope** | *Problem:* patient enquiries may wait while staff are busy or the clinic is closed, and appointment requests may be hard to make other than by phone.<br>*Included (proposed):* answers routine questions (location, opening hours, services) using only information the clinic approves; collects the details of an appointment request and passes it to clinic staff; hands anything it can't answer to a person; set-up using the clinic's own approved information.<br>*Excluded (proposed):* clinical, diagnostic or treatment advice; access to patient records; integration with any booking or practice-management system unless separately agreed; phone and voice handling; any guaranteed response times, bookings, patient numbers or revenue. | Confirm, correct or delete each line. **Does the product exist and work as described?** |
| 2 | **Deliverables** | *Not defined.* | What exactly does a clinic receive? (For example: a configured assistant, the clinic's information loaded and approved, a hand-off process, a monthly report.) Anything the clinic must provide? |
| 3 | **Implementation** | *Not defined.* | Who sets it up, how long it takes, what the clinic must supply, how it goes live, and how you both know it's working (acceptance). |
| 4 | **Integrations and channels** | *Not defined.* The proposal says no integration with any booking or practice-management system unless separately agreed. | For each, mark **in / out / later**: website chat, WhatsApp Business, email, phone, a named booking or practice-management system. Pitches state none of them. |
| 5 | **Support** | *Not defined.* | Hours, contact channel, response and fix targets, who provides support, what happens when the assistant can't answer, and how incidents and patient-data issues are handled. |
| 6 | **Price** | **None approved.** No amount, currency or billing model is recorded. Pitches never contain pricing, and the safety gate blocks price language. | Choose one:<br>**(a)** no price in pitches; discuss it on the call *(recommended for the pilot)*; or<br>**(b)** a price you will stand behind: amount, currency, setup fee, billing period, minimum term. Showing a price in a pitch needs a product change and should be checked with counsel. |
| 7 | **Approved claims** | **None.** These are blocked outright for this offer: *never miss, 24/7, round the clock, guarantee, more patients, more bookings, fully automated, replace your receptionist, replace your staff, medical advice, diagnos…, AI doctor, compliant*. Any figure, percentage, guarantee or "other clinics saw…" language is also blocked. | List only claims you can **prove today**. For any result you want to cite, say where the evidence is. If there is none, keep the list empty. |
| 8 | **Sender identity** | Pitches sign off as *"Harzotech"*. The privacy policy names *Harzotech Nig Ltd* (to be confirmed). The product holds **no** sender identity or postal address, and for the pilot you send by hand. | Legal entity name; the **person** sending, with their title; the mailbox (address and domain); postal address and phone for the signature; whether the mailbox is set up to be accepted by receiving mail servers (**not verified by engineering**). |
| 9 | **Person responsible for clinic enquiries** | *Not defined.* | **Name and backup.** They: read every reply; record each reply, opt-out, meeting and proposal in RUNVAX the same day; take the "short call" or arrange it; escalate complaints. Set a response-time target (for example, same business day). **Who handles "STOP" replies, and how fast?** |
| 10 | **The wording of the pitch** | See the sample in `02-counsel-questions.md`. It currently says *"Harzotech is **preparing** an AI Receptionist for dental clinics…"* and ends *"Would a short call be useful…?"* | Is "is preparing" accurate? Is the product ready to demo on a call? Is a call the right next step? Who will be on it? |
| 11 | **The 10 clinics** | *None chosen.* The tool rejects any list sourced from Google Maps. | An **independent** list (your own research, referrals, association lists, the clinics' own websites), with where each name came from. |
| 12 | **Success and stop rules** | *Not defined.* | For example: how many replies, meetings or proposals out of 10 count as a signal; and the stop rule: any complaint, or any message not matching an approved pitch, pauses the pilot. |

## What happens after you decide

1. Engineering puts the approved wording into the product configuration. A pitch then becomes markable "ready". Required fields: status approved, description, scope, owner approval (who and when), a new version number, and any approved claims. The product refuses an approval missing any of these. This needs a code change and a deploy, which are **not** done until you approve.
2. Pitches written under the old (unapproved) wording are automatically marked out of date, and regenerated.
3. Counsel should see the **final** wording (`02-counsel-questions.md`).

**Not decided by this sheet:** whether outreach is lawful at all (counsel, see `02-counsel-questions.md`), and production changes (see `03-production-release-checklist.md`).

## Sign-off (the offer is not approved until this is completed)

| Owner name | Date | Decisions 1–12 complete? | Approved wording version |
|---|---|---|---|
| | | | |
