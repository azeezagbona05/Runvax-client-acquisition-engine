import { describe, expect, it } from 'vitest';
import { AGENT_TASKS, TASKS_FOR, describeJob, optionsFor, templateForTasks } from '@/lib/agents/options';
import { classifyByRules } from '@/lib/agents/classify';
import { planAgent, skillsFor } from '@/lib/agents/write';
import type { VisibilityConfig, AssistantConfig } from '@/lib/agents/kinds';
import { TEMPLATES, CHAT_TEMPLATES } from '@/lib/agents/templates';

describe('agent form options', () => {
  it('lists the template suggestions first, with no repeats', () => {
    const o = optionsFor('escalation', 'support');
    expect(o.slice(0, TEMPLATES.support.escalation!.length)).toEqual(TEMPLATES.support.escalation);
    expect(new Set(o).size).toBe(o.length);
    expect(optionsFor('audience').length).toBeGreaterThan(5);
  });

  it('turns chips into a plain-English job', () => {
    expect(describeJob('Dental clinic', ['answer', 'book'])).toBe('I run a dental clinic. I want an AI agent that answers enquiries about our services and books appointments.');
    expect(describeJob('Online store', ['recommend'])).toMatch(/^I run an online store\./);
    expect(describeJob('', [], 'just extra')).toBe('just extra');
  });

  it('picks the agent from the ticked jobs', () => {
    expect(templateForTasks([])).toBeNull();
    expect(templateForTasks(['articles'])).toBe('visibility');
    expect(templateForTasks(['answer', 'capture', 'book'])).toBe('receptionist');
    expect(templateForTasks(['book'])).toBe('appointment');
    expect(templateForTasks(['recommend', 'answer'])).toBe('shopping');
    expect(templateForTasks(['qualify', 'crm'])).toBe('qualify');
    expect(templateForTasks(['staff'])).toBe('internal');
  });

  it('every task phrase is understood by the built-in planner as a chat or content job', () => {
    for (const t of AGENT_TASKS) expect(classifyByRules(describeJob('Hotel', [t.id])).kind, t.id).toBe(t.id === 'articles' ? 'visibility' : 'assistant');
  });

  it('the ticked jobs switch on the matching skills', () => {
    const job = describeJob('Software company', ['qualify', 'capture', 'crm', 'handoff', 'book']);
    expect(skillsFor('custom', job)).toEqual(expect.arrayContaining(['knowledge', 'qualify', 'leadCapture', 'crm', 'handoff', 'booking']));
    expect(skillsFor('custom', describeJob('Online store', ['recommend']))).toContain('productSearch');
  });

  it('every chat template has pre-ticked jobs', () => {
    for (const id of CHAT_TEMPLATES) expect(TASKS_FOR[id]?.length, id).toBeGreaterThan(0);
  });

  it('a chip-built request gives clean business facts and keywords', async () => {
    const v = (await planAgent('visibility', describeJob('Law firm', ['articles']), { site: null, useAi: false })).config as VisibilityConfig;
    expect(v.business.about).toBe('A law firm.');
    expect(v.keywords[0]).toBe('law firm');
    for (const junk of ['want', 'agent', 'writes', 'blog']) expect(v.keywords).not.toContain(junk);
    expect(v.topics.every((t) => /^[A-Z0-9]/.test(t))).toBe(true);
    const a = (await planAgent('assistant', describeJob('Dental clinic', ['answer', 'book']), { site: null, useAi: false, template: 'receptionist' })).config as AssistantConfig;
    expect(a.business.about).toBe('A dental clinic.');
  });
});
