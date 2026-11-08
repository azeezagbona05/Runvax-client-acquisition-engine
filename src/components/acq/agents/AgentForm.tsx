'use client';

import { TONES, CADENCES, LENGTHS, type AgentConfig, type AgentKind, type AssistantConfig, type VisibilityConfig } from '@/lib/agents/kinds';

const lbl = { display: 'block', fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 4 } as const;
const hint = { fontSize: 12, color: '#64748b', marginTop: 4 } as const;
const lines = (a: string[]) => a.join('\n');
const toList = (t: string) => t.split('\n');

/** The settings every agent has, plus the ones for its kind. Controlled: the parent holds the config. */
export default function AgentForm({ kind, cfg, onChange }: { kind: AgentKind; cfg: AgentConfig; onChange: (c: AgentConfig) => void }) {
  const set = <T extends AgentConfig>(patch: Partial<T>) => onChange({ ...cfg, ...patch } as AgentConfig);
  const biz = (p: Partial<AgentConfig['business']>) => onChange({ ...cfg, business: { ...cfg.business, ...p } });
  const v = cfg as VisibilityConfig, a = cfg as AssistantConfig;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div><label style={lbl} htmlFor="ag-bn">Business name</label><input id="ag-bn" className="acq-input" maxLength={100} value={cfg.business.name} onChange={(e) => biz({ name: e.target.value })} /></div>
        <div><label style={lbl} htmlFor="ag-url">Website</label><input id="ag-url" className="acq-input" placeholder="yourcompany.com" value={cfg.business.url} onChange={(e) => biz({ url: e.target.value })} /></div>
      </div>
      <div><label style={lbl} htmlFor="ag-about">What your business does</label><textarea id="ag-about" className="acq-textarea" rows={3} maxLength={1200} value={cfg.business.about} onChange={(e) => biz({ about: e.target.value })} /><p style={hint}>Plain facts only. The agent never adds prices, awards or clients you did not tell it about.</p></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div><label style={lbl} htmlFor="ag-aud">Who you sell to</label><input id="ag-aud" className="acq-input" maxLength={300} placeholder="e.g. importers, dental clinics, SMEs" value={cfg.business.audience} onChange={(e) => biz({ audience: e.target.value })} /></div>
        <div><label style={lbl} htmlFor="ag-tone">Tone</label><select id="ag-tone" className="acq-select" value={cfg.tone} onChange={(e) => set({ tone: e.target.value as AgentConfig['tone'] })}>{TONES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}</select></div>
      </div>

      {kind === 'visibility' && <>
        <div><label style={lbl} htmlFor="ag-topics">Topics to write about (one per line)</label><textarea id="ag-topics" className="acq-textarea" rows={7} value={lines(v.topics)} onChange={(e) => set<VisibilityConfig>({ topics: toList(e.target.value) })} /><p style={hint}>The agent works through these in turn, and never repeats a title it has already written.</p></div>
        <div><label style={lbl} htmlFor="ag-kw">Keywords buyers search for (one per line)</label><textarea id="ag-kw" className="acq-textarea" rows={3} value={lines(v.keywords)} onChange={(e) => set<VisibilityConfig>({ keywords: toList(e.target.value) })} /></div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div><label style={lbl} htmlFor="ag-cad">How often</label><select id="ag-cad" className="acq-select" value={v.cadence} onChange={(e) => set<VisibilityConfig>({ cadence: e.target.value as VisibilityConfig['cadence'] })}>{Object.keys(CADENCES).map((c) => <option key={c} value={c}>{{ daily: 'Every day', weekly: 'Every week', biweekly: 'Every 2 weeks', monthly: 'Every month' }[c]}</option>)}</select></div>
          <div><label style={lbl} htmlFor="ag-n">Articles each time</label><select id="ag-n" className="acq-select" value={v.postsPerRun} onChange={(e) => set<VisibilityConfig>({ postsPerRun: Number(e.target.value) })}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
          <div><label style={lbl} htmlFor="ag-len">Length</label><select id="ag-len" className="acq-select" value={v.length} onChange={(e) => set<VisibilityConfig>({ length: e.target.value as VisibilityConfig['length'] })}>{Object.keys(LENGTHS).map((l) => <option key={l} value={l}>{{ short: 'Short (~350 words)', medium: 'Medium (~650)', long: 'Long (~1000)' }[l]}</option>)}</select></div>
          <div><label style={lbl} htmlFor="ag-ap">Publishing</label><select id="ag-ap" className="acq-select" value={v.approval} onChange={(e) => set<VisibilityConfig>({ approval: e.target.value as 'review' | 'auto' })}><option value="review">I approve each article</option><option value="auto">Publish automatically</option></select></div>
        </div>
        {v.approval === 'auto' && <p className="acq-notice" style={{ fontSize: 13 }}>Automatic publishing only applies to articles the AI wrote. Anything written from the built-in template waits for your approval.</p>}
      </>}

      {kind === 'assistant' && <>
        <div><label style={lbl} htmlFor="ag-greet">First message visitors see</label><input id="ag-greet" className="acq-input" maxLength={300} value={a.greeting} onChange={(e) => set<AssistantConfig>({ greeting: e.target.value })} /></div>
        <div><label style={lbl} htmlFor="ag-know">What the assistant knows</label><textarea id="ag-know" className="acq-textarea" rows={7} maxLength={8000} value={a.knowledge} onChange={(e) => set<AssistantConfig>({ knowledge: e.target.value })} /><p style={hint}>Services, who it is for, how it works, what happens next. It answers only from this and says so when it does not know.</p></div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><label style={lbl} htmlFor="ag-goal">Its job</label><select id="ag-goal" className="acq-select" value={a.goal} onChange={(e) => set<AssistantConfig>({ goal: e.target.value as AssistantConfig['goal'] })}><option value="qualify">Qualify visitors and collect contacts</option><option value="book">Get visitors to book a call</option><option value="support">Answer questions</option><option value="all">All of these</option></select></div>
          <div><label style={lbl} htmlFor="ag-cal">Booking link (optional)</label><input id="ag-cal" className="acq-input" placeholder="https://calendly.com/you/demo" value={a.calendarUrl} onChange={(e) => set<AssistantConfig>({ calendarUrl: e.target.value })} /></div>
        </div>
        <div><label style={lbl} htmlFor="ag-q">Qualifying questions (one per line, up to 5)</label><textarea id="ag-q" className="acq-textarea" rows={4} value={lines(a.questions)} onChange={(e) => set<AssistantConfig>({ questions: toList(e.target.value) })} /></div>
        <div><label style={lbl} htmlFor="ag-priv">Your privacy policy link (optional)</label><input id="ag-priv" className="acq-input" placeholder="https://yourcompany.com/privacy" value={a.privacyUrl} onChange={(e) => set<AssistantConfig>({ privacyUrl: e.target.value })} /><p style={hint}>Shown under the chat box. Visitors are always told they are talking to an AI and that their messages are saved and shared with you. Without a link, RUNVAX&apos;s own privacy page is used.</p></div>
        <div><label style={lbl} htmlFor="ag-mail">Email new leads to</label><input id="ag-mail" className="acq-input" type="email" placeholder="Leave empty to use your account email" value={a.notifyEmail} onChange={(e) => set<AssistantConfig>({ notifyEmail: e.target.value })} /></div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 14 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={a.channels.web} onChange={(e) => set<AssistantConfig>({ channels: { ...a.channels, web: e.target.checked } })} /> Website chat</label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={a.channels.telegram} onChange={(e) => set<AssistantConfig>({ channels: { ...a.channels, telegram: e.target.checked } })} /> Telegram bot</label>
        </div>
      </>}

      <div><label style={lbl} htmlFor="ag-dom">Only work on these websites (optional, one per line)</label><textarea id="ag-dom" className="acq-textarea" rows={2} placeholder="yourcompany.com" value={lines(cfg.allowedDomains)} onChange={(e) => set({ allowedDomains: toList(e.target.value) })} /><p style={hint}>Leave empty to allow any site that has your embed code.</p></div>
    </div>
  );
}
