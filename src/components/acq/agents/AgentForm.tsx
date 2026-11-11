'use client';

import KnowledgePanel from './KnowledgePanel';
import { TONES, CADENCES, LENGTHS, type AgentConfig, type AgentKind, type AssistantConfig, type VisibilityConfig } from '@/lib/agents/kinds';
import { CHAT_SKILLS, SKILLS, type SkillId } from '@/lib/agents/skills';
import { TEMPLATES } from '@/lib/agents/templates';

const lbl = { display: 'block', fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 4 } as const;
const hint = { fontSize: 12, color: '#64748b', marginTop: 4 } as const;
const lines = (a: string[]) => a.join('\n');
const toList = (t: string) => t.split('\n');
const STATUS_BADGE: Record<string, [string, string, string]> = { ready: ['Ready', '#dcfce7', '#166534'], link: ['Uses your booking page', '#e0f2fe', '#075985'], campaign: ['In campaigns', '#f3e8ff', '#6b21a8'], soon: ['Coming soon', '#f1f5f9', '#475569'] };

function Step({ n, title, sub, children }: { n: number; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 12, borderTop: '1px solid #e2e8f0', paddingTop: 14 }} aria-label={title}>
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
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div><label style={lbl} htmlFor="ag-aud">Who your customers are</label><input id="ag-aud" className="acq-input" maxLength={300} placeholder="e.g. patients, importers, SMEs" value={cfg.business.audience} onChange={(e) => biz({ audience: e.target.value })} /></div>
        <div><label style={lbl} htmlFor="ag-tone">Tone</label><select id="ag-tone" className="acq-select" value={cfg.tone} onChange={(e) => set({ tone: e.target.value as AgentConfig['tone'] })}>{TONES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}</select></div>
      </div>
    </>
  );
  const domains = <div><label style={lbl} htmlFor="ag-dom">Only work on these websites (optional, one per line)</label><textarea id="ag-dom" className="acq-textarea" rows={2} placeholder="yourcompany.com" value={lines(cfg.allowedDomains)} onChange={(e) => set({ allowedDomains: toList(e.target.value) })} /><p style={hint}>Leave empty to allow any site that has your embed code.</p></div>;

  if (kind === 'visibility') return (
    <div style={{ display: 'grid', gap: 16 }}>
      {business}
      <div><label style={lbl} htmlFor="ag-topics">Topics to write about (one per line)</label><textarea id="ag-topics" className="acq-textarea" rows={7} value={lines(v.topics)} onChange={(e) => set<VisibilityConfig>({ topics: toList(e.target.value) })} /><p style={hint}>The agent works through these in turn, and never repeats a title it has already written.</p></div>
      <div><label style={lbl} htmlFor="ag-kw">Keywords buyers search for (one per line)</label><textarea id="ag-kw" className="acq-textarea" rows={3} value={lines(v.keywords)} onChange={(e) => set<VisibilityConfig>({ keywords: toList(e.target.value) })} /></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div><label style={lbl} htmlFor="ag-cad">How often</label><select id="ag-cad" className="acq-select" value={v.cadence} onChange={(e) => set<VisibilityConfig>({ cadence: e.target.value as VisibilityConfig['cadence'] })}>{Object.keys(CADENCES).map((c) => <option key={c} value={c}>{{ daily: 'Every day', weekly: 'Every week', biweekly: 'Every 2 weeks', monthly: 'Every month' }[c]}</option>)}</select></div>
        <div><label style={lbl} htmlFor="ag-n">Articles each time</label><select id="ag-n" className="acq-select" value={v.postsPerRun} onChange={(e) => set<VisibilityConfig>({ postsPerRun: Number(e.target.value) })}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
        <div><label style={lbl} htmlFor="ag-len">Length</label><select id="ag-len" className="acq-select" value={v.length} onChange={(e) => set<VisibilityConfig>({ length: e.target.value as VisibilityConfig['length'] })}>{Object.keys(LENGTHS).map((l) => <option key={l} value={l}>{{ short: 'Short (~350 words)', medium: 'Medium (~650)', long: 'Long (~1000)' }[l]}</option>)}</select></div>
        <div><label style={lbl} htmlFor="ag-ap">Publishing</label><select id="ag-ap" className="acq-select" value={v.approval} onChange={(e) => set<VisibilityConfig>({ approval: e.target.value as 'review' | 'auto' })}><option value="review">I approve each article</option><option value="auto">Publish automatically</option></select></div>
      </div>
      {v.approval === 'auto' && <p className="acq-notice" style={{ fontSize: 13 }}>Automatic publishing only applies to articles the AI wrote. Anything written from the built-in template waits for your approval.</p>}
      {domains}
    </div>
  );

  const a = cfg as AssistantConfig; const internal = a.template === 'internal';
  const toggle = (s: SkillId, on: boolean) => set<AssistantConfig>({ skills: on ? Array.from(new Set([...a.skills, s])) : a.skills.filter((x) => x !== s || x === 'knowledge') });
  const skillSettings: Partial<Record<SkillId, React.ReactNode>> = {
    leadCapture: <div><label style={lbl} htmlFor="ag-mail">Email new leads to</label><input id="ag-mail" className="acq-input" type="email" placeholder="Leave empty to use your account email" value={a.notifyEmail} onChange={(e) => set<AssistantConfig>({ notifyEmail: e.target.value })} /></div>,
    qualify: <div><label style={lbl} htmlFor="ag-q">Qualifying questions (one per line, up to 5)</label><textarea id="ag-q" className="acq-textarea" rows={4} value={lines(a.questions)} onChange={(e) => set<AssistantConfig>({ questions: toList(e.target.value) })} /></div>,
    booking: <div><label style={lbl} htmlFor="ag-cal">Your booking page</label><input id="ag-cal" className="acq-input" placeholder="https://calendly.com/you/appointment" value={a.calendarUrl} onChange={(e) => set<AssistantConfig>({ calendarUrl: e.target.value })} /><p style={hint}>Calendly, Cal.com, Google Calendar or Microsoft Bookings. Visitors pick a free time there; that tool sends the confirmation and the reschedule and cancel links.</p></div>,
    handoff: <div><label style={lbl} htmlFor="ag-esc">Escalation rules: hand over to a person when… (one per line)</label><textarea id="ag-esc" className="acq-textarea" rows={4} value={lines(a.escalation)} onChange={(e) => set<AssistantConfig>({ escalation: toList(e.target.value) })} /><p style={hint}>Asking for a human and complaints always hand over. The conversation is marked &quot;Needs a person&quot; and you are emailed once they leave a way to reach them.</p></div>,
    productSearch: <div><label style={lbl} htmlFor="ag-shop">Your shop address</label><input id="ag-shop" className="acq-input" placeholder="https://yourshop.com" value={a.shopUrl} onChange={(e) => set<AssistantConfig>({ shopUrl: e.target.value })} /><p style={hint}>The agent may link to product and checkout pages on this site only. Upload your catalogue as a CSV (name, price, description, link) in Knowledge above.</p></div>,
    crm: <div><label style={lbl} htmlFor="ag-crm">Send new leads to this webhook</label><input id="ag-crm" className="acq-input" placeholder="https://hooks.zapier.com/..." value={a.crmWebhookUrl} onChange={(e) => set<AssistantConfig>({ crmWebhookUrl: e.target.value })} /><p style={hint}>Each lead is POSTed as signed JSON ({'{ event, agent, lead }'}). Use Zapier, Make or n8n to put it into HubSpot, Pipedrive, Salesforce or a sheet.</p></div>,
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Step n={2} title="The job" sub={`Started from: ${TEMPLATES[a.template].label}. Everything here is editable.`}>
        <div><label style={lbl} htmlFor="ag-ins">Role and instructions</label><textarea id="ag-ins" className="acq-textarea" rows={4} maxLength={2000} value={a.instructions} onChange={(e) => set<AssistantConfig>({ instructions: e.target.value })} /></div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><label style={lbl} htmlFor="ag-obj">Objectives (one per line)</label><textarea id="ag-obj" className="acq-textarea" rows={4} value={lines(a.objectives)} onChange={(e) => set<AssistantConfig>({ objectives: toList(e.target.value) })} /></div>
          <div><label style={lbl} htmlFor="ag-beh">Conversation behaviour (one per line)</label><textarea id="ag-beh" className="acq-textarea" rows={4} value={lines(a.behaviour)} onChange={(e) => set<AssistantConfig>({ behaviour: toList(e.target.value) })} /></div>
        </div>
        <div><label style={lbl} htmlFor="ag-greet">First message people see</label><input id="ag-greet" className="acq-input" maxLength={300} value={a.greeting} onChange={(e) => set<AssistantConfig>({ greeting: e.target.value })} /></div>
      </Step>

      <Step n={3} title="Knowledge" sub="It answers only from this, and says so when it does not know.">
        {business}
        <div><label style={lbl} htmlFor="ag-know">What the agent knows (services, how it works, policies, FAQs)</label><textarea id="ag-know" className="acq-textarea" rows={6} maxLength={8000} value={a.knowledge} onChange={(e) => set<AssistantConfig>({ knowledge: e.target.value })} /></div>
        {a.knowledgeNeeded.length > 0 && (
          <div className="acq-notice" style={{ fontSize: 13 }}>
            <b>To do this job well, add:</b>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{a.knowledgeNeeded.map((k) => <li key={k}>{k}</li>)}</ul>
            <span className="acq-faint" style={{ fontSize: 12 }}>Write it above, or connect your website, documents (PDF), FAQs or a catalogue (CSV) below.</span>
          </div>
        )}
        <KnowledgePanel ids={a.knowledgeIds} onChange={(ids) => set<AssistantConfig>({ knowledgeIds: ids })} />
      </Step>

      <Step n={4} title="Skills and tools" sub="An agent only gets the tools it needs. Switch on what this job calls for.">
        <div style={{ display: 'grid', gap: 10 }} role="group" aria-label="Agent skills">
          {CHAT_SKILLS.map((s) => {
            const info = SKILLS[s]; const usable = info.status === 'ready' || info.status === 'link'; const on = a.skills.includes(s); const [bl, bg, fg] = STATUS_BADGE[info.status];
            return (
              <div key={s} style={{ border: `1px solid ${on ? '#c4b5fd' : '#e2e8f0'}`, background: on ? '#faf5ff' : usable ? '#fff' : '#f8fafc', borderRadius: 12, padding: '10px 12px', display: 'grid', gap: 8, opacity: usable ? 1 : 0.75 }}>
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: usable && s !== 'knowledge' ? 'pointer' : 'default' }}>
                  <input type="checkbox" style={{ marginTop: 3 }} checked={on} disabled={!usable || s === 'knowledge'} onChange={(e) => toggle(s, e.target.checked)} aria-describedby={`sk-${s}`} />
                  <span style={{ display: 'grid', gap: 2, flex: 1 }}>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b style={{ fontSize: 14 }}>{info.label}</b><span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 999, background: bg, color: fg }}>{s === 'knowledge' ? 'Always on' : bl}</span></span>
                    <span id={`sk-${s}`} className="acq-faint" style={{ fontSize: 12.5 }}>{info.does}</span>
                    {on && <span style={{ fontSize: 12.5, color: '#334155' }}>Tools: {info.tools.map((x) => x.soon ? `${x.t} (coming soon)` : x.t).join(' · ')}</span>}
                  </span>
                </label>
                {on && skillSettings[s] && <div style={{ paddingLeft: 26 }}>{skillSettings[s]}</div>}
              </div>
            );
          })}
        </div>
      </Step>

      <Step n={5} title="Where it works" sub="Other channels are added as their connections are ready.">
        {internal && <div><label style={lbl} htmlFor="ag-code">Staff access code</label><input id="ag-code" className="acq-input" maxLength={40} autoComplete="off" value={a.accessCode} onChange={(e) => set<AssistantConfig>({ accessCode: e.target.value })} /><p style={hint}>Staff type this before they can chat. Share it only inside your team. (Telegram is not available for staff agents.)</p></div>}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 14 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={a.channels.web} onChange={(e) => set<AssistantConfig>({ channels: { ...a.channels, web: e.target.checked } })} /> Website widget (any site, WordPress, Shopify, Wix…)</label>
          {!internal && <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={a.channels.telegram} onChange={(e) => set<AssistantConfig>({ channels: { ...a.channels, telegram: e.target.checked } })} /> Telegram bot</label>}
        </div>
        <p className="acq-faint" style={{ fontSize: 12.5 }}>WhatsApp: coming soon.</p>
        <div><label style={lbl} htmlFor="ag-priv">Your privacy policy link (optional)</label><input id="ag-priv" className="acq-input" placeholder="https://yourcompany.com/privacy" value={a.privacyUrl} onChange={(e) => set<AssistantConfig>({ privacyUrl: e.target.value })} /><p style={hint}>Shown under the chat box. People are always told they are talking to an AI and that their messages are saved and shared with you. Without a link, RUNVAX&apos;s own privacy page is used.</p></div>
        {domains}
      </Step>
    </div>
  );
}
