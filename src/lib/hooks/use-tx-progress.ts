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
import { initialTxSteps } from '@/lib/stellar/contract';
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

      return {
        isOpen,
        steps,
        txHash: event.txHash ?? prev.txHash,
        error: event.status === 'error' ? (event.error ?? 'Unknown error') : prev.error,
        failedStep: event.status === 'error' ? event.step : prev.failedStep,
      };
    });
  }, []);

  return { state, open, reset, onStatus };
}
