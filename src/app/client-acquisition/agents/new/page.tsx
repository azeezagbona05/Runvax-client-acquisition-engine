import AgentBuilder from '@/components/acq/agents/AgentBuilder';

export default function NewAgentPage() {
  return (
    <div className="acq-stack">
      <div style={{ paddingTop: 4 }}>
        <h1 className="acq-page-title">Build an agent</h1>
        <p className="acq-sub" style={{ marginTop: 2, maxWidth: 720 }}>Describe what you need and RUNVAX builds the agent, or fill it in yourself. Then deploy it to your website, WordPress, Telegram and more.</p>
      </div>
      <AgentBuilder />
    </div>
  );
}
