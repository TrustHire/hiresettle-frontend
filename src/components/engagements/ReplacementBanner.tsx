'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { requestReplacement } from '@/lib/stellar/contract';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import type { Engagement } from '@/types';

interface Props {
  engagement: Engagement;
  userRole: string;
  onUpdate: () => void;
}

export function ReplacementBanner({ engagement, userRole, onUpdate }: Props) {
  const { address } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleRequestReplacement = async () => {
    if (!address || loading) return;
    setLoading(true);
    try {
      await requestReplacement({ callerAddress: address, engagementId: engagement.id });
      onUpdate();
    } catch (err: any) {
      alert(err?.message ?? 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-3">
      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-800 mb-1">
          Replacement candidate requested
        </p>
        <p className="text-xs text-amber-700 leading-relaxed">
          The placed candidate left before the 90-day retention period. The placement milestone has been reset.
          {userRole === 'recruiter'
            ? ' Submit proof for your replacement candidate when ready.'
            : ' Waiting for the recruiter to submit proof for a replacement candidate.'}
        </p>
        {userRole === 'company' && engagement.status === 'Active' && (
          <button
            onClick={handleRequestReplacement}
            disabled={loading}
            className="btn-secondary text-xs mt-3"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            Request replacement
          </button>
        )}
      </div>
    </div>
  );
}
