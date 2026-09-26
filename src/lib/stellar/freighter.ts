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
  const { TransactionBuilder, BASE_FEE, Operation } =
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

/**
 * Normalize a Freighter network string to lowercase for reliable comparison.
 * Freighter may return "TESTNET", "Testnet", "testnet", etc.
 */
export function normalizeNetwork(network: string): string {
  return network.toLowerCase().trim();
}

/**
 * Return the current Freighter address + network in one call.
 * Throws if Freighter is not available or not connected.
 */
export async function getFreighterStatus(): Promise<{ address: string; network: string }> {
  const [address, network] = await Promise.all([getUserAddress(), getWalletNetwork()]);
  return { address, network: normalizeNetwork(network) };
}

/**
 * Watch for wallet address or network changes.
 * Fires onChange immediately on the first tick so callers get an initial state,
 * then again whenever Freighter reports a change.
 * Returns a cleanup function that stops the watcher.
 */
export function watchWallet(
  onChange: (address: string, network: string) => void,
): () => void {
  // Fire once immediately so the UI has an initial reading.
  getFreighterStatus()
    .then(({ address, network }) => onChange(address, network))
    .catch(() => {});

  const watcher = new WatchWalletChanges(3000);
  watcher.watch(async () => {
    try {
      const { address, network } = await getFreighterStatus();
      onChange(address, network);
    } catch {}
  });
  return () => watcher.stop();
}
