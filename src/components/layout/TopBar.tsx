'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Bell, LogOut, Menu, RefreshCw, Wifi, X } from 'lucide-react';
import { useFreighterWatcher } from '@/lib/hooks/use-freighter-watcher';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { useMobileSidebar } from './MobileSidebarContext';

export function TopBar() {
  const { open, setOpen } = useMobileSidebar();
  const { unreadCount } = useNotifications();
  const {
    networkMismatch,
    accountMismatch,
    freighterNetwork,
    freighterAddress,
    appNetwork,           // already normalised via normalizeNetwork()
    dismissAccountMismatch,
  } = useFreighterWatcher();

  const { logout, address: authAddress } = useAuthStore();

  // Truncate a Stellar address for display: GABCD…WXYZ
  function truncate(addr: string | null) {
    if (!addr) return '';
    return `${addr.slice(0, 5)}…${addr.slice(-4)}`;
  }

  return (
    <>
      {/* ── Network-mismatch banner ─────────────────────────────────────────
          Blocking: shown above the top bar, full-width, no dismiss button.
          The user must fix Freighter before they can do anything useful.     */}
      {networkMismatch && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-center gap-2 w-full bg-red-600 text-white text-sm font-medium px-4 py-2"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>
            Freighter is connected to&nbsp;
            <strong className="capitalize">{freighterNetwork ?? ''}</strong>, but this
            app requires&nbsp;
            <strong className="capitalize">{appNetwork}</strong>. Please switch
            networks in Freighter to continue.
          </span>
        </div>
      )}

      {/* ── Account-mismatch banner ─────────────────────────────────────────
          Shown when Freighter's active address no longer matches the session.
          Offers a re-authenticate (logout) action or a dismiss.              */}
      {accountMismatch && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center justify-between gap-3 w-full bg-amber-500 text-white text-sm font-medium px-4 py-2"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            Freighter switched to&nbsp;
            <strong>{truncate(freighterAddress)}</strong>, but you are signed in
            as&nbsp;<strong>{truncate(authAddress)}</strong>. Please
            re-authenticate.
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors rounded-lg px-3 py-1 text-xs font-semibold"
              aria-label="Log out and re-authenticate"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              Re-authenticate
            </button>
            <button
              onClick={dismissAccountMismatch}
              className="p-1 rounded-lg hover:bg-white/20 transition-colors"
              aria-label="Dismiss account mismatch warning"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* ── Main top bar ────────────────────────────────────────────────── */}
      <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="md:hidden p-2 -ml-2 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-sidebar"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>
        <div className="flex items-center gap-3">
          {/* Network badge — turns red with a refresh icon when mismatched */}
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg ${
              networkMismatch
                ? 'bg-red-50 text-red-700'
                : appNetwork === 'mainnet'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-amber-50 text-amber-700'
            }`}
            title={
              networkMismatch
                ? `Freighter: ${freighterNetwork ?? ''} — App: ${appNetwork}`
                : undefined
            }
          >
            {networkMismatch ? (
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
            ) : (
              <Wifi className="w-3 h-3" aria-hidden="true" />
            )}
            {networkMismatch
              ? 'Wrong network'
              : appNetwork === 'mainnet'
                ? 'Mainnet'
                : 'Testnet'}
          </span>

          <Link
            href="/dashboard/notifications"
            className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          >
            <Bell className="w-4 h-4" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center font-semibold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </header>
    </>
  );
}
