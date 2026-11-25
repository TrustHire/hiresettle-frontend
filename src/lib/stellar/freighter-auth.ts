/**
 * lib/stellar/freighter-auth.ts
 * Full Freighter sign-in flow: connect → fetch nonce → sign → exchange for a JWT.
 */

import { Networks } from '@stellar/stellar-sdk';
import { authApi } from '@/lib/api/services';
import { connectFreighter, signNonce } from '@/lib/stellar/freighter';
import type { User } from '@/types';

export type FreighterAuthStep = 'connecting' | 'signing' | 'verifying';

export async function signInWithFreighter(
  onStep?: (step: FreighterAuthStep) => void,
): Promise<{ address: string; accessToken: string; user: User }> {
  onStep?.('connecting');
  const address = await connectFreighter();
  const nonce = await authApi.getNonce(address);

  onStep?.('signing');
  const networkPassphrase = process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;
  const signedNonce = await signNonce(nonce, networkPassphrase);

  onStep?.('verifying');
  const { accessToken, user } = await authApi.login({
    stellarAddress: address,
    signedNonce,
    signature: signedNonce,
  });

  return { address, accessToken, user };
}
