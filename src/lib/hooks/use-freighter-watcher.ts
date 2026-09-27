'use client';

/**
 * useFreighterWatcher
 *
 * Watches Freighter for network and account changes, then surfaces two
 * boolean flags that the UI can react to:
 *
 *   networkMismatch  – Freighter is on a different network from NEXT_PUBLIC_STELLAR_NETWORK
 *   accountMismatch  – Freighter's active address differs from the authenticated address
 *
 * The hook also exposes the raw Freighter values for display purposes, and a
 * `dismiss` helper so the account-mismatch prompt can be cleared after the
 * user chooses to log out or ignore.
 */

import { useEffect, useRef, useState } from 'react';
import { watchWallet, normalizeNetwork, isFreighterInstalled } from '@/lib/stellar/freighter';
import { useAuthStore } from '@/lib/hooks/use-auth-store';

export interface FreighterWatcherState {
  /** True when Freighter's network doesn't match NEXT_PUBLIC_STELLAR_NETWORK */
  networkMismatch: boolean;
  /** True when Freighter's active address differs from the logged-in address */
  accountMismatch: boolean;
  /** The network Freighter is currently reporting */
  freighterNetwork: string | null;
  /** The address Freighter is currently reporting */
  freighterAddress: string | null;
  /** The expected app network (from env) */
  appNetwork: string;
  /** Dismiss the account-mismatch prompt (e.g. after logging out) */
  dismissAccountMismatch: () => void;
}

export function useFreighterWatcher(): FreighterWatcherState {
  const appNetwork = normalizeNetwork(
    process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet',
  );

  const authAddress = useAuthStore((s) => s.address);
  const isConnected = useAuthStore((s) => s.isConnected);

  const [freighterNetwork, setFreighterNetwork] = useState<string | null>(null);
  const [freighterAddress, setFreighterAddress] = useState<string | null>(null);
  const [accountMismatchDismissed, setAccountMismatchDismissed] = useState(false);

  // Reset the dismiss flag whenever the auth address changes (new login).
  const prevAuthAddress = useRef(authAddress);
  useEffect(() => {
    if (authAddress !== prevAuthAddress.current) {
      setAccountMismatchDismissed(false);
      prevAuthAddress.current = authAddress;
    }
  }, [authAddress]);

  useEffect(() => {
    // Use a ref so the cleanup function can always reach the stop handle,
    // even if the component unmounts before the isFreighterInstalled promise
    // resolves (avoids the async cleanup race).
    const stopRef = { current: undefined as (() => void) | undefined };
    let cancelled = false;

    isFreighterInstalled().then((installed) => {
      if (cancelled || !installed) return;
      stopRef.current = watchWallet((address, network) => {
        setFreighterAddress(address);
        setFreighterNetwork(network); // already normalised inside watchWallet
      });
    });

    return () => {
      cancelled = true;
      stopRef.current?.();
    };
  }, []);

  const networkMismatch =
    freighterNetwork !== null && freighterNetwork !== appNetwork;

  // Only flag an account mismatch when the user is logged in, Freighter has
  // reported an address, and the two differ.
  const accountMismatch =
    isConnected &&
    !!authAddress &&
    freighterAddress !== null &&
    freighterAddress !== authAddress &&
    !accountMismatchDismissed;

  return {
    networkMismatch,
    accountMismatch,
    freighterNetwork,
    freighterAddress,
    appNetwork,
    dismissAccountMismatch: () => setAccountMismatchDismissed(true),
  };
}

/**
 * Utility for imperative pre-transaction checks.
 *
 * Usage:
 *   await assertFreighterReady(authAddress);
 *
 * Throws a descriptive error if the network or account is wrong so callers
 * can surface it in their error handling before submitting any XDR.
 */
export async function assertFreighterReady(expectedAddress: string): Promise<void> {
  const { getFreighterStatus } = await import('@/lib/stellar/freighter');
  const appNetwork = normalizeNetwork(
    process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet',
  );

  const { address, network } = await getFreighterStatus();

  if (network !== appNetwork) {
    throw new Error(
      `Freighter is connected to "${network}" but this app requires "${appNetwork}". ` +
        `Please switch networks in Freighter and try again.`,
    );
  }

  if (address !== expectedAddress) {
    throw new Error(
      `Freighter is using address ${address} but you are signed in as ${expectedAddress}. ` +
        `Please switch accounts in Freighter or re-authenticate.`,
    );
  }
}
