import { Mail, UserCheck, UserX } from 'lucide-react';
import type { Business } from '@/types';

/** One-line decision-maker summary for a search result. Renders nothing until a lookup has run. */
export default function DecisionMakerLine({ business, compact = false }: { business: Business; compact?: boolean }) {
  const dm = business.decisionMaker;
  if (dm) {
    const label = dm.source === 'manual' ? 'added by you' : `from ${dm.source}, unverified`;
    return (
      <div className={`flex items-center gap-1.5 ${compact ? 'text-[11px]' : 'text-xs'} text-purple-300 min-w-0`} title={`Decision-maker ${label}`}>
        <UserCheck className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">
          <span className="font-semibold">{dm.name}</span>
          {dm.title && <span className="text-purple-300/70"> · {dm.title}</span>}
        </span>
        {dm.email && <span title={`Their own email: ${dm.email}`} className="flex-shrink-0"><Mail className="w-3.5 h-3.5 text-green-400" /></span>}
      </div>
    );
  }
  if (!business.dmSearched) return null;
  return (
    <div className={`flex items-center gap-1.5 ${compact ? 'text-[11px]' : 'text-xs'} text-gray-600`} title="The website and public listings don't name an owner">
      <UserX className="w-3.5 h-3.5 flex-shrink-0" />
      <span>No decision-maker found</span>
    </div>
  );
}
