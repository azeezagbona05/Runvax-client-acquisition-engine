import { CONTACT_LABEL, type ContactState, type FinderBusiness } from './acqFinder';

/**
 * Search and advanced filtering for the Find Prospects table. Pure functions, so the screen stays thin and this is easy to test.
 * A record is a business plus what the screen knows about it (contact state, emails, people), flattened for matching.
 */
export interface ProspectRecord {
  b: FinderBusiness;
  contact: ContactState;
  /** A business or decision-maker email has been found. */
  hasEmail: boolean;
  /** At least one of its emails has been checked and exists. */
  verified: boolean;
  /** A person with a decision-maker title was found. */
  decisionMaker: boolean;
  /** Every email found for it, joined. */
  emailText: string;
  /** Lower-cased text the free-text search looks in: name, category, address, phone, website, area, emails, people and titles. */
  text: string;
}

export function makeRecord(b: FinderBusiness, extra: { contact: ContactState; emails?: string[]; people?: Array<{ name: string; title?: string }>; verified?: boolean; decisionMaker?: boolean }): ProspectRecord {
  const emails = (extra.emails ?? []).filter(Boolean);
  const text = [b.name, b.category, b.address, b.phone, b.website, b.foundBy, ...emails, ...(extra.people ?? []).flatMap((p) => [p.name, p.title])]
    .filter(Boolean).join(' \u0001 ').toLowerCase();
  return { b, contact: extra.contact, hasEmail: emails.length > 0, verified: !!extra.verified, decisionMaker: !!extra.decisionMaker, emailText: emails.join(' '), text };
}

// ── Free-text search ────────────────────────────────────────────────────────
/** Every word must appear somewhere in the record (any order), so "lekki pizza" finds a pizza place in Lekki. */
export function searchRecords(recs: ProspectRecord[], query: string): ProspectRecord[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return recs;
  return recs.filter((r) => words.every((w) => r.text.includes(w)));
}

// ── Advanced filter: rules joined by "all" or "any" ─────────────────────────
export type FieldId = 'name' | 'category' | 'address' | 'phone' | 'website' | 'email' | 'area' | 'rating' | 'reviews' | 'contact' | 'verified' | 'decision';
export type FieldKind = 'text' | 'number' | 'enum';
export type Op = 'contains' | 'not_contains' | 'is' | 'is_not' | 'starts' | 'empty' | 'not_empty' | 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';

export const FIELDS: ReadonlyArray<{ id: FieldId; label: string; kind: FieldKind }> = [
  { id: 'name', label: 'Business name', kind: 'text' },
  { id: 'category', label: 'Category', kind: 'text' },
  { id: 'address', label: 'Address', kind: 'text' },
  { id: 'phone', label: 'Phone', kind: 'text' },
  { id: 'website', label: 'Website', kind: 'text' },
  { id: 'email', label: 'Email found', kind: 'text' },
  { id: 'area', label: 'Found in area', kind: 'text' },
  { id: 'rating', label: 'Rating', kind: 'number' },
  { id: 'reviews', label: 'Reviews', kind: 'number' },
  { id: 'contact', label: 'Contact status', kind: 'enum' },
  { id: 'verified', label: 'Verified email', kind: 'enum' },
  { id: 'decision', label: 'Decision maker found', kind: 'enum' },
];
export const OP_LABEL: Record<Op, string> = {
  contains: 'contains', not_contains: 'does not contain', is: 'is', is_not: 'is not', starts: 'starts with', empty: 'is empty', not_empty: 'is not empty',
  eq: '=', gt: '>', gte: '≥', lt: '<', lte: '≤', between: 'is between',
};
export const OPS_BY_KIND: Record<FieldKind, Op[]> = {
  text: ['contains', 'not_contains', 'is', 'starts', 'empty', 'not_empty'],
  number: ['gte', 'gt', 'lte', 'lt', 'eq', 'between', 'empty', 'not_empty'],
  enum: ['is', 'is_not'],
};
/** The choices for an enum field's value. */
export const enumOptionsOf = (f: FieldId): Array<{ value: string; label: string }> => (f === 'contact' ? CONTACT_OPTIONS : [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]);
export const CONTACT_OPTIONS: Array<{ value: ContactState; label: string }> = (Object.keys(CONTACT_LABEL) as ContactState[]).map((value) => ({ value, label: CONTACT_LABEL[value] }));
export const kindOf = (f: FieldId): FieldKind => FIELDS.find((x) => x.id === f)!.kind;
export const needsValue = (op: Op) => op !== 'empty' && op !== 'not_empty';

export interface Rule { id: string; field: FieldId; op: Op; value: string; value2?: string }
export interface FilterGroup { match: 'all' | 'any'; rules: Rule[] }
export const EMPTY_GROUP: FilterGroup = { match: 'all', rules: [] };

let n = 0;
export const newRule = (over: Partial<Rule> = {}): Rule => ({ id: `r${Date.now().toString(36)}${n++}`, field: 'name', op: 'contains', value: '', ...over });
export const defaultOp = (f: FieldId): Op => OPS_BY_KIND[kindOf(f)][0];

/** A rule that is still being filled in (no value yet) is ignored instead of hiding everything. */
export function ruleActive(r: Rule): boolean {
  if (!needsValue(r.op)) return true;
  if (r.op === 'between') return r.value.trim() !== '' && (r.value2 ?? '').trim() !== '' && !Number.isNaN(Number(r.value)) && !Number.isNaN(Number(r.value2));
  if (kindOf(r.field) === 'number') return r.value.trim() !== '' && !Number.isNaN(Number(r.value));
  return r.value.trim() !== '';
}

function raw(rec: ProspectRecord, f: FieldId): string | number | undefined {
  const b = rec.b;
  switch (f) {
    case 'name': return b.name; case 'category': return b.category; case 'address': return b.address; case 'phone': return b.phone;
    case 'website': return b.website; case 'area': return b.foundBy; case 'email': return rec.emailText;
    case 'rating': return b.rating; case 'reviews': return b.reviewCount ?? 0; case 'contact': return rec.contact;
    case 'verified': return rec.verified ? 'yes' : 'no'; case 'decision': return rec.decisionMaker ? 'yes' : 'no';
  }
}

export function evalRule(rec: ProspectRecord, r: Rule): boolean {
  const v = raw(rec, r.field);
  const kind = kindOf(r.field);
  const blank = v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  if (r.op === 'empty') return blank;
  if (r.op === 'not_empty') return !blank;
  if (kind === 'number') {
    if (typeof v !== 'number') return false;
    const a = Number(r.value), b2 = Number(r.value2);
    switch (r.op) {
      case 'eq': return v === a; case 'gt': return v > a; case 'gte': return v >= a; case 'lt': return v < a; case 'lte': return v <= a;
      case 'between': return v >= Math.min(a, b2) && v <= Math.max(a, b2);
      default: return true;
    }
  }
  const s = String(v ?? '').toLowerCase(), w = r.value.trim().toLowerCase();
  switch (r.op) {
    case 'contains': return s.includes(w);
    case 'not_contains': return !s.includes(w);
    case 'is': return s === w;
    case 'is_not': return s !== w;
    case 'starts': return s.startsWith(w);
    default: return true;
  }
}

export function applyGroup(recs: ProspectRecord[], g: FilterGroup): ProspectRecord[] {
  const rules = g.rules.filter(ruleActive);
  if (!rules.length) return recs;
  return recs.filter((rec) => (g.match === 'all' ? rules.every((r) => evalRule(rec, r)) : rules.some((r) => evalRule(rec, r))));
}
export const activeRuleCount = (g: FilterGroup) => g.rules.filter(ruleActive).length;

/** One-tap starting points. They add ordinary rules, which can then be edited or removed. */
export const PRESETS: ReadonlyArray<{ id: string; label: string; rules: Array<Omit<Rule, 'id'>> }> = [
  { id: 'no-site', label: 'No website', rules: [{ field: 'website', op: 'empty', value: '' }] },
  { id: 'has-site', label: 'Has a website', rules: [{ field: 'website', op: 'not_empty', value: '' }] },
  { id: 'rated-4', label: 'Rated 4.0+', rules: [{ field: 'rating', op: 'gte', value: '4' }] },
  { id: 'reviews-20', label: '20+ reviews', rules: [{ field: 'reviews', op: 'gte', value: '20' }] },
  { id: 'has-phone', label: 'Has a phone', rules: [{ field: 'phone', op: 'not_empty', value: '' }] },
  { id: 'email-found', label: 'Email found', rules: [{ field: 'email', op: 'not_empty', value: '' }] },
  { id: 'verified', label: 'Verified email', rules: [{ field: 'verified', op: 'is', value: 'yes' }] },
  { id: 'decision', label: 'Decision maker', rules: [{ field: 'decision', op: 'is', value: 'yes' }] },
];
export const presetOn = (g: FilterGroup, id: string): boolean => {
  const p = PRESETS.find((x) => x.id === id)!;
  return p.rules.every((pr) => g.rules.some((r) => r.field === pr.field && r.op === pr.op && r.value === pr.value));
};
export function togglePreset(g: FilterGroup, id: string): FilterGroup {
  const p = PRESETS.find((x) => x.id === id)!;
  if (presetOn(g, id)) return { ...g, rules: g.rules.filter((r) => !p.rules.some((pr) => r.field === pr.field && r.op === pr.op && r.value === pr.value)) };
  return { ...g, rules: [...g.rules, ...p.rules.map((r) => newRule(r))] };
}
