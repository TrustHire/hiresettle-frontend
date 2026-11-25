'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2, RefreshCw, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AccountSetup } from '@/lib/hooks/use-account-setup';
import { FriendbotButton, UsdcTrustlineButton } from './TestnetHelpers';

const DISMISS_KEY_PREFIX = 'hiresettle_onboarding_dismissed:';

/**
 * Remembers (per wallet address, in localStorage) whether the user dismissed
 * the onboarding checklist. `dismissed` is null until storage has been read,
 * so the checklist never flashes in before being hidden.
 */
export function useOnboardingDismissed(address: string | null) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!address) return;
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY_PREFIX + address) === '1');
    } catch {
      setDismissed(false);
    }
  }, [address]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    if (!address) return;
    try {
      localStorage.setItem(DISMISS_KEY_PREFIX + address, '1');
    } catch {
      // Storage unavailable (private mode etc.) — dismissal lasts for this session only
    }
  }, [address]);

  return { dismissed, dismiss };
}

interface Step {
  id: string;
  title: string;
  description: string;
  /** null while the step is still being detected */
  done: boolean | null;
  action?: React.ReactNode;
}

export function OnboardingChecklist({
  setup,
  onDismiss,
}: {
  setup: AccountSetup;
  onDismiss: () => void;
}) {
  const networkName = setup.isTestnet ? 'Testnet' : 'Mainnet';

  const steps: Step[] = [
    {
      id: 'freighter',
      title: 'Install Freighter',
      description: 'HireSettle uses the Freighter browser wallet to sign every transaction.',
      done: setup.freighterInstalled,
      action: setup.freighterInstalled === false && (
        <a
          href="https://freighter.app"
          target="_blank"
          rel="noreferrer"
          className="btn-secondary text-xs"
        >
          Get Freighter
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      ),
    },
    {
      id: 'network',
      title: `Switch Freighter to ${networkName}`,
      description: `Open Freighter's settings and select the ${networkName} network.`,
      done: setup.freighterInstalled === false ? false : setup.networkOk,
    },
    {
      id: 'fund',
      title: 'Fund your account',
      description: setup.isTestnet
        ? 'Get free test XLM from Friendbot to activate your account and pay fees.'
        : 'Send some XLM to your address from an exchange or another wallet to activate it.',
      done: setup.funded,
      action: setup.funded === false && <FriendbotButton setup={setup} />,
    },
    {
      id: 'trustline',
      title: 'Add a USDC trustline',
      description: setup.isTestnet
        ? 'Escrowed fees are paid in USDC, so your account must trust the USDC asset.'
        : 'Escrowed fees are paid in USDC. Add the USDC asset in Freighter under "Manage assets".',
      done: setup.hasUsdcTrustline,
      action: setup.hasUsdcTrustline === false && <UsdcTrustlineButton setup={setup} />,
    },
  ];

  const completed = steps.filter((s) => s.done === true).length;
  const allDone = completed === steps.length;

  return (
    <section className="card p-5" aria-labelledby="onboarding-title">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 id="onboarding-title" className="text-sm font-semibold text-gray-900">
            {allDone ? "You're all set" : 'Get started with HireSettle'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {completed} of {steps.length} steps complete
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={setup.refetch}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            aria-label="Re-check setup steps"
            title="Re-check"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            aria-label="Dismiss checklist"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
        <div
          className="bg-brand-600 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(completed / steps.length) * 100}%` }}
        />
      </div>

      <ol className="divide-y divide-gray-50">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3 py-3">
            <span className="mt-0.5 flex-shrink-0">
              {step.done === null ? (
                <Loader2 className="w-4 h-4 text-gray-300 animate-spin" aria-label="Checking" />
              ) : step.done ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" aria-label="Done" />
              ) : (
                <Circle className="w-4 h-4 text-gray-300" aria-label="To do" />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-sm font-medium',
                  step.done ? 'text-gray-400 line-through' : 'text-gray-900',
                )}
              >
                {step.title}
              </p>
              {!step.done && <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>}
            </div>
            {step.action && <div className="flex-shrink-0">{step.action}</div>}
          </li>
        ))}
      </ol>

      {setup.accountError && (
        <p className="text-xs text-amber-600 mt-2">
          Couldn&apos;t check your account on Horizon. Use re-check to try again.
        </p>
      )}
    </section>
  );
}
