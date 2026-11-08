import AgentManage from '@/components/acq/agents/AgentManage';

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  return <AgentManage id={(await params).id} />;
}
