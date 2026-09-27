/**
 * Maps raw Freighter / Soroban error strings to human-readable messages.
 * Keeps the UI free of XDR blobs and internal SDK noise.
 */

const ERROR_PATTERNS: Array<[RegExp, string]> = [
  // Freighter wallet rejections
  [/user declined/i, 'You cancelled the transaction in Freighter.'],
  [/user rejected/i, 'You rejected the request in Freighter.'],
  [/not connected/i, 'Freighter is not connected. Please unlock your wallet.'],
  [/extension not found/i, 'Freighter extension not found. Please install it.'],

  // Soroban simulation errors
  [/simulation error/i, 'Contract simulation failed. The transaction cannot proceed.'],
  [/insufficient balance/i, 'Insufficient USDC balance to cover this transaction.'],
  [/insufficient funds/i, 'Insufficient funds to cover the transaction fee.'],

  // On-chain submission/confirmation errors
  [/submission error/i, 'The transaction was rejected by the network.'],
  [/transaction failed/i, 'The transaction failed on-chain. Please try again.'],
  [/not confirmed after/i, 'Transaction timed out waiting for confirmation.'],

  // Contract-level logic errors
  [/unauthorized/i, 'You are not authorised to perform this action.'],
  [/milestone.*not.*pending/i, 'This milestone is not in the expected state.'],
  [/already disputed/i, 'This milestone is already under dispute.'],
  [/invalid proof/i, 'The proof hash you provided is invalid.'],
];

export function toReadableError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  for (const [pattern, message] of ERROR_PATTERNS) {
    if (pattern.test(raw)) return message;
  }

  // If the raw message looks like XDR (base64-ish, long, no spaces) hide it
  if (/^[A-Za-z0-9+/=]{40,}$/.test(raw.trim())) {
    return 'An unexpected contract error occurred. Please try again.';
  }

  return raw || 'An unexpected error occurred.';
}
