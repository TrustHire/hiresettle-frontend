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
 *
 * Props come from useTxProgress().state — just spread the returned `state`
 * object and add onClose / onRetry callbacks.
 */

import { CheckCircle2, Circle, ExternalLink, Loader2, XCircle } from 'lucide-react';
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
    default:
      return <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" aria-hidden="true" />;
  }
}

function stepTextClass(status: TxStepStatus, isError: boolean): string {
  if (isError)        return 'text-red-600 font-medium';
  if (status === 'done')   return 'text-gray-900 font-medium';
  if (status === 'active') return 'text-brand-700 font-semibold';
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
}: TxProgressModalProps) {
  if (!isOpen) return null;

  const isDone  = steps.find((s) => s.id === 'done')?.status === 'done';
  const isFailed = failedStep !== null;
  const isActive = !isDone && !isFailed;

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
            {isDone ? 'Transaction confirmed' : isFailed ? 'Transaction failed' : 'Processing transaction…'}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {isDone
              ? 'Your transaction has been confirmed on Stellar.'
              : isFailed
                ? 'The transaction could not be completed.'
                : 'Please keep this window open. This can take up to 40 seconds.'}
          </p>
        </div>

        {/* Steps list */}
        <ol className="px-6 py-5 space-y-4" aria-label="Transaction steps">
          {steps.map((step) => {
            const isStepError = step.id === failedStep;
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
              </li>
            );
          })}
        </ol>

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
        <div className="px-6 pb-6 flex justify-end gap-3">
          {isFailed && onRetry && (
            <button
              onClick={onRetry}
              className="btn-primary text-sm"
            >
              Retry
            </button>
          )}
          {/* Show Close only when terminal (done or failed). While active the
              user should not be able to dismiss accidentally. */}
          {(isDone || isFailed) && (
            <button
              onClick={onClose}
              className={isFailed ? 'btn-ghost text-sm' : 'btn-primary text-sm'}
            >
              {isDone ? 'Done' : 'Close'}
            </button>
          )}
          {/* Non-dismissable spinner state — no buttons while active */}
          {isActive && (
            <p className="text-xs text-gray-400 self-center">
              Do not close this window
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
