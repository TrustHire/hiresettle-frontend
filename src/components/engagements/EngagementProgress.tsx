'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getEscrowBalance } from '@/lib/stellar/contract';
import { stroopsToUsdc, engagementProgress } from '@/lib/utils';
import { toReadableError } from '@/lib/utils/toast-error';
import type { Engagement } from '@/types';

interface Props {
  engagement: Engagement;
  onSync?: () => Promise<void>;
}

export function EngagementProgress({ engagement: e, onSync }: Props) {
  const progress     = engagementProgress(e.milestones);
  const totalUsdc    = stroopsToUsdc(e.totalAmount);
  const releasedUsdc = stroopsToUsdc(e.releasedAmount);
  const expectedInEscrow = (parseFloat(totalUsdc) - parseFloat(releasedUsdc)).toFixed(2);

  const [onChainUsdc, setOnChainUsdc]   = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const [syncing, setSyncing]           = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEscrowBalance(e.id)
      .then((stroops) => {
        if (!cancelled) setOnChainUsdc(stroopsToUsdc(stroops));
      })
      .catch(() => {
        if (!cancelled) setBalanceError(true);
      });
    return () => { cancelled = true; };
  }, [e.id, e.updatedAt]);

  // True when the on-chain balance differs from what the backend reports
  const isMismatch =
    onChainUsdc !== null &&
    parseFloat(onChainUsdc) !== parseFloat(expectedInEscrow);

  const handleResync = async () => {
    if (!onSync || syncing) return;
    setSyncing(true);
    try {
      await onSync();
      toast.success('Re-synced with chain');
    } catch (err) {
      toast.error(toReadableError(err));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Stat label="Total fee locked" value={totalUsdc}        color="text-gray-900" />
        <Stat label="Released"         value={releasedUsdc}     color="text-green-600" />
        <Stat label="In escrow"        value={expectedInEscrow} color="text-blue-600" />
      </div>

      {/* On-chain balance row */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-gray-50 border border-gray-100">
        <div className="flex-1">
          <p className="text-xs text-gray-400 mb-0.5">On-chain escrow balance</p>
          {balanceError ? (
            <p className="text-xs text-gray-400 italic">Could not fetch from contract</p>
          ) : onChainUsdc === null ? (
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Fetching…
            </p>
          ) : (
            <p className={`text-sm font-semibold ${isMismatch ? 'text-amber-600' : 'text-blue-600'}`}>
              {onChainUsdc} USDC
            </p>
          )}
        </div>

        {isMismatch && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
              <AlertTriangle className="w-3 h-3" />
              Out of sync
            </span>
            {onSync && (
              <button
                onClick={handleResync}
                disabled={syncing}
                className="btn-secondary text-xs"
                title="Re-sync backend with chain"
              >
                {syncing
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
                Re-sync
              </button>
            )}
          </div>
        )}
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
