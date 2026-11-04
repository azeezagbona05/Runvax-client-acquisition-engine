import { TASK_STATE, AGENT_STATE } from './format';

export function TaskStateBadge({ state }: { state: string }) {
  const s = TASK_STATE[state] ?? { label: state, cls: 'bg-white/5 text-gray-400 border-white/10', hint: '' };
  return <span title={s.hint} className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${s.cls}`}>{s.label}</span>;
}

export function AgentStateBadge({ state }: { state: string }) {
  const s = AGENT_STATE[state] ?? { label: state, cls: 'bg-white/5 text-gray-400 border-white/10' };
  return <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${s.cls}`}>{s.label}</span>;
}
