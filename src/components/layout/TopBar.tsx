'use client';

import Link from 'next/link';
import { Bell, Wifi, Menu } from 'lucide-react';
import { useMobileSidebar } from './MobileSidebarContext';

export function TopBar() {
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';
  const { setOpen } = useMobileSidebar();

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
      {/* Hamburger — mobile only */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden p-2 -ml-1 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Spacer on desktop (keeps right-side items flush right) */}
      <div className="hidden md:block" />

      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg ${
          network === 'mainnet' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
        }`}>
          <Wifi className="w-3 h-3" />
          {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
        </span>
        <Link
          href="/notifications"
          className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
        </Link>
      </div>
    </header>
  );
}
