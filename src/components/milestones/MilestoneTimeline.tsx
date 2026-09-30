'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle2, Clock, Lock, AlertTriangle,
  Upload, ThumbsUp, ThumbsDown, XCircle, Loader2,
  ExternalLink, Copy, Check, CalendarPlus, Download, ChevronDown,
} from 'lucide-react';
import {
  unlockMilestone, submitProof, confirmMilestone,
  raiseDispute, resolveDispute,
} from '@/lib/stellar/contract';
import { TxProgressModal } from '@/components/ui/TxProgressModal';
import { useTxProgress } from '@/lib/hooks/use-tx-progress';
import { milestonesApi } from '@/lib/api/services';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import {
  milestoneStatusBadge, milestoneStatusLabel,
  stroopsToUsdc, cn, formatRetentionCountdown, formatLiveCountdown, timerPillClass,
} from '@/lib/utils';
import { toast } from 'sonner';
import { toReadableError } from '@/lib/utils/toast-error';
import { downloadIcs, googleCalendarUrl } from '@/lib/utils/calendar';
import type { Engagement, Milestone, MilestoneStatus, RetentionTimer } from '@/types';
import { ProofSubmitForm } from './ProofSubmitForm';

interface Props {
  engagement: Engagement;
  userRole: string;
  onUpdate: () => void;
}

export function MilestoneTimeline({ engagement, userRole, onUpdate }: Props) {
  return (
    <div className="card divide-y divide-gray-50">
      {engagement.milestones.map((milestone) => (
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

const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? 'https://ipfs.io';

/** Returns true for bare CIDs (Qm… v0 or bafy… v1) and ipfs:// URIs. */
function isIpfs(hash: string): boolean {
  return (
    hash.startsWith('ipfs://') ||
    /^Qm[1-9A-HJ-NP-Za-km-z]{44,}/.test(hash) ||
    /^bafy[a-z2-7]{52,}/.test(hash)
  );
}

function resolveProofUrl(hash: string): string {
  if (hash.startsWith('ipfs://')) {
    return `${IPFS_GATEWAY}/ipfs/${hash.slice(7)}`;
  }
  if (isIpfs(hash)) {
    return `${IPFS_GATEWAY}/ipfs/${hash}`;
  }
  return hash;
}

function ProofLink({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [hash]);

  const url = resolveProofUrl(hash);
  const label = hash.length > 40 ? `${hash.slice(0, 20)}…${hash.slice(-6)}` : hash;

  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className="text-xs text-gray-400">Proof:</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={hash}
        className="text-xs text-brand-600 hover:underline font-mono truncate max-w-xs flex items-center gap-1"
      >
        {label}
        <ExternalLink className="w-3 h-3 flex-shrink-0" />
      </a>
      <button
        onClick={copy}
        title="Copy raw hash"
        className="text-gray-400 hover:text-gray-600 transition-colors"
      >
        {copied
          ? <Check className="w-3.5 h-3.5 text-green-500" />
          : <Copy className="w-3.5 h-3.5" />
        }
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add to Calendar
// ---------------------------------------------------------------------------

/** Format a Date as a compact iCalendar datetime string: 20250601T090000Z */
function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function buildIcs({
  title, description, url, start,
}: { title: string; description: string; url: string; start: Date }): string {
  const end = new Date(start.getTime() + 60 * 60 * 1000); // 1-hour block
  const now = icsDate(new Date());
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HireSettle//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}`,
    `DTSTAMP:${now}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function buildGoogleUrl({
  title, description, url, start,
}: { title: string; description: string; url: string; start: Date }): string {
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `${description}\n\n${url}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function AddToCalendar({
  unlockAt, milestoneName, jobTitle, engagementId,
}: {
  unlockAt: Date;
  milestoneName: string;
  jobTitle: string;
  engagementId: string;
}) {
  const [open, setOpen] = useState(false);

  const engagementUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard/engagements/${engagementId}`
      : `/dashboard/engagements/${engagementId}`;

  const title = `Retention unlock: ${milestoneName} — ${jobTitle}`;
  const description = `The retention milestone "${milestoneName}" for "${jobTitle}" is estimated to unlock on this date.\n\nEngagement: ${engagementUrl}`;
  const calParams = { title, description, url: engagementUrl, start: unlockAt };

  const downloadIcs = () => {
    const blob = new Blob([buildIcs(calParams)], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `retention-unlock-${engagementId}.ics`;
    link.click();
    URL.revokeObjectURL(link.href);
    setOpen(false);
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-brand-600 transition-colors"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <CalendarPlus className="w-3.5 h-3.5" />
        Add to calendar
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-md py-1 min-w-[170px]">
            <button
              onClick={downloadIcs}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              <Download className="w-3.5 h-3.5 text-gray-400" />
              Download .ics
            </button>
            <a
              href={buildGoogleUrl(calParams)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
              Google Calendar
            </a>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live countdown hook
// ---------------------------------------------------------------------------

/**
 * Drives a ticking countdown toward `estimatedUnlockAt`.
 * - Ticks every 60 s while >= 1 h remains
 * - Switches to every 1 s in the last hour
 * - Calls `onExpired` once when the local clock passes zero so the parent
 *   can refetch the timer and surface the Unlock button without a reload
 */
function useRetentionCountdown(
  estimatedUnlockAt: string | null,
  onExpired: () => void,
): { msRemaining: number; label: string } {
  const getMs = useCallback(
    () => estimatedUnlockAt
      ? Math.max(0, new Date(estimatedUnlockAt).getTime() - Date.now())
      : -1,
    [estimatedUnlockAt],
  );

  const [msRemaining, setMsRemaining] = useState<number>(getMs);

  useEffect(() => {
    if (!estimatedUnlockAt) return;

    let expired = false;

    const tick = () => {
      const ms = getMs();
      setMsRemaining(ms);
      if (ms <= 0 && !expired) {
        expired = true;
        onExpired();
      }
    };

    // Pick interval: <1 h → every second, otherwise every minute
    const intervalMs = msRemaining > 0 && msRemaining < 3600_000 ? 1_000 : 60_000;
    const id = setInterval(tick, intervalMs);

    return () => clearInterval(id);
  // Re-run when we cross the 1-hour threshold (msRemaining bucket changes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimatedUnlockAt, msRemaining < 3600_000]);

  const label = msRemaining < 0
    ? formatRetentionCountdown(0)          // no date — fall back to static
    : msRemaining >= 48 * 3600_000
      ? formatRetentionCountdown(Math.ceil(msRemaining / 86400_000))  // coarse days
      : formatLiveCountdown(msRemaining);

  return { msRemaining, label };
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
  const [loading, setLoading]               = useState(false);
  const [proofInput, setProofInput]         = useState('');
  const [showProofInput, setShowProofInput] = useState(false);
  const [timer, setTimer]                   = useState<RetentionTimer | null>(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason]       = useState('');

  // tx progress modal
  const { state: txState, open: openTx, reset: resetTx, onStatus } = useTxProgress();

  // Store the last action so Retry can replay it
  const retryFnRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (milestone.kind === 'Retention' && milestone.status === 'Locked') {
      milestonesApi.getTimer(engagement.id, milestone.milestoneIndex)
        .then(setTimer)
        .catch(() => {});
    }
  }, [engagement.id, milestone.id, milestone.kind, milestone.milestoneIndex, milestone.status]);

  const isActive = engagement.status === 'Active' || engagement.status === 'ReplacementRequested';

  const statusIcon: Record<MilestoneStatus, JSX.Element> = {
    Locked:         <Lock className="w-4 h-4 text-gray-400" />,
    Pending:        <Clock className="w-4 h-4 text-sky-500" />,
    ProofSubmitted: <Upload className="w-4 h-4 text-amber-500" />,
    Confirmed:      <CheckCircle2 className="w-4 h-4 text-green-500" />,
    Disputed:       <AlertTriangle className="w-4 h-4 text-red-500" />,
    Resolved:       <CheckCircle2 className="w-4 h-4 text-purple-500" />,
  };

  const iconBg: Record<MilestoneStatus, string> = {
    Locked:         'bg-gray-50',
    Pending:        'bg-sky-50',
    ProofSubmitted: 'bg-amber-50',
    Confirmed:      'bg-green-50',
    Disputed:       'bg-red-50',
    Resolved:       'bg-purple-50',
  };

  const totalUsdc     = parseFloat(stroopsToUsdc(engagement.totalAmount));
  const milestoneUsdc = ((totalUsdc * milestone.paymentPercent) / 100).toFixed(2);

  /**
   * Wraps a contract call:
   *  1. Opens the progress modal
   *  2. Stores the action in retryFnRef for Retry support
   *  3. Calls the action with onStatus wired up
   *  4. On success calls onUpdate(); modal stays open until user dismisses
   *  5. On error the modal shows the failed step — no alert()
   */
  const wrap = useCallback(async (fn: () => Promise<void>) => {
    if (!address || loading) return;
    retryFnRef.current = fn;
    openTx();
    setLoading(true);
    try {
      await fn();
      onUpdate();
    } catch {
      // Error state is already reflected in the modal via onStatus events.
      // No alert() needed.
    } finally {
      setLoading(false);
    }
  }, [address, loading, openTx, onUpdate]);

  const handleRetry = useCallback(() => {
    if (retryFnRef.current) wrap(retryFnRef.current);
  }, [wrap]);

  const canUnlock      = isActive && milestone.kind === 'Retention'
    && milestone.status === 'Locked' && timer?.unlockable;
  const canSubmitProof = isActive && milestone.status === 'Pending' && userRole === 'recruiter';
  const canConfirm     = isActive && milestone.status === 'ProofSubmitted' && userRole === 'company';
  const canDispute     = isActive && milestone.status === 'ProofSubmitted' && userRole === 'company';
  const canResolve     = isActive && milestone.status === 'Disputed' && userRole === 'arbiter';

  return (
    <>
      {/* Transaction progress modal — rendered outside the row layout flow */}
      <TxProgressModal
        {...txState}
        onClose={resetTx}
        onRetry={handleRetry}
      />

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

            {/* Dispute reason (visible to arbiter and recruiter) */}
            {milestone.status === 'Disputed' && milestone.disputeReason
              && (userRole === 'arbiter' || userRole === 'recruiter') && (
              <div className="mb-2 rounded-md border border-red-100 bg-red-50 p-2">
                <p className="text-xs font-medium text-red-700 mb-0.5">Dispute reason</p>
                <p className="text-xs text-red-800 whitespace-pre-wrap">{milestone.disputeReason}</p>
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
                  Processing…
                </div>
              )}

              {/* Unlock */}
              {canUnlock && !loading && (
                <button
                  onClick={() => wrap(() => unlockMilestone({
                    callerAddress: address!,
                    engagementId: engagement.id,
                    milestoneIndex: milestone.milestoneIndex,
                  }, onStatus))}
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
                      onKeyDown={(e) => e.key === 'Enter' && wrap(async () => {
                        if (!proofInput.trim()) throw new Error('Enter a proof hash');
                        await submitProof({
                          callerAddress: address!,
                          engagementId: engagement.id,
                          milestoneIndex: milestone.milestoneIndex,
                          proofHash: proofInput.trim(),
                        }, onStatus);
                        setShowProofInput(false);
                        setProofInput('');
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
                        }, onStatus);
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
                    <button
                      onClick={() => wrap(() => confirmMilestone({
                        callerAddress: address!,
                        engagementId: engagement.id,
                        milestoneIndex: milestone.milestoneIndex,
                      }, onStatus))}
                      className="btn-primary text-xs"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      Confirm & release
                    </button>
                  )}
                  {canDispute && (
                    <button
                      onClick={() => setShowDisputeModal(true)}
                      className="btn-danger text-xs"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Dispute
                    </button>
                  )}
                </>
              )}

              {/* Resolve dispute (arbiter) */}
              {canResolve && !loading && (
                <>
                  <button
                    onClick={() => wrap(() => resolveDispute({
                      callerAddress: address!,
                      engagementId: engagement.id,
                      milestoneIndex: milestone.milestoneIndex,
                      approve: true,
                    }, onStatus))}
                    className="btn-primary text-xs"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    Approve — release payment
                  </button>
                  <button
                    onClick={() => wrap(() => resolveDispute({
                      callerAddress: address!,
                      engagementId: engagement.id,
                      milestoneIndex: milestone.milestoneIndex,
                      approve: false,
                    }, onStatus))}
                    className="btn-danger text-xs"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    Reject — reset proof
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Dispute milestone</h3>
            <p className="text-xs text-gray-500 mb-3">
              Explain why you are disputing &ldquo;{milestone.name}&rdquo;. The arbiter and recruiter will see this.
            </p>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              rows={4}
              required
              minLength={MIN_DISPUTE_REASON}
              placeholder="Describe the issue with the submitted proof…"
              className="input w-full text-xs"
            />
            <p className={cn(
              'text-xs mt-1',
              disputeReason.trim().length < MIN_DISPUTE_REASON ? 'text-gray-400' : 'text-green-600',
            )}>
              {disputeReason.trim().length}/{MIN_DISPUTE_REASON} characters minimum
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowDisputeModal(false)} className="btn-ghost text-xs">
                Cancel
              </button>
              <button
                disabled={disputeReason.trim().length < MIN_DISPUTE_REASON}
                onClick={() => {
                  const reason = disputeReason.trim();
                  setShowDisputeModal(false);
                  wrap(async () => {
                    await raiseDispute({
                      callerAddress: address!,
                      engagementId: engagement.id,
                      milestoneIndex: milestone.milestoneIndex,
                    }, onStatus);
                    await milestonesApi.submitDisputeReason(engagement.id, milestone.milestoneIndex, reason);
                    setDisputeReason('');
                  });
                }}
                className="btn-danger text-xs disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                Raise dispute
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const MIN_DISPUTE_REASON = 20;

// ---------------------------------------------------------------------------
// CalendarMenu — dropdown for adding a retention unlock reminder
// ---------------------------------------------------------------------------

interface CalendarMenuProps {
  unlockDate: Date;
  title: string;
  description: string;
  engagementId: string;
}

function CalendarMenu({ unlockDate, title, description, engagementId }: CalendarMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const detailUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard/engagements/${engagementId}`
      : '';

  const calEvent = {
    title,
    description,
    startDate: unlockDate,
    durationMinutes: 60,
    url: detailUrl,
  };

  const handleDownload = () => {
    downloadIcs(calEvent);
    setOpen(false);
  };

  const handleGoogle = () => {
    window.open(googleCalendarUrl(calEvent), '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost text-xs flex items-center gap-1.5"
        title="Add to calendar"
      >
        <CalendarPlus className="w-3.5 h-3.5" />
        Add to calendar
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 w-48 rounded-xl bg-white border border-gray-100 shadow-lg py-1">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-gray-400" />
            Download .ics file
          </button>
          <button
            onClick={handleGoogle}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Chrome className="w-3.5 h-3.5 text-gray-400" />
            Google Calendar
          </button>
        </div>
      )}
    </div>
  );
}
