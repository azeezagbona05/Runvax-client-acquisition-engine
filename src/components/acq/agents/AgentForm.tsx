'use client';

import KnowledgePanel from './KnowledgePanel';
import { ChoiceChips, MultiChips } from './Chips';
import { Check, Plus } from 'lucide-react';
import { TONES, CADENCES, LENGTHS, type AgentConfig, type AgentKind, type AssistantConfig, type VisibilityConfig } from '@/lib/agents/kinds';
import { CHAT_SKILLS, SKILLS, type SkillId } from '@/lib/agents/skills';
import { TEMPLATES } from '@/lib/agents/templates';
import { optionsFor, TOPIC_IDEAS } from '@/lib/agents/options';

const lbl = { display: 'block', fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 4 } as const;
const hint = { fontSize: 12, color: '#64748b', marginTop: 4 } as const;
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
const splitList = (t: string) => t.split(/\s*,\s*/).filter(Boolean);
const host = (u: string) => u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
const STATUS_BADGE: Record<string, [string, string, string]> = { ready: ['Ready', '#dcfce7', '#166534'], link: ['Uses your booking page', '#e0f2fe', '#075985'], campaign: ['In campaigns', '#f3e8ff', '#6b21a8'], soon: ['Coming soon', '#f1f5f9', '#475569'] };

function Step({ n, title, sub, children }: { n: number; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)', borderTop: '1px solid #e2e8f0', paddingTop: 14 }} aria-label={title}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
        <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 12, background: '#f3e8ff', color: '#7e22ce', display: 'inline-grid', placeItems: 'center', fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>{n}</span>
        <div><h3 className="acq-title" style={{ fontSize: 16 }}>{title}</h3>{sub && <p className="acq-faint" style={{ fontSize: 12.5, marginTop: 2 }}>{sub}</p>}</div>
      </div>
      {children}
    </section>
  );
}

/** The settings every agent has, plus the ones for its kind. Controlled: the parent holds the config. */
export default function AgentForm({ kind, cfg, onChange }: { kind: AgentKind; cfg: AgentConfig; onChange: (c: AgentConfig) => void }) {
  const set = <T extends AgentConfig>(patch: Partial<T>) => onChange({ ...cfg, ...patch } as AgentConfig);
  const biz = (p: Partial<AgentConfig['business']>) => onChange({ ...cfg, business: { ...cfg.business, ...p } });
  const v = cfg as VisibilityConfig;
  const business = (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div><label style={lbl} htmlFor="ag-bn">Business name</label><input id="ag-bn" className="acq-input" maxLength={100} value={cfg.business.name} onChange={(e) => biz({ name: e.target.value })} /></div>
        <div><label style={lbl} htmlFor="ag-url">Website</label><input id="ag-url" className="acq-input" placeholder="yourcompany.com" value={cfg.business.url} onChange={(e) => biz({ url: e.target.value })} /></div>
      </div>
      <div><label style={lbl} htmlFor="ag-about">What your business does</label><textarea id="ag-about" className="acq-textarea" rows={3} maxLength={1200} value={cfg.business.about} onChange={(e) => biz({ about: e.target.value })} /><p style={hint}>Plain facts only. The agent never adds prices, awards or clients you did not tell it about.</p></div>
      <MultiChips id="ag-aud" label="Who your customers are" options={optionsFor('audience')} value={splitList(cfg.business.audience)} onChange={(l) => biz({ audience: l.join(', ').slice(0, 300) })} max={6} />
      <ChoiceChips id="ag-tone" label="Tone" options={TONES.map((t) => [t, cap(t)] as const)} value={cfg.tone} onChange={(t) => set({ tone: t })} />
    </>
  );
  const domains = <MultiChips id="ag-dom" label="Only work on these websites (optional)" hint="Leave empty to allow any site that has your embed code." options={cfg.business.url ? [host(cfg.business.url)] : []} value={cfg.allowedDomains} onChange={(l) => set({ allowedDomains: l })} max={10} addLabel="Add a website" placeholder="yourcompany.com" />;

  if (kind === 'visibility') return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {business}
      <MultiChips id="ag-topics" label="Topics to write about" hint="The agent works through these in turn, and never repeats a title it has already written." options={TOPIC_IDEAS} value={v.topics} onChange={(l) => set<VisibilityConfig>({ topics: l })} max={20} addLabel="Add a topic" />
      <MultiChips id="ag-kw" label="Keywords buyers search for" options={[]} value={v.keywords} onChange={(l) => set<VisibilityConfig>({ keywords: l })} max={15} addLabel="Add a keyword" placeholder="e.g. teeth whitening lagos" />
      <ChoiceChips id="ag-cad" label="How often" options={(Object.keys(CADENCES) as VisibilityConfig['cadence'][]).map((c) => [c, { daily: 'Every day', weekly: 'Every week', biweekly: 'Every 2 weeks', monthly: 'Every month' }[c]] as const)} value={v.cadence} onChange={(c) => set<VisibilityConfig>({ cadence: c })} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ChoiceChips id="ag-n" label="Articles each time" options={[[1, '1'], [2, '2'], [3, '3']] as const} value={v.postsPerRun} onChange={(n) => set<VisibilityConfig>({ postsPerRun: n })} />
        <ChoiceChips id="ag-len" label="Length" options={(Object.keys(LENGTHS) as VisibilityConfig['length'][]).map((l) => [l, { short: 'Short (~350 words)', medium: 'Medium (~650)', long: 'Long (~1000)' }[l]] as const)} value={v.length} onChange={(l) => set<VisibilityConfig>({ length: l })} />
      </div>
      <ChoiceChips id="ag-ap" label="Publishing" options={[['review', 'I approve each article'], ['auto', 'Publish automatically']] as const} value={v.approval} onChange={(x) => set<VisibilityConfig>({ approval: x })} />
      {v.approval === 'auto' && <p className="acq-notice" style={{ fontSize: 13 }}>Automatic publishing only applies to articles the AI wrote. Anything written from the built-in template waits for your approval.</p>}
      {domains}
    </div>
  );

  const a = cfg as AssistantConfig; const internal = a.template === 'internal';
  const toggle = (s: SkillId, on: boolean) => set<AssistantConfig>({ skills: on ? Array.from(new Set([...a.skills, s])) : a.skills.filter((x) => x !== s || x === 'knowledge') });
  const skillSettings: Partial<Record<SkillId, React.ReactNode>> = {
    leadCapture: <div><label style={lbl} htmlFor="ag-mail">Email new leads to</label><input id="ag-mail" className="acq-input" type="email" placeholder="Leave empty to use your account email" value={a.notifyEmail} onChange={(e) => set<AssistantConfig>({ notifyEmail: e.target.value })} /></div>,
    qualify: <MultiChips id="ag-q" label="Qualifying questions it asks" options={optionsFor('questions', a.template)} value={a.questions} onChange={(l) => set<AssistantConfig>({ questions: l })} max={5} addLabel="Add a question" />,
    booking: <div><label style={lbl} htmlFor="ag-cal">Your booking page</label><input id="ag-cal" className="acq-input" placeholder="https://calendly.com/you/appointment" value={a.calendarUrl} onChange={(e) => set<AssistantConfig>({ calendarUrl: e.target.value })} /><p style={hint}>Calendly, Cal.com, Google Calendar or Microsoft Bookings. Visitors pick a free time there; that tool sends the confirmation and the reschedule and cancel links.</p></div>,
    handoff: <MultiChips id="ag-esc" label="Hand over to a person when…" hint={'Asking for a human and complaints always hand over. The conversation is marked "Needs a person" and you are emailed once they leave a way to reach them.'} options={optionsFor('escalation', a.template)} value={a.escalation} onChange={(l) => set<AssistantConfig>({ escalation: l })} max={8} addLabel="Add a rule" />,
    productSearch: <div><label style={lbl} htmlFor="ag-shop">Your shop address</label><input id="ag-shop" className="acq-input" placeholder="https://yourshop.com" value={a.shopUrl} onChange={(e) => set<AssistantConfig>({ shopUrl: e.target.value })} /><p style={hint}>The agent may link to product and checkout pages on this site only. Upload your catalogue as a CSV (name, price, description, link) in Knowledge above.</p></div>,
    crm: <div><label style={lbl} htmlFor="ag-crm">Send new leads to this webhook</label><input id="ag-crm" className="acq-input" placeholder="https://hooks.zapier.com/..." value={a.crmWebhookUrl} onChange={(e) => set<AssistantConfig>({ crmWebhookUrl: e.target.value })} /><p style={hint}>Each lead is POSTed as signed JSON ({'{ event, agent, lead }'}). Use Zapier, Make or n8n to put it into HubSpot, Pipedrive, Salesforce or a sheet.</p></div>,
  };

  return (
    <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <Step n={2} title="The job" sub={`Started from: ${TEMPLATES[a.template].label}. Everything here is editable.`}>
        <div><label style={lbl} htmlFor="ag-ins">Role and instructions</label><textarea id="ag-ins" className="acq-textarea" rows={4} maxLength={2000} value={a.instructions} onChange={(e) => set<AssistantConfig>({ instructions: e.target.value })} /></div>
        <MultiChips id="ag-obj" label="Objectives" options={optionsFor('objectives', a.template)} value={a.objectives} onChange={(l) => set<AssistantConfig>({ objectives: l })} max={6} addLabel="Add an objective" />
        <MultiChips id="ag-beh" label="How it talks" options={optionsFor('behaviour', a.template)} value={a.behaviour} onChange={(l) => set<AssistantConfig>({ behaviour: l })} max={6} addLabel="Add a rule" />
        <div><label style={lbl} htmlFor="ag-greet">First message people see</label><input id="ag-greet" className="acq-input" maxLength={300} value={a.greeting} onChange={(e) => set<AssistantConfig>({ greeting: e.target.value })} /></div>
      </Step>

      <Step n={3} title="Knowledge" sub="It answers only from this, and says so when it does not know.">
        {business}
        <div><label style={lbl} htmlFor="ag-know">What the agent knows (services, how it works, policies, FAQs)</label><textarea id="ag-know" className="acq-textarea" rows={6} maxLength={8000} value={a.knowledge} onChange={(e) => set<AssistantConfig>({ knowledge: e.target.value })} /></div>
        {a.knowledgeNeeded.length > 0 && (
          <div className="acq-notice" style={{ fontSize: 13 }}>
            <b>To do this job well, add:</b>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>{a.knowledgeNeeded.map((k) => { const done = a.knowledge.includes(`${k}:`); return (
              <button key={k} type="button" className={`acq-chip${done ? ' on' : ''}`} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', textAlign: 'left' }} aria-pressed={done} onClick={() => { if (!done) set<AssistantConfig>({ knowledge: `${a.knowledge.trimEnd()}${a.knowledge.trim() ? '\n\n' : ''}${k}: ` }); document.getElementById('ag-know')?.focus(); }}>{done ? <Check size={13} aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}{k}</button>
            ); })}</div>
            <span className="acq-faint" style={{ fontSize: 12 }}>Click one to start a line for it in the box above, or connect your website, documents (PDF), FAQs or a catalogue (CSV) below.</span>
          </div>
        )}
        <KnowledgePanel ids={a.knowledgeIds} onChange={(ids) => set<AssistantConfig>({ knowledgeIds: ids })} />
      </Step>

      <Step n={4} title="Skills and tools" sub="An agent only gets the tools it needs. Switch on what this job calls for.">
        <div role="group" aria-label="Agent skills" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CHAT_SKILLS.map((s) => {
            const info = SKILLS[s]; const usable = info.status === 'ready' || info.status === 'link'; const on = a.skills.includes(s); const locked = s === 'knowledge';
            const tag = locked ? 'always on' : !usable ? STATUS_BADGE[info.status][0].toLowerCase() : '';
            return (
              <button key={s} type="button" aria-pressed={on} disabled={!usable || locked} title={info.does} className={`acq-chip${on ? ' on' : ''}`} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', opacity: usable ? 1 : 0.5, cursor: !usable || locked ? 'default' : 'pointer' }} onClick={() => toggle(s, !on)}>
                {on ? <Check size={13} aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}{info.label}{tag && <span style={{ fontWeight: 500, fontSize: 11.5 }}>({tag})</span>}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {CHAT_SKILLS.filter((s) => a.skills.includes(s)).map((s) => {
            const info = SKILLS[s]; const [bl, bg, fg] = STATUS_BADGE[info.status];
            return (
              <div key={s} style={{ border: '1px solid #e9d5ff', background: '#faf5ff', borderRadius: 12, padding: '10px 12px', display: 'grid', gap: 8 }}>
                <div style={{ display: 'grid', gap: 2 }}>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b style={{ fontSize: 14 }}>{info.label}</b><span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 999, background: bg, color: fg }}>{s === 'knowledge' ? 'Always on' : bl}</span></span>
                  <span className="acq-faint" style={{ fontSize: 12.5 }}>{info.does}</span>
                  <span style={{ fontSize: 12.5, color: '#334155' }}>Tools: {info.tools.map((x) => x.soon ? `${x.t} (coming soon)` : x.t).join(' · ')}</span>
                </div>
                {skillSettings[s]}
              </div>
            );
          })}
        </div>
      </Step>

      <Step n={5} title="Where it works" sub="Other channels are added as their connections are ready.">
        {internal && <div><label style={lbl} htmlFor="ag-code">Staff access code</label><input id="ag-code" className="acq-input" maxLength={40} autoComplete="off" value={a.accessCode} onChange={(e) => set<AssistantConfig>({ accessCode: e.target.value })} /><p style={hint}>Staff type this before they can chat. Share it only inside your team. (Telegram is not available for staff agents.)</p></div>}
        <MultiChips id="ag-ch" label="Channels" options={internal ? ['Website widget'] : ['Website widget', 'Telegram bot']} custom={false} value={[...(a.channels.web ? ['Website widget'] : []), ...(a.channels.telegram && !internal ? ['Telegram bot'] : [])]} onChange={(l) => set<AssistantConfig>({ channels: { ...a.channels, web: l.includes('Website widget'), telegram: !internal && l.includes('Telegram bot') } })} hint="The website widget works on any site: WordPress, Shopify, Wix, Squarespace or your own code." />
        <p className="acq-faint" style={{ fontSize: 12.5 }}>WhatsApp: coming soon.</p>
        <div><label style={lbl} htmlFor="ag-priv">Your privacy policy link (optional)</label><input id="ag-priv" className="acq-input" placeholder="https://yourcompany.com/privacy" value={a.privacyUrl} onChange={(e) => set<AssistantConfig>({ privacyUrl: e.target.value })} /><p style={hint}>Shown under the chat box. People are always told they are talking to an AI and that their messages are saved and shared with you. Without a link, RUNVAX&apos;s own privacy page is used.</p></div>
        {domains}
      </Step>
    </div>
  );
}
