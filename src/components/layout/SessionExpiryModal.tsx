'use client';

/**
 * SessionExpiryModal
 *
 * Decodes the JWT `exp` claim and warns the user ~2 minutes before the
 * session expires. "Sign in again" re-runs the Freighter flow in place, so the
 * fresh token is stored without navigating away from the current page.
 */

import { useEffect, useState } from 'react';
import { Clock, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { getJwtExp, useAuthStore } from '@/lib/hooks/use-auth-store';
import { signInWithFreighter, type FreighterAuthStep } from '@/lib/stellar/freighter-auth';

const WARNING_LEAD_MS = 2 * 60 * 1000;

const STEP_LABEL: Record<FreighterAuthStep, string> = {
  connecting: 'Requesting wallet access…',
  signing: 'Sign the message in Freighter…',
  verifying: 'Verifying with server…',
};

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SessionExpiryModal() {
  const token = useAuthStore((s) => s.token);
  const address = useAuthStore((s) => s.address);
  const setAuth = useAuthStore((s) => s.setAuth);

  const expMs = token ? (getJwtExp(token) ?? 0) * 1000 || null : null;

  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [step, setStep] = useState<FreighterAuthStep | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Schedule the warning for (exp - 2 min), and again at expiry in case the
  // user chose "Not now". Re-arms whenever the token changes.
  useEffect(() => {
    setOpen(false);
    setError(null);
    if (!expMs) return;

    const show = () => {
      setNow(Date.now());
      setOpen(true);
    };
    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (at: number) => {
      const delay = at - Date.now();
      if (delay <= 0) return show();
      // setTimeout overflows above ~24.8 days; skip — the token will be
      // refreshed or the page reloaded long before then.
      if (delay > 2_147_483_647) return;
      timers.push(setTimeout(show, delay));
    };

    if (expMs - WARNING_LEAD_MS <= Date.now()) {
      show();
    } else {
      schedule(expMs - WARNING_LEAD_MS);
      schedule(expMs);
    }
    return () => timers.forEach(clearTimeout);
  }, [expMs]);

  // Live countdown while the modal is visible
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  if (!open || !expMs) return null;

  const remaining = expMs - now;
  const expired = remaining <= 0;
  const busy = step !== null;

  const handleReauth = async () => {
    setError(null);
    try {
      const result = await signInWithFreighter(setStep);
      if (address && result.address !== address) {
        toast.warning('Signed in with a different Freighter account.');
      }
      // Updates the cookie + store in place — no navigation, current page is kept.
      setAuth(result.address, result.accessToken, result.user);
      toast.success('Session renewed');
    } catch (err: any) {
      setError(err?.message ?? 'Sign-in failed. Please try again.');
    } finally {
      setStep(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expiry-title"
    >
      <div className="card w-full max-w-sm p-6 animate-fade-in">
        <div className="flex items-center gap-2.5 mb-2">
          <Clock className="w-5 h-5 text-amber-500" aria-hidden="true" />
          <h2 id="session-expiry-title" className="text-base font-semibold text-gray-900">
            {expired ? 'Your session has expired' : 'Your session is about to expire'}
          </h2>
        </div>
        <p className="text-sm text-gray-500 mb-4" aria-live="polite">
          {expired
            ? 'Sign in again with Freighter to continue where you left off.'
            : <>Your session ends in <strong className="text-gray-900 tabular-nums">{formatRemaining(remaining)}</strong>. Sign in again to keep working without losing your place.</>}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button onClick={handleReauth} disabled={busy} className="btn-primary w-full">
            {busy ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{STEP_LABEL[step]}</>
            ) : (
              <><Wallet className="w-4 h-4" />Sign in again</>
            )}
          </button>
          {!expired && (
            <button onClick={() => setOpen(false)} disabled={busy} className="btn-ghost w-full text-sm">
              Not now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
