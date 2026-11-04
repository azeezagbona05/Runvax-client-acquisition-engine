import { sanitizeAutomation, type Automation } from '@/lib/automation';
import { sanitizeBrief, type CampaignBrief } from '@/lib/campaignBrief';
import { OFFICIAL_TEMPLATES, templateById, type TemplateConfig } from '@/lib/templateLibrary';

export interface SavedTemplateData { brief: CampaignBrief; automation: Automation }

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/**
 * What a saved template keeps from a campaign: its brief and email sequence, with the wording and settings the
 * user can edit. It deliberately keeps nothing about the campaign's people or history: no contacts, replies,
 * counts, dates, dollar values or message ids. Anything else on the automation object is dropped.
 */
export function templateDataFromCampaign(automationRaw: unknown): SavedTemplateData | null {
  const a = sanitizeAutomation(automationRaw);
  if (!a || a.emails.length === 0) return null;
  const brief = sanitizeBrief(a.brief ?? {});
  // Rebuilt from the sanitised fields only, so nothing unexpected rides along.
  const automation: Automation = {
    name: a.name, emails: a.emails.map((e) => ({ subject: e.subject, body: e.body, waitDays: e.waitDays, sendIf: e.sendIf })),
    stopOnReply: a.stopOnReply, replyRules: a.replyRules, sendMode: 'review', dailyCap: a.dailyCap,
    windowStart: a.windowStart, windowEnd: a.windowEnd, weekdaysOnly: a.weekdaysOnly, brief,
  };
  return { brief, automation };
}

export function sanitizeTemplateMeta(raw: { name?: unknown; description?: unknown; industry?: unknown }): { name: string; description: string; industry: string } {
  return { name: clean(raw.name, 120), description: clean(raw.description, 500), industry: clean(raw.industry, 80) || 'Custom' };
}

export interface TemplateRow { id: string; name: string; industry: string; description: string | null; baseTemplateId: string | null; data: unknown; createdAt: Date }

/** A saved row as a library card: the template it came from supplies the guidance, the saved brief and sequence supply the content. */
export function toConfig(row: TemplateRow): TemplateConfig | null {
  const d = row.data as { brief?: unknown; automation?: unknown } | null;
  const saved = templateDataFromCampaign(d?.automation ? { ...(d.automation as object), brief: d.brief ?? (d.automation as { brief?: unknown }).brief } : null);
  if (!saved) return null;
  const base = templateById(row.baseTemplateId) ?? OFFICIAL_TEMPLATES[0];
  return {
    ...base, id: row.id, source: 'user', industry: row.industry, name: row.name, category: 'My template',
    description: row.description || `Saved from a campaign. ${saved.automation.emails.length} emails.`,
    product: { ...base.product, name: saved.brief.offer || base.product.name, offer: saved.brief.offer || base.product.offer, summary: saved.brief.offerSummary || base.product.summary, features: saved.brief.features },
    primaryObjective: saved.brief.objective, conversion: saved.brief.conversion ?? base.conversion,
    savedAutomation: saved.automation,
  };
}
