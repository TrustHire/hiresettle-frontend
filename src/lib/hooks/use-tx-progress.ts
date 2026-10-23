'use client';

/**
 * useTxProgress
 *
 * Manages the state that TxProgressModal needs.
 * Usage:
 *
 *   const { modalProps, onStatus, reset } = useTxProgress();
 *
 *   // open the modal and start the tx:
 *   await someContractFn(params, onStatus);
 *
 *   // pass modalProps directly to <TxProgressModal {...modalProps} />
 */

import { useCallback, useState } from 'react';
import { initialTxSteps, waitForConfirmation } from '@/lib/stellar/contract';
import type { TxStep, TxStepId, TxStepStatus, TxStatusEvent, OnStatusFn } from '@/lib/stellar/contract';

export interface TxProgressState {
  isOpen: boolean;
  steps: TxStep[];
  txHash: string | null;
  error: string | null;
  failedStep: TxStepId | null;
}

const INITIAL_STATE: TxProgressState = {
  isOpen: false,
  steps: initialTxSteps(),
  txHash: null,
  error: null,
  failedStep: null,
};

export function useTxProgress() {
  const [state, setState] = useState<TxProgressState>(INITIAL_STATE);

  /** Call this before starting a transaction to open the modal. */
  const open = useCallback(() => {
    setState({ ...INITIAL_STATE, isOpen: true, steps: initialTxSteps() });
  }, []);

  /** Reset back to closed/idle so the modal can be re-opened next time. */
  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  /**
   * Pass this as the `onStatus` argument to any contract write function.
   * It automatically opens the modal on the first event it receives.
   */
  const onStatus = useCallback<OnStatusFn>((event: TxStatusEvent) => {
    setState((prev) => {
      // Auto-open on the very first event (covers cases where open() wasn't
      // called explicitly before the async call kicked off).
      const isOpen = true;

      const steps = prev.steps.map((s): TxStep => {
        if (s.id !== event.step) return s;
        return { ...s, status: event.status };
      });

      const isError = event.status === 'error';
      const isPending = event.status === 'pending';

      return {
        isOpen,
        steps,
        txHash: event.txHash ?? prev.txHash,
        error: isError ? (event.error ?? 'Unknown error') : isPending ? null : prev.error,
        failedStep: isError ? event.step : isPending ? null : prev.failedStep,
      };
    });
  }, []);

  /**
   * Resume checking confirmation of a known transaction hash.
   * Can be called with a specific txHash or falls back to state.txHash.
   */
  const resumeCheck = useCallback(
    async (knownTxHash?: string): Promise<string | null> => {
      const hash = knownTxHash ?? state.txHash;
      if (!hash) return null;

      setState({
        isOpen: true,
        steps: [
          { id: 'simulating',         label: 'Simulating',         status: 'done' },
          { id: 'awaiting_signature', label: 'Awaiting signature', status: 'done' },
          { id: 'submitting',         label: 'Submitting',         status: 'done' },
          { id: 'confirming',         label: 'Confirming',         status: 'active' },
          { id: 'done',               label: 'Done',               status: 'idle' },
        ],
        txHash: hash,
        error: null,
        failedStep: null,
      });

      try {
        const res = await waitForConfirmation(hash, onStatus);
        return res;
      } catch (err: unknown) {
        console.warn('Resume check error:', err);
        return null;
      }
    },
    [state.txHash, onStatus],
  );

  return { state, open, reset, onStatus, resumeCheck };
}
