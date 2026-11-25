'use client';

import { useEffect, useState } from 'react';
import { isFederationAddress, resolveFederationAddress } from '@/lib/stellar/federation';

const DEBOUNCE_MS = 500;

export interface FederatedAddressState {
  /** True when the input contains a federation address (name*domain.com). */
  isFederated: boolean;
  /** The resolved G… address, or null while pending / on failure. */
  resolved: string | null;
  resolving: boolean;
  error: string | null;
}

/**
 * Resolve a federation address typed into an address input. Raw G… keys are
 * passed through untouched (isFederated = false) so callers can validate them
 * as before.
 */
export function useFederatedAddress(input: string): FederatedAddressState {
  const value = input.trim();
  const isFederated = value.includes('*');

  const [state, setState] = useState<Omit<FederatedAddressState, 'isFederated'>>({
    resolved: null,
    resolving: false,
    error: null,
  });

  useEffect(() => {
    if (!isFederated) {
      setState({ resolved: null, resolving: false, error: null });
      return;
    }
    if (!isFederationAddress(value)) {
      setState({
        resolved: null,
        resolving: false,
        error: 'Federation addresses must look like name*domain.com.',
      });
      return;
    }

    let cancelled = false;
    setState({ resolved: null, resolving: true, error: null });
    const timer = setTimeout(() => {
      resolveFederationAddress(value)
        .then((resolved) => {
          if (!cancelled) setState({ resolved, resolving: false, error: null });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setState({
            resolved: null,
            resolving: false,
            error: err instanceof Error ? err.message : 'Federation lookup failed.',
          });
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, isFederated]);

  return { isFederated, ...state };
}
