'use client';

// Testnet-only setup helpers. Every component here renders nothing on mainnet.

import { Droplets, Link2, Loader2, FlaskConical } from 'lucide-react';
import type { AccountSetup } from '@/lib/hooks/use-account-setup';

export function FriendbotButton({ setup }: { setup: AccountSetup }) {
  if (!setup.isTestnet) return null;
  return (
    <button
      onClick={() => setup.fundWithFriendbot()}
      disabled={setup.funding}
      className="btn-secondary text-xs"
    >
      {setup.funding ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Droplets className="w-3.5 h-3.5" />
      )}
      Fund with Friendbot
    </button>
  );
}

export function UsdcTrustlineButton({ setup }: { setup: AccountSetup }) {
  if (!setup.isTestnet) return null;
  return (
    <button
      onClick={() => setup.addUsdcTrustline()}
      // A trustline needs an existing account to pay the reserve
      disabled={setup.addingTrustline || setup.funded === false}
      title={setup.funded === false ? 'Fund the account first' : undefined}
      className="btn-secondary text-xs"
    >
      {setup.addingTrustline ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Link2 className="w-3.5 h-3.5" />
      )}
      Add USDC trustline
    </button>
  );
}

/**
 * Compact card shown on the overview page when the onboarding checklist is
 * hidden but the testnet account still needs funding or a trustline.
 */
export function TestnetSetupCard({ setup }: { setup: AccountSetup }) {
  if (!setup.isTestnet) return null;

  const needsFunding = setup.funded === false;
  const needsTrustline = setup.funded === true && setup.hasUsdcTrustline === false;
  if (!needsFunding && !needsTrustline) return null;

  return (
    <div className="card p-4 flex items-center gap-3 flex-wrap">
      <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
        <FlaskConical className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">Testnet setup</p>
        <p className="text-xs text-gray-500">
          {needsFunding
            ? 'Your testnet account is not funded yet.'
            : 'Your account has no USDC trustline yet.'}
        </p>
      </div>
      {needsFunding ? <FriendbotButton setup={setup} /> : <UsdcTrustlineButton setup={setup} />}
    </div>
  );
}
