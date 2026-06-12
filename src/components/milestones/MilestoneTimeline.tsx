'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle2, Clock, Lock, AlertTriangle,
  Upload, ThumbsUp, ThumbsDown, XCircle, Loader2,
  ExternalLink,
} from 'lucide-react';
import {
  unlockMilestone, submitProof, confirmMilestone,
  raiseDispute, resolveDispute,
} from '@/lib/stellar/contract';
import { milestonesApi } from '@/lib/api/services';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import {
  milestoneStatusBadge, milestoneStatusLabel,
  stroopsToUsdc, cn, formatRetentionCountdown, timerPillClass,
} from '@/lib/utils';
import type { Engagement, Milestone, MilestoneStatus, RetentionTimer } from '@/types';

interface Props {
  engagement: Engagement;
  userRole: string;
  onUpdate: () => void;
}

export function MilestoneTimeline({ engagement, userRole, onUpdate }: Props) {
  return (
    <div className="card divide-y divide-gray-50">
      {engagement.milestones.map((milestone, i) => (
        <MilestoneRow
          key={milestone.id}
          milestone={milestone}
          engagement={engagement}
          userRole={userRole}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

function MilestoneRow({
  milestone, engagement, userRole, onUpdate,
}: {
  milestone: Milestone;
  engagement: Engagement;
  userRole: string;
  onUpdate: () => void;
}) {
  const { address } = useAuthStore();
  const [loading, setLoading]             = useState(false);
  const [proofInput, setProofInput]       = useState('');
  const [showProofInput, setShowProofInput] = useState(false);
  const [timer, setTimer]                 = useState<RetentionTimer | null>(null);

  // Fetch retention timer for Locked milestones
  useEffect(() => {
    if (milestone.kind === 'Retention' && milestone.status === 'Locked') {
      milestonesApi.getTimer(engagement.id, milestone.milestoneIndex)
        .then(setTimer)
        .catch(() => {});
    }
  }, [milestone.id, milestone.status]);

  const isActive = engagement.status === 'Active' || engagement.status === 'ReplacementRequested';

  const statusIcon: Record<MilestoneStatus, JSX.Element> = {
    Locked:        <Lock className="w-4 h-4 text-gray-400" />,
    Pending:       <Clock className="w-4 h-4 text-sky-500" />,
    ProofSubmitted:<Upload className="w-4 h-4 text-amber-500" />,
    Confirmed:     <CheckCircle2 className="w-4 h-4 text-green-500" />,
    Disputed:      <AlertTriangle className="w-4 h-4 text-red-500" />,
    Resolved:      <CheckCircle2 className="w-4 h-4 text-purple-500" />,
  };

  const iconBg: Record<MilestoneStatus, string> = {
    Locked:        'bg-gray-50',
    Pending:       'bg-sky-50',
    ProofSubmitted:'bg-amber-50',
    Confirmed:     'bg-green-50',
    Disputed:      'bg-red-50',
    Resolved:      'bg-purple-50',
  };

  const totalUsdc     = parseFloat(stroopsToUsdc(engagement.totalAmount));
  const milestoneUsdc = ((totalUsdc * milestone.paymentPercent) / 100).toFixed(2);

  const wrap = async (fn: () => Promise<void>) => {
    if (!address || loading) return;
    setLoading(true);
    try { await fn(); onUpdate(); }
    catch (err: any) { alert(err?.message ?? 'Transaction failed'); }
    finally { setLoading(false); }
  };

  // Permissions
  const canUnlock = isActive && milestone.kind === 'Retention'
    && milestone.status === 'Locked' && timer?.unlockable;

  const canSubmitProof = isActive && milestone.status === 'Pending'
    && userRole === 'recruiter';

  const canConfirm = isActive && milestone.status === 'ProofSubmitted'
    && userRole === 'company';

  const canDispute = isActive && milestone.status === 'ProofSubmitted'
    && userRole === 'company';

  const canResolve = isActive && milestone.status === 'Disputed'
    && userRole === 'arbiter';

  return (
    <div className="p-5">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', iconBg[milestone.status])}>
          {statusIcon[milestone.status]}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-medium text-gray-900">{milestone.name}</span>
            <span className={milestoneStatusBadge(milestone.status)}>
              {milestoneStatusLabel(milestone.status)}
            </span>
            {milestone.kind === 'Retention' && (
              <span className="badge bg-amber-50 text-amber-700 text-[10px]">
                Retention
              </span>
            )}
          </div>

          <p className="text-xs text-gray-400 mb-2">
            {milestone.paymentPercent}% — <span className="font-medium text-gray-600">${milestoneUsdc} USDC</span>
          </p>

          {/* Retention timer */}
          {milestone.kind === 'Retention' && milestone.status === 'Locked' && timer && (
            <div className={cn(timerPillClass(timer.daysRemaining, timer.unlockable), 'mb-2')}>
              <Clock className="w-3 h-3" />
              {timer.unlockable
                ? 'Ready to unlock'
                : formatRetentionCountdown(timer.daysRemaining)
              }
            </div>
          )}

          {/* Proof hash */}
          {milestone.proofHash && (
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs text-gray-400">Proof:</span>
              <a
                href={milestone.proofHash.startsWith('ipfs://')
                  ? `https://ipfs.io/ipfs/${milestone.proofHash.replace('ipfs://', '')}`
                  : milestone.proofHash}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-brand-600 hover:underline font-mono truncate max-w-xs flex items-center gap-1"
              >
                {milestone.proofHash}
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            </div>
          )}

          {/* Payment released */}
          {milestone.paymentReleased && (
            <p className="text-xs text-green-600 font-medium mb-2">
              ✓ ${stroopsToUsdc(milestone.paymentReleased)} USDC released
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-3">
            {loading && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Waiting for Freighter…
              </div>
            )}

            {/* Unlock */}
            {canUnlock && !loading && (
              <button
                onClick={() => wrap(() => unlockMilestone({
                  callerAddress: address!,
                  engagementId: engagement.id,
                  milestoneIndex: milestone.milestoneIndex,
                }))}
                className="btn-primary text-xs"
              >
                <Lock className="w-3.5 h-3.5" />
                Unlock milestone
              </button>
            )}

            {/* Submit proof */}
            {canSubmitProof && !loading && (
              showProofInput ? (
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="text"
                    placeholder="ipfs://Qm... or https://..."
                    value={proofInput}
                    onChange={(e) => setProofInput(e.target.value)}
                    className="input flex-1 text-xs"
                    onKeyDown={(e) => e.key === 'Enter' && wrap(() => {
                      if (!proofInput.trim()) throw new Error('Enter a proof hash');
                      return submitProof({
                        callerAddress: address!,
                        engagementId: engagement.id,
                        milestoneIndex: milestone.milestoneIndex,
                        proofHash: proofInput.trim(),
                      }).then(() => { setShowProofInput(false); setProofInput(''); });
                    })}
                  />
                  <button
                    onClick={() => wrap(async () => {
                      if (!proofInput.trim()) throw new Error('Enter a proof hash');
                      await submitProof({
                        callerAddress: address!,
                        engagementId: engagement.id,
                        milestoneIndex: milestone.milestoneIndex,
                        proofHash: proofInput.trim(),
                      });
                      setShowProofInput(false);
                      setProofInput('');
                    })}
                    className="btn-primary text-xs"
                  >
                    Submit
                  </button>
                  <button onClick={() => setShowProofInput(false)} className="btn-ghost text-xs">
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowProofInput(true)} className="btn-secondary text-xs">
                  <Upload className="w-3.5 h-3.5" />
                  Submit proof
                </button>
              )
            )}

            {/* Confirm / Dispute (company) */}
            {!loading && (
              <>
                {canConfirm && (
                  <button onClick={() => wrap(() => confirmMilestone({
                    callerAddress: address!,
                    engagementId: engagement.id,
                    milestoneIndex: milestone.milestoneIndex,
                  }))} className="btn-primary text-xs">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    Confirm & release
                  </button>
                )}
                {canDispute && (
                  <button onClick={() => wrap(() => raiseDispute({
                    callerAddress: address!,
                    engagementId: engagement.id,
                    milestoneIndex: milestone.milestoneIndex,
                  }))} className="btn-danger text-xs">
                    <XCircle className="w-3.5 h-3.5" />
                    Dispute
                  </button>
                )}
              </>
            )}

            {/* Resolve dispute (arbiter) */}
            {canResolve && !loading && (
              <>
                <button onClick={() => wrap(() => resolveDispute({
                  callerAddress: address!,
                  engagementId: engagement.id,
                  milestoneIndex: milestone.milestoneIndex,
                  approve: true,
                }))} className="btn-primary text-xs">
                  <ThumbsUp className="w-3.5 h-3.5" />
                  Approve — release payment
                </button>
                <button onClick={() => wrap(() => resolveDispute({
                  callerAddress: address!,
                  engagementId: engagement.id,
                  milestoneIndex: milestone.milestoneIndex,
                  approve: false,
                }))} className="btn-danger text-xs">
                  <ThumbsDown className="w-3.5 h-3.5" />
                  Reject — reset proof
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
