import type { CareerProfileData, Standing } from '@/lib/career/types';

/**
 * Application Form Mapper. Decides, for every field on an employer's form, what (if anything) may be typed into it.
 * The rule is simple and strict: a value may come ONLY from the candidate's confirmed (tailored) profile or from an answer the candidate
 * saw and approved. Anything else that the form REQUIRES stops the submission. Legal, eligibility and consent questions are never answered.
 */
export type FieldType = 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file' | 'url' | 'number';
export interface FormField { id: string; label: string; type: FieldType; required: boolean; name?: string; options?: string[]; accept?: string }

export type Kind = 'full_name' | 'first_name' | 'last_name' | 'email' | 'phone' | 'location' | 'linkedin' | 'github' | 'website' | 'company' | 'resume' | 'cover_file' | 'cover_text' | 'sensitive' | 'consent' | 'question';

const R = (...w: string[]) => new RegExp(`(?:${w.join('|')})`, 'i');
// Things only the candidate may state: legal status, eligibility, consent, health, identity, background checks.
const SENSITIVE = R('authori[sz]ed to work', 'right to work', 'legally (?:authori[sz]ed|eligible|able)', 'work (?:permit|authori[sz]ation|visa|eligib)', 'sponsorship', 'visa', 'citizen', 'immigration', 'security clearance', 'criminal', 'convict', 'background check', 'gender', 'pronoun', 'race', 'ethnic', 'hispanic', 'latino', 'veteran', 'military', 'disabilit', 'sexual orientation', 'transgender', 'religio', 'date of birth', 'birth ?date', 'age\\b', 'marital', 'national id', 'social security', 'ssn', 'passport', 'non-?compete', 'conflict of interest', 'relatives?|related to (?:an? )?(?:employee|current)', 'previously (?:worked|employed|applied)', 'current(?:ly)? employee', 'government', 'drug', 'employment agreement', 'post-employment', 'restrictions? (?:with|from|imposed)', 'subject to (?:any|an)', 'contractual', 'worked (?:at|for)', 'consulted for', 'employed (?:by|at)', '\\breferr(?:al|ed)\\b', 'how many years', 'notice period', '\\breferences?\\b', 'self-?identif', 'diversity', 'equal opportunity', 'eeo');
const CONSENT = R('i (?:agree|accept|consent|acknowledge|have read|understand|confirm)', 'privacy (?:policy|notice|statement)', 'terms (?:and|&) conditions', 'terms of (?:use|service)', 'data (?:processing|protection)', 'gdpr', 'consent', 'acknowledge', 'certify', 'declaration', 'signature', 'subscribe', 'keep (?:my|me)', 'receive (?:emails|updates|communications)');

export function kindOf(f: FormField): Kind {
  const l = `${f.label} ${f.name ?? ''}`.toLowerCase().replace(/\s+/g, ' ');
  // A long, sentence-like label is a QUESTION, never a simple contact field, however many contact words it contains.
  const plain = f.label.toLowerCase().replace(/[*\u2731:]+/g, ' ').replace(/\s+/g, ' ').trim();
  const short = plain.length <= 45 && !/\?/.test(plain);
  if (f.type === 'file') return /cover|letter/.test(l) ? 'cover_file' : /resume|cv|curriculum/.test(l) ? 'resume' : /transcript|portfolio|certificate|writing sample|other|additional|attach/.test(l) ? 'cover_file' : 'resume';
  if (SENSITIVE.test(l)) return 'sensitive';
  if (f.type === 'checkbox' && CONSENT.test(l)) return 'consent';
  if (CONSENT.test(l) && f.type === 'radio') return 'consent';
  if (/first name|given name|forename/.test(l)) return 'first_name';
  if (/last name|family name|surname/.test(l)) return 'last_name';
  if (/^(?:full |legal )?name\b|your name|\bname\*?$|name\[?\]?$/.test(l) && !/company|employer|school|reference/.test(l)) return 'full_name';
  if (short && (f.type === 'email' || /e-?mail/.test(plain))) return 'email';
  if (short && (f.type === 'tel' || /^(?:preferred |mobile |cell |contact |telephone )?(?:phone|mobile|telephone|cell)(?: number)?$/.test(plain))) return 'phone';
  if (short && /linkedin/.test(plain)) return 'linkedin';
  if (short && /github/.test(plain)) return 'github';
  if (short && /^(?:personal |your |portfolio |other )?(?:website|portfolio|url|link|site)(?: url| link)?$|personal (?:site|url)/.test(plain)) return 'website';
  if (/^(?:current |present |most recent )?(?:company|employer|organi[sz]ation)(?: name)?$/.test(plain) || /^org$/.test(String(f.name ?? '').toLowerCase())) return 'company';
  if (short && /^(?:current )?(?:location|city)(?: \(?city\)?)?$|^location \(city\)$|^where are you (?:based|located)$/.test(plain)) return 'location';
  if (/cover letter|covering letter|motivation letter|why .*(?:want|interested)|additional information|anything else|tell us more/.test(l) && (f.type === 'textarea' || f.type === 'text')) return /why .*(?:want|interested)/.test(l) ? 'question' : 'cover_text';
  return 'question';
}

export interface PreparedAnswer { question: string; answer: string }
export interface Filled { field: FormField; kind: Kind; value: string; source: 'profile' | 'cover letter' | 'approved answer' | 'resume' | 'your saved details' }
export interface Unresolved { label: string; reason: string }
export interface Plan { fill: Filled[]; unresolved: Unresolved[]; skipped: Array<{ label: string; why: string }> }

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) ?? []);
/** An approved answer fits a question only when they clearly talk about the same thing. */
export function bestAnswer(label: string, answers: PreparedAnswer[]): PreparedAnswer | null {
  const lw = words(label); if (!lw.size) return null;
  let best: PreparedAnswer | null = null, top = 0;
  for (const a of answers) {
    const aw = words(a.question); const shared = Array.from(aw).filter((w) => lw.has(w)).length;
    const score = shared / Math.max(1, Math.min(aw.size, lw.size)); if (shared >= 2 && score > top) { top = score; best = a; }
  }
  return top >= 0.5 ? best : null;
}
const splitName = (n: string) => { const p = n.trim().split(/\s+/); return { first: p[0] ?? '', last: p.slice(1).join(' ') }; };
const chooseOption = (options: string[] | undefined, want: string) => options?.find((o) => o.toLowerCase().trim() === want.toLowerCase().trim()) ?? null;

const NO_STANDING: Standing = { linkedin: '', github: '', website: '', authorizedToWork: '', needsSponsorship: '', residenceCountry: '', howHeard: '' };
const AUTH_Q = /(?:authori[sz]ed|eligible|permitted|allowed|legally able) to work|right to work/i;
const SPONSOR_Q = /sponsorship|require (?:a )?visa|need (?:a )?visa/i;
const OTHER_STATUS = /citizen|permanent resident|clearance|green card|h-?1b only/i;
const yesNo = (options: string[] | undefined, yes: boolean) => options?.find((o) => (yes ? /^yes\b/i : /^no\b/i).test(o.trim())) ?? null;
const HOW_HEARD = /how did you (?:hear|find|learn)|where did you (?:hear|find|learn)|heard about|how you heard/i;
const RESIDENCE = /country (?:of )?(?:residence|you (?:currently )?(?:live|reside))|current country|where do you (?:currently )?(?:reside|live)|country\b.*\b(?:reside|live)/i;

export function planForm(fields: FormField[], cv: CareerProfileData, opts: { coverLetter: string; answers: PreparedAnswer[]; standing?: Standing }): Plan {
  const st = opts.standing ?? NO_STANDING;
  const plan: Plan = { fill: [], unresolved: [], skipped: [] };
  const n = splitName(cv.name); const current = cv.experience.find((r) => /present|current|now/i.test(r.end)) ?? null;
  const need = (f: FormField, reason: string) => { if (f.required) plan.unresolved.push({ label: f.label || f.name || 'A required field', reason }); else plan.skipped.push({ label: f.label || f.name || 'An optional field', why: reason }); };

  for (const f of fields) {
    const kind = kindOf(f);
    const put = (value: string, source: Filled['source']) => { if (value.trim()) plan.fill.push({ field: f, kind, value, source }); else need(f, 'Your confirmed profile does not have this.'); };
    switch (kind) {
      case 'sensitive': {
        // Only two legal topics may be answered, and only from what the candidate themselves saved: work authorization and visa sponsorship.
        const lab = f.label; const choice = f.type === 'select' || f.type === 'radio';
        const want = AUTH_Q.test(lab) && !OTHER_STATUS.test(lab) && st.authorizedToWork ? yesNo(f.options, st.authorizedToWork === 'yes')
          : SPONSOR_Q.test(lab) && !OTHER_STATUS.test(lab) && !AUTH_Q.test(lab) && st.needsSponsorship ? yesNo(f.options, st.needsSponsorship === 'yes') : null;
        if (choice && want) plan.fill.push({ field: f, kind, value: want, source: 'your saved details' });
        else need(f, 'This is a legal, eligibility or personal question. Only you can answer it.');
        break;
      }
      case 'consent': need(f, 'This asks you to agree to something. Only you can agree.'); break;
      case 'resume': plan.fill.push({ field: f, kind, value: '', source: 'resume' }); break;
      case 'cover_file': need(f, 'This asks for a file the agent does not have.'); break;
      case 'full_name': put(cv.name, 'profile'); break;
      case 'first_name': put(n.first, 'profile'); break;
      case 'last_name': put(n.last, 'profile'); break;
      case 'email': put(cv.email, 'profile'); break;
      case 'phone': put(cv.phone, 'profile'); break;
      case 'location': put(cv.location, 'profile'); break;
      case 'company': put(current?.company ?? '', 'profile'); break;
      case 'linkedin': case 'github': case 'website': st[kind] ? plan.fill.push({ field: f, kind, value: st[kind], source: 'your saved details' }) : need(f, 'You have not saved this link. Add it in Edit setup (step 2).'); break;
      case 'cover_text': opts.coverLetter.trim() ? plan.fill.push({ field: f, kind, value: opts.coverLetter, source: 'cover letter' }) : need(f, 'No cover letter was prepared.'); break;
      default: {
        if (RESIDENCE.test(f.label) && st.residenceCountry) { const o = (f.type === 'select' || f.type === 'radio') ? (f.options ?? []).find((x) => x.toLowerCase().trim() === st.residenceCountry.toLowerCase()) : st.residenceCountry; if (o) { plan.fill.push({ field: f, kind, value: o, source: 'your saved details' }); break; } }
        if (HOW_HEARD.test(f.label) && st.howHeard) { const o = (f.type === 'select' || f.type === 'radio') ? (f.options ?? []).find((x) => x.toLowerCase().includes(st.howHeard.toLowerCase())) : st.howHeard; if (o) { plan.fill.push({ field: f, kind, value: o, source: 'your saved details' }); break; } }
        const a = bestAnswer(f.label, opts.answers);
        if (!a) { need(f, 'No approved answer fits this question.'); break; }
        if (f.type === 'select' || f.type === 'radio') { const o = chooseOption(f.options, a.answer); o ? plan.fill.push({ field: f, kind, value: o, source: 'approved answer' }) : need(f, 'The approved answer does not match the choices offered.'); break; }
        if (f.type === 'checkbox' || f.type === 'file') { need(f, 'Cannot be answered from text.'); break; }
        plan.fill.push({ field: f, kind, value: a.answer, source: 'approved answer' });
      }
    }
  }
  return plan;
}
