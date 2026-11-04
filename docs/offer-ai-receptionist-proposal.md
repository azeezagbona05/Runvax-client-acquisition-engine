# AI Receptionist: proposed offer definition (for owner review)

> **Status: PROPOSED — NOT APPROVED.** Engineering wrote this from the dental opportunity categories already in the config, to give the business owner something to correct. It is not a description of an existing product. Every item needs confirming, correcting or deleting by Harzotech.
>
> In code: `src/lib/acquisition/config/catalogue.ts`, offer `ai_receptionist`. It has `status: 'unconfigured'` and `proposal.approvalState: 'proposed_unapproved'`, and pricing is `unapproved` with no amount. While that holds, a pitch for this offer can be generated and its wording reviewed, but it **can never be marked ready** (the gate block is `offer_unconfigured`).

## 1. Problem it addresses (proposed)

Patient enquiries that arrive while staff are busy or the clinic is closed may wait for a reply, and appointment requests may be hard to make other than by phone.

A pitch may only point to this problem when the clinic's own website shows **observed** evidence of it (section 5). It is never assumed.

## 2. Intended outcomes (proposed; not results)

- Routine patient enquiries get a first response without waiting for staff to be free.
- Appointment requests are captured and handed to the clinic team to confirm.

No figures are given for response times, booking volumes, patient numbers or revenue, and none may be implied.

## 3. Capabilities (proposed). Owner to confirm each one exists.

- Answers routine questions (e.g. location, opening hours, services offered) using only information the clinic has approved.
- Collects the details of an appointment request and passes them to clinic staff.
- Hands any enquiry it can't answer to a member of staff.

**Unknown, so not stated anywhere:**
- which channels it runs on (website chat, WhatsApp, email);
- languages;
- hours of operation;
- hosting and data location;
- what happens to conversation data.

## 4. Scope

| Included (proposed) | Excluded (proposed) |
|---|---|
| Set-up using the clinic's own approved information | Clinical, diagnostic or treatment advice |
| Written enquiries on channel(s) to be agreed. **Not yet specified** | Access to or handling of patient medical records |
| Hand-off to clinic staff | Integration with any booking or practice-management system, unless separately specified and confirmed |
| | Phone or voice handling (see AI Voice Agent) |
| | Guaranteed response times, booking volumes, patient numbers or revenue |

## 5. Evidence required before it may be pitched

At least **one fresh, observed weakness** (seen on the clinic's own website, within 180 days) in:
- `enquiry_handling`
- `booking_friction`
- `enquiry_conversion`

Only these observations can be put into words in a pitch, and only as what we couldn't find:

| Signal | Wording used |
|---|---|
| `online_booking_present = false` | "I couldn't find a way to book an appointment online" |
| `contact_form_present = false` | "I couldn't find an enquiry form" |
| `whatsapp_entry_point = false` | "I couldn't find a WhatsApp link" |
| `chat_widget_present = false` | "I couldn't see a chat option" |
| `opening_hours_published = false` | "I couldn't find your opening hours" |
| `click_to_call = false` | "I couldn't find a tap-to-call phone link" |

Inferred or unknown signals are shown to the reviewer and never stated in the text.

## 6. Claims

**Approved claims: none.** `proposedApprovedClaims` is empty. Any claim-like language in a pitch is blocked by the gate. That covers prices, percentages, guarantees, outcome promises, other clinics' results and delivery timelines.

**Prohibited for this offer** (blocked even after approval):
- never miss
- 24/7
- round the clock
- guarantee
- more patients
- more bookings
- fully automated
- replace your receptionist
- replace your staff
- medical advice
- diagnos(is/e)
- AI doctor
- compliant

The dental industry's own prohibited phrases also apply: pain-free, painless, cure, best dentist, guaranteed results, more patients guaranteed.

## 7. Pricing

**Unapproved.** No amount, currency or billing model is recorded, and the config rejects an amount while pricing is unapproved. Pitches contain no pricing. Pricing language is a gate block.

## 8. Pitch template parts (proposed wording)

- **Topic (subject):** "{Clinic}: a question about patient enquiries and appointment requests"
- **Relevance:** "Harzotech is preparing an AI Receptionist for dental clinics: it would answer routine patient questions using information the clinic approves, and pass appointment requests to your team to confirm."
- **Call to action:** "Would a short call be useful to see whether this could fit how your clinic works?"
- **Sign-off:** "Kind regards, Harzotech"
- **Opt-out line:** "If you'd prefer not to hear from us, reply STOP and we won't contact you again."

"Is preparing" reflects that the offer isn't yet defined. Change it if the product exists and is in use.

## 9. To approve this offer (owner actions)

1. Correct or confirm sections 1–8, especially the capabilities, the channels and the exclusions.
2. Supply pricing (or confirm it stays off pitches).
3. Add any claims you can substantiate to `approvedClaims` (they must not contain a prohibited phrase; the config refuses that).
4. Set:
   - `status: 'approved'`, `description` and `scope`;
   - `proposal.approvalState: 'approved_by_owner'`, `approvedBy` and `approvedAt`;
   - `configVersion: 2`.

   Any drafts generated under version 1 then become stale automatically (`offer_changed`).
5. Separately, and **not** covered here: the legal opinion on outreach (LIA Q-N1, Q-N2, Q-N4), a sending identity with a postal address, and a delivery adapter. Until all of those exist, a "ready" draft still can't be delivered from RUNVAX.
