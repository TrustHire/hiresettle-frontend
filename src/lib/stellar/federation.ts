/**
 * lib/stellar/federation.ts
 * Resolve Stellar federation addresses (e.g. "name*domain.com") to G… public keys.
 */

import { Federation, StrKey } from '@stellar/stellar-sdk';

/** True when the value looks like a federation address ("name*domain.tld"). */
export function isFederationAddress(value: string): boolean {
  const v = value.trim();
  const star = v.indexOf('*');
  if (star <= 0 || star !== v.lastIndexOf('*')) return false;
  const domain = v.slice(star + 1);
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain);
}

/**
 * Resolve a federation address to its Stellar account ID using the domain's
 * stellar.toml FEDERATION_SERVER. Throws a human-readable error on failure.
 */
export async function resolveFederationAddress(value: string): Promise<string> {
  const v = value.trim();
  if (!isFederationAddress(v)) {
    throw new Error('Federation addresses must look like name*domain.com.');
  }

  let record: Federation.Api.Record;
  try {
    record = await Federation.Server.resolve(v);
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 404) throw new Error(`No account found for ${v}.`);
    throw new Error(
      `Could not resolve ${v}. Check the address and that the domain supports Stellar federation.`,
    );
  }

  const accountId = record?.account_id;
  if (!accountId || !StrKey.isValidEd25519PublicKey(accountId)) {
    throw new Error(`Federation server for ${v} returned an invalid account.`);
  }
  return accountId;
}
