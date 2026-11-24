'use client';

/**
 * useAccountSetup
 *
 * Detects the first-run setup steps for the signed-in wallet:
 *   - Freighter installed
 *   - Freighter on the network this app is configured for
 *   - Account funded (exists on the ledger)
 *   - USDC trustline present
 *
 * Also exposes the testnet helpers (Friendbot funding and one-click USDC
 * trustline) as mutations that refresh the detected status on success.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  isFreighterInstalled,
  getWalletNetwork,
  isExpectedNetwork,
} from '@/lib/stellar/freighter';
import {
  IS_TESTNET,
  getAccountSetupStatus,
  fundWithFriendbot,
  addUsdcTrustline,
} from '@/lib/stellar/account';
import { accountKeys } from '@/lib/query-keys';
import { toReadableError } from '@/lib/utils/toast-error';

export function useAccountSetup(address: string | null) {
  const queryClient = useQueryClient();

  const freighterQuery = useQuery({
    queryKey: accountKeys.freighter(),
    queryFn: async () => {
      const installed = await isFreighterInstalled();
      if (!installed) return { installed: false, network: null as string | null };
      try {
        return { installed: true, network: await getWalletNetwork() };
      } catch {
        return { installed: true, network: null as string | null };
      }
    },
    // Re-check periodically so switching network in Freighter ticks the step.
    refetchInterval: 5_000,
  });

  const accountQuery = useQuery({
    queryKey: accountKeys.setup(address ?? ''),
    queryFn: () => getAccountSetupStatus(address as string),
    enabled: !!address,
  });

  const refreshAccount = () =>
    queryClient.invalidateQueries({ queryKey: accountKeys.setup(address ?? '') });

  const friendbot = useMutation({
    mutationFn: () => fundWithFriendbot(address as string),
    onSuccess: async () => {
      toast.success('Account funded with test XLM');
      await refreshAccount();
    },
    onError: (err) => toast.error(toReadableError(err)),
  });

  const trustline = useMutation({
    mutationFn: () => addUsdcTrustline(address as string),
    onSuccess: async () => {
      toast.success('USDC trustline added');
      await refreshAccount();
    },
    onError: (err) => toast.error(toReadableError(err)),
  });

  const freighterInstalled = freighterQuery.data?.installed ?? null;
  const network = freighterQuery.data?.network ?? null;

  return {
    isTestnet: IS_TESTNET,
    /** null while still detecting */
    freighterInstalled,
    /** null while still detecting or when Freighter can't report a network */
    networkOk: network === null ? null : isExpectedNetwork(network),
    funded: accountQuery.data?.funded ?? null,
    hasUsdcTrustline: accountQuery.data?.hasUsdcTrustline ?? null,
    accountError: accountQuery.isError,
    refetch: () => {
      void freighterQuery.refetch();
      void accountQuery.refetch();
    },
    fundWithFriendbot: friendbot.mutate,
    funding: friendbot.isPending,
    addUsdcTrustline: trustline.mutate,
    addingTrustline: trustline.isPending,
  };
}

export type AccountSetup = ReturnType<typeof useAccountSetup>;
