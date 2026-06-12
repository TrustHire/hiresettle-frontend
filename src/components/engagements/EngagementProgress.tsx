// components/engagements/EngagementProgress.tsx
import { stroopsToUsdc, engagementProgress } from '@/lib/utils';
import type { Engagement } from '@/types';

export function EngagementProgress({ engagement: e }: { engagement: Engagement }) {
  const progress     = engagementProgress(e.milestones);
  const totalUsdc    = stroopsToUsdc(e.totalAmount);
  const releasedUsdc = stroopsToUsdc(e.releasedAmount);
  const remaining    = (parseFloat(totalUsdc) - parseFloat(releasedUsdc)).toFixed(2);

  return (
    <div className="card p-5">
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Stat label="Total fee locked" value={`$${totalUsdc}`} color="text-gray-900" />
        <Stat label="Released"         value={`$${releasedUsdc}`} color="text-green-600" />
        <Stat label="In escrow"        value={`$${remaining}`}    color="text-blue-600" />
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 mb-1.5">
        <div
          className="bg-brand-600 h-2 rounded-full transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-gray-400">{progress}% complete</p>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400">USDC</p>
    </div>
  );
}
