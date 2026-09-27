'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Briefcase, Bell, Activity, LogOut, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import { shortAddress, cn } from '@/lib/utils';
import { useMobileSidebar } from './MobileSidebarContext';

const NAV_ITEMS = [
  { href: '/dashboard',             label: 'Overview',      icon: LayoutDashboard },
  { href: '/dashboard/engagements', label: 'Engagements', icon: Briefcase },
  { href: '/notifications',         label: 'Notifications', icon: Bell },
  { href: '/dashboard/events',      label: 'Chain Events',  icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();
  const { address, user, logout } = useAuthStore();
  const { open, setOpen } = useMobileSidebar();

  const roleLabel = user?.role
    ? { COMPANY: 'Company', RECRUITER: 'Recruiter', ARBITER: 'Arbiter', ADMIN: 'Admin' }[user.role] ?? user.role
    : null;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">HireSettle</span>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={() => setOpen(false)}
          className="md:hidden p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          // Overview route: exact match only to avoid highlighting on every sub-page
          const active = href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px]',
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <Icon className={cn('w-4 h-4', active ? 'text-brand-600' : 'text-gray-400')} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gray-50 mb-2">
          <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-brand-700">
              {address?.slice(0, 2) ?? 'G'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">
              {address ? shortAddress(address) : 'Not connected'}
            </p>
            <p className="text-[10px] text-gray-400">
              {roleLabel ?? 'Stellar Testnet'}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-red-600 transition-colors min-h-[44px]"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar — always visible at md+ */}
      <aside className="hidden md:flex w-60 bg-white border-r border-gray-100 flex-col flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile slide-over drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col w-72 bg-white border-r border-gray-100 md:hidden',
          'transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Sidebar"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
