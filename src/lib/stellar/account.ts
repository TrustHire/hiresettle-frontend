/**
 * lib/stellar/account.ts
 *
 * Classic (Horizon) account helpers used for first-run setup:
 *  - look up whether an account exists and holds a USDC trustline
 *  - fund a testnet account with Friendbot
 *  - add the USDC trustline, signed via Freighter
 *
 * Friendbot and the one-click trustline are testnet-only helpers; both throw
 * on mainnet so they can never be triggered there by mistake.
 */

import { signTx } from './freighter';

const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';

export const IS_TESTNET = NETWORK !== 'mainnet';

const HORIZON_URL = (
  process.env.NEXT_PUBLIC_HORIZON_URL ??
  (IS_TESTNET ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org')
).replace(/\/+$/, '');

const FRIENDBOT_URL = (
  process.env.NEXT_PUBLIC_FRIENDBOT_URL ?? 'https://friendbot.stellar.org'
).replace(/\/+$/, '');

/** Classic USDC asset the escrow contract's SAC wraps. */
export const USDC_CODE = 'USDC';
export const USDC_ISSUER =
  process.env.NEXT_PUBLIC_USDC_ISSUER ??
  (IS_TESTNET
    ? 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' // Circle testnet USDC
    : 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'); // Circle mainnet USDC

export interface AccountSetupStatus {
  /** The account exists on the ledger (has been funded with XLM). */
  funded: boolean;
  /** The account holds a trustline to USDC_CODE:USDC_ISSUER. */
  hasUsdcTrustline: boolean;
  /** Native XLM balance, or null when the account doesn't exist. */
  xlmBalance: string | null;
}

interface HorizonBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}

/** Read the account's funding and USDC trustline status from Horizon. */
export async function getAccountSetupStatus(address: string): Promise<AccountSetupStatus> {
  const res = await fetch(`${HORIZON_URL}/accounts/${encodeURIComponent(address)}`);
  if (res.status === 404) {
    return { funded: false, hasUsdcTrustline: false, xlmBalance: null };
  }
  if (!res.ok) {
    throw new Error(`Could not load account from Horizon (HTTP ${res.status}).`);
  }

  const body = (await res.json()) as { balances?: HorizonBalance[] };
  const balances = body.balances ?? [];
  const native = balances.find((b) => b.asset_type === 'native');
  const hasUsdcTrustline = balances.some(
    (b) => b.asset_code === USDC_CODE && b.asset_issuer === USDC_ISSUER,
  );

  return { funded: true, hasUsdcTrustline, xlmBalance: native?.balance ?? null };
}

/** Fund a testnet account with 10,000 test XLM via Friendbot. */
export async function fundWithFriendbot(address: string): Promise<void> {
  if (!IS_TESTNET) throw new Error('Friendbot is only available on testnet.');

  const res = await fetch(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(address)}`);
  if (!res.ok) {
    // Friendbot returns 400 when the account is already funded.
    let detail = '';
    try {
      const body = (await res.json()) as { detail?: string };
      detail = body.detail ?? '';
    } catch {}
    if (/already funded|createAccountAlreadyExist/i.test(detail)) return;
    throw new Error(detail || `Friendbot request failed (HTTP ${res.status}).`);
  }
}

/**
 * Add a USDC trustline to `address`. Builds a ChangeTrust transaction, asks
 * Freighter to sign it and submits it to Horizon. Returns the tx hash.
 */
export async function addUsdcTrustline(address: string): Promise<string> {
  if (!IS_TESTNET) throw new Error('One-click trustline setup is only available on testnet.');

  const { Horizon, Asset, Operation, TransactionBuilder, BASE_FEE, Networks } =
    await import('@stellar/stellar-sdk');

  const networkPassphrase = Networks.TESTNET;
  const server = new Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(address);

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
    .addOperation(Operation.changeTrust({ asset: new Asset(USDC_CODE, USDC_ISSUER) }))
    .setTimeout(180)
    .build();

  const signedXdr = await signTx(tx.toXDR(), networkPassphrase);
  const signed = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  const result = await server.submitTransaction(signed);
  return result.hash;
}
