/**
 * lib/stellar/freighter.ts
 * All interactions with the Freighter browser wallet extension.
 */

import {
  isConnected,
  getAddress,
  signTransaction,
  requestAccess,
  getNetwork,
  WatchWalletChanges,
} from '@stellar/freighter-api';

export async function isFreighterInstalled(): Promise<boolean> {
  try {
    const result = await isConnected();
    return result.isConnected;
  } catch { return false; }
}

export async function connectFreighter(): Promise<string> {
  const access = await requestAccess();
  if (access.error) throw new Error(access.error);
  return getUserAddress();
}

export async function getUserAddress(): Promise<string> {
  const result = await getAddress();
  if (result.error) throw new Error(result.error);
  return result.address;
}

export async function getWalletNetwork(): Promise<string> {
  const result = await getNetwork();
  if (result.error) throw new Error(result.error);
  return result.network;
}

export async function signTx(xdr: string, networkPassphrase: string): Promise<string> {
  const result = await signTransaction(xdr, { networkPassphrase });
  if (result.error) throw new Error(result.error);
  return result.signedTxXdr;
}

/**
 * Sign the backend nonce challenge.
 * Encodes the nonce as a ManageData operation and signs the resulting tx.
 */
export async function signNonce(nonce: string, networkPassphrase: string): Promise<string> {
  const { TransactionBuilder, Networks, BASE_FEE, Operation } =
    await import('@stellar/stellar-sdk');

  const address = await getUserAddress();
  const dummyAccount = {
    accountId: () => address,
    sequenceNumber: () => '0',
    incrementSequenceNumber: () => {},
  } as any;

  const tx = new TransactionBuilder(dummyAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.manageData({ name: 'hiresettle_nonce', value: Buffer.from(nonce) }),
    )
    .setTimeout(30)
    .build();

  return signTx(tx.toXDR(), networkPassphrase);
}

export function watchWallet(onChange: (address: string, network: string) => void): () => void {
  const watcher = new WatchWalletChanges(3000);
  watcher.watch(async () => {
    try {
      const address = await getUserAddress();
      const network = await getWalletNetwork();
      onChange(address, network);
    } catch {}
  });
  return () => watcher.stop();
}
