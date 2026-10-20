'use client';

/**
 * TxProgressModal
 *
 * A blocking modal that shows the five steps of every Soroban transaction:
 *   Simulating → Awaiting signature → Submitting → Confirming → Done
 *
 * On success it shows the tx hash with a Stellar Expert explorer link.
 * On failure it highlights the step that failed with the error message and
 * offers a retry button.
 * On timeout it shows a "still pending" warning with an explorer link and
 * offers a "Resume checking" button so users do not double-submit.
 *
 * Props come from useTxProgress().state — just spread the returned `state`
 * object and add onClose / onRetry / onResumeCheck callbacks.
 */

import { useState } from 'react';
import { CheckCircle2, Circle, Clock, ExternalLink, Loader2, RefreshCw, XCircle } from 'lucide-react';
import type { TxStep, TxStepId, TxStepStatus } from '@/lib/stellar/contract';

export interface TxProgressModalProps {
  isOpen: boolean;
  steps: TxStep[];
  txHash: string | null;
  error: string | null;
  failedStep: TxStepId | null;
  /** Called when the user closes a completed or failed modal. */
  onClose: () => void;
  /**
   * Called when the user clicks "Retry". The parent is responsible for
   * re-running the transaction and calling open() + onStatus again.
   */
  onRetry?: () => void;
  /**
   * Called when the user clicks "Resume checking" on a pending tx.
   */
  onResumeCheck?: (txHash: string) => void;
}

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------

const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';

function explorerUrl(txHash: string): string {
  const net = NETWORK === 'mainnet' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${net}/tx/${txHash}`;
}

function stepIcon(status: TxStepStatus, isError: boolean) {
  if (isError) {
    return <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" aria-hidden="true" />;
  }
  switch (status) {
    case 'done':
      return <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" aria-hidden="true" />;
    case 'active':
      return <Loader2 className="w-5 h-5 text-brand-500 animate-spin flex-shrink-0" aria-hidden="true" />;
    case 'pending':
      return <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" aria-hidden="true" />;
    default:
      return <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" aria-hidden="true" />;
  }
}

function stepTextClass(status: TxStepStatus, isError: boolean): string {
  if (isError)             return 'text-red-600 font-medium';
  if (status === 'done')    return 'text-gray-900 font-medium';
  if (status === 'active')  return 'text-brand-700 font-semibold';
  if (status === 'pending') return 'text-amber-700 font-medium';
  return 'text-gray-400';
}

// ----------------------------------------------------------
// Component
// ----------------------------------------------------------

export function TxProgressModal({
  isOpen,
  steps,
  txHash,
  error,
  failedStep,
  onClose,
  onRetry,
  onResumeCheck,
}: TxProgressModalProps) {
  const [customHash, setCustomHash] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  if (!isOpen) return null;

  const isDone = steps.find((s) => s.id === 'done')?.status === 'done';
  const isPending = steps.find((s) => s.id === 'confirming')?.status === 'pending';
  const isFailed = failedStep !== null && !isPending;
  const isActive = !isDone && !isFailed && !isPending;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Transaction progress"
    >
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {isDone
              ? 'Transaction confirmed'
              : isPending
                ? 'Transaction still pending'
                : isFailed
                  ? 'Transaction failed'
                  : 'Processing transaction…'}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {isDone
              ? 'Your transaction has been confirmed on Stellar.'
              : isPending
                ? 'Your transaction was submitted, but is taking longer than usual to confirm.'
                : isFailed
                  ? 'The transaction could not be completed.'
                  : 'Please keep this window open. This can take up to 2 minutes.'}
          </p>
        </div>

        {/* Steps list */}
        <ol className="px-6 py-5 space-y-4" aria-label="Transaction steps">
          {steps.map((step) => {
            const isStepError = step.id === failedStep && !isPending;
            return (
              <li key={step.id} className="flex items-center gap-3">
                {stepIcon(step.status, isStepError)}
                <span className={`text-sm ${stepTextClass(step.status, isStepError)}`}>
                  {step.label}
                </span>
                {step.status === 'active' && (
                  <span className="ml-auto text-xs text-gray-400 animate-pulse">
                    In progress…
                  </span>
                )}
                {step.status === 'pending' && (
                  <span className="ml-auto text-xs text-amber-600 font-medium">
                    Still pending…
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {/* Still pending notice */}
        {isPending && (
          <div
            role="status"
            className="mx-6 mb-4 rounded-xl bg-amber-50 border border-amber-200/80 p-4 text-xs text-amber-900"
          >
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-900">Network congestion detected</p>
                <p className="mt-1 text-amber-800 leading-relaxed">
                  Your transaction was submitted to Stellar, but confirmation is delayed.
                  Please do not retry or resubmit this action, as it may result in duplicate transactions.
                </p>
                {txHash && (
                  <div className="mt-2.5 pt-2 border-t border-amber-200/60 flex items-center justify-between gap-2">
                    <span className="text-amber-700">Live network status:</span>
                    <a
                      href={explorerUrl(txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-brand-700 hover:text-brand-800 underline inline-flex items-center gap-1"
                    >
                      View on Stellar Expert
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tx hash (shown once submitted) */}
        {txHash && (
          <div className="mx-6 mb-4 flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 text-xs">
            <span className="text-gray-500 flex-shrink-0">Tx hash:</span>
            <span className="font-mono text-gray-700 truncate min-w-0">
              {txHash}
            </span>
            <a
              href={explorerUrl(txHash)}
              target="_blank"
              rel="noreferrer"
              className="flex-shrink-0 text-brand-600 hover:text-brand-700 transition-colors"
              aria-label="View transaction on Stellar Expert"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Error detail */}
        {isFailed && error && (
          <div
            role="alert"
            className="mx-6 mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-xs text-red-700"
          >
            <p className="font-medium mb-0.5">Error</p>
            <p className="break-words">{error}</p>
          </div>
        )}

        {/* Footer actions */}
        <div className="px-6 pb-6 flex items-center justify-between gap-3 flex-wrap">
          <div>
            {isPending && onResumeCheck && !showCustomInput && (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Check another tx hash
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {isFailed && onRetry && (
              <button
                onClick={onRetry}
                className="btn-primary text-sm"
              >
                Retry
              </button>
            )}

            {isPending && onResumeCheck && txHash && !showCustomInput && (
              <button
                onClick={() => onResumeCheck(txHash)}
                className="btn-primary text-sm inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                Resume checking
              </button>
            )}

            {(isDone || isFailed || isPending) && (
              <button
                onClick={onClose}
                className={isDone ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
              >
                {isDone ? 'Done' : 'Close'}
              </button>
            )}

            {isActive && (
              <p className="text-xs text-gray-400 self-center">
                Do not close this window
              </p>
            )}
          </div>
        </div>

        {/* Custom tx hash input for resuming */}
        {showCustomInput && onResumeCheck && (
          <div className="px-6 pb-6 pt-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs font-medium text-gray-700 mb-2">Resume checking a known tx hash</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Enter transaction hash…"
                value={customHash}
                onChange={(e) => setCustomHash(e.target.value)}
                className="input text-xs py-2"
              />
              <button
                onClick={() => {
                  if (customHash.trim()) {
                    onResumeCheck(customHash.trim());
                    setShowCustomInput(false);
                  }
                }}
                disabled={!customHash.trim()}
                className="btn-primary text-xs py-2 px-3 whitespace-nowrap"
              >
                Check
              </button>
              <button
                onClick={() => setShowCustomInput(false)}
                className="btn-ghost text-xs py-2 px-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
