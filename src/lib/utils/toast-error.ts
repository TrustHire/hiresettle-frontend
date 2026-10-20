import axios from 'axios';

/**
 * Maps raw Freighter / Soroban / HTTP error strings to human-readable messages.
 * Keeps the UI free of XDR blobs and internal SDK noise.
 */

const ERROR_PATTERNS: Array<[RegExp, string]> = [
  // Network / HTTP errors
  [/network error|failed to fetch|load failed|offline/i, 'Network error. Please check your internet connection and try again.'],
  [/timeout/i, 'The request timed out. Please try again.'],
  [/500|internal server error/i, 'A server error occurred. Please try again later.'],
  [/502|bad gateway/i, 'The server is temporarily unavailable. Please try again later.'],
  [/503|service unavailable/i, 'Service unavailable. Please try again later.'],
  [/504|gateway timeout/i, 'Gateway timed out. Please try again later.'],

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
  [/still pending|pending confirmation/i, 'The transaction is still pending confirmation on Stellar.'],

  // Contract-level logic errors
  [/unauthorized/i, 'You are not authorised to perform this action.'],
  [/milestone.*not.*pending/i, 'This milestone is not in the expected state.'],
  [/already disputed/i, 'This milestone is already under dispute.'],
  [/invalid proof/i, 'The proof hash you provided is invalid.'],
];

export function toReadableError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    // Timeout
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || /timeout/i.test(err.message)) {
      return 'The request timed out. Please try again.';
    }

    // Network / Offline
    if (
      err.code === 'ERR_NETWORK' ||
      /network error/i.test(err.message) ||
      (typeof navigator !== 'undefined' && !navigator.onLine)
    ) {
      return 'Network error. Please check your internet connection and try again.';
    }

    // HTTP Responses
    if (err.response) {
      const status = err.response.status;
      const data = err.response.data as { message?: string; error?: string } | string | undefined;
      const apiMessage =
        typeof data === 'string'
          ? data
          : typeof data === 'object' && data !== null
          ? data.message || data.error
          : undefined;

      if (status >= 500) {
        return 'A server error occurred. Please try again later.';
      }

      if (status === 404) {
        return apiMessage || 'Resource not found.';
      }

      if (apiMessage) {
        for (const [pattern, message] of ERROR_PATTERNS) {
          if (pattern.test(apiMessage)) return message;
        }
        return apiMessage;
      }
    }
  }

  // Handle generic or status-bearing non-Axios objects
  const responseStatus = (err as { response?: { status?: number }; status?: number })?.response?.status ??
    (err as { status?: number })?.status;
  if (responseStatus && responseStatus >= 500) {
    return 'A server error occurred. Please try again later.';
  }

  let raw = '';
  if (err instanceof Error) {
    raw = err.message;
  } else if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    raw = (err as { message: string }).message;
  } else {
    raw = String(err);
  }

  for (const [pattern, message] of ERROR_PATTERNS) {
    if (pattern.test(raw)) return message;
  }

  // If the raw message looks like XDR (base64-ish, long, no spaces) hide it
  if (/^[A-Za-z0-9+/=]{40,}$/.test(raw.trim())) {
    return 'An unexpected contract error occurred. Please try again.';
  }

  return raw || 'An unexpected error occurred.';
}
