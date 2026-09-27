'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Clock, Wifi } from 'lucide-react';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { timeAgo } from '@/lib/utils';

const TYPE_COLORS: Record<string, string> = {
  PAYMENT_RELEASED:             'bg-green-50 text-green-700',
  MILESTONE_UNLOCKED:           'bg-sky-50 text-sky-700',
  PROOF_SUBMITTED:              'bg-amber-50 text-amber-700',
  DISPUTE_RAISED:               'bg-red-50 text-red-700',
  DISPUTE_RESOLVED:             'bg-purple-50 text-purple-700',
  REPLACEMENT_REQUESTED:        'bg-orange-50 text-orange-700',
  RETENTION_WINDOW_APPROACHING: 'bg-yellow-50 text-yellow-700',
  ENGAGEMENT_CANCELLED:         'bg-gray-100 text-gray-600',
  ENGAGEMENT_CREATED:           'bg-blue-50 text-blue-700',
};

export function TopBar() {
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';
  const { latest, unreadCount, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close dropdown on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
      <div />
      <div className="flex items-center gap-3">
        {/* Network badge */}
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg ${
          network === 'mainnet' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
        }`}>
          <Wifi className="w-3 h-3" />
          {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
        </span>

        {/* Bell button + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            aria-expanded={open}
            aria-haspopup="true"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-4 text-center">
                {badgeLabel}
              </span>
            )}
          </button>

          {/* Dropdown panel */}
          {open && (
            <div
              role="dialog"
              aria-label="Recent notifications"
              className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <span className="text-sm font-semibold text-gray-900">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-xs text-gray-400">{unreadCount} unread</span>
                )}
              </div>

              {/* Notification list */}
              {latest.length === 0 ? (
                <div className="py-10 flex flex-col items-center gap-2 text-gray-400">
                  <Bell className="w-6 h-6" />
                  <p className="text-xs">No notifications yet</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50 max-h-[360px] overflow-y-auto">
                  {latest.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => {
                          if (!n.read) markRead(n.id);
                        }}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                          n.read
                            ? 'opacity-60'
                            : 'hover:bg-gray-50 cursor-pointer'
                        }`}
                      >
                        {/* Unread dot */}
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                          n.read ? 'bg-gray-200' : 'bg-blue-600'
                        }`} />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2 mb-0.5">
                            <p className="text-xs font-medium text-gray-900 leading-snug">
                              {n.title}
                            </p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                              TYPE_COLORS[n.type] ?? 'bg-gray-100 text-gray-600'
                            }`}>
                              {n.type.replace(/_/g, ' ').toLowerCase()}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {timeAgo(n.createdAt)}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Footer */}
              <div className="border-t border-gray-50 px-4 py-2.5">
                <Link
                  href="/notifications"
                  onClick={() => setOpen(false)}
                  className="block text-center text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  View all notifications
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
