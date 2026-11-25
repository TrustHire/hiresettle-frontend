'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, Bell, Briefcase, CalendarDays, CornerDownLeft, LayoutDashboard,
  Loader2, Plus, Scale, Search,
} from 'lucide-react';
import { useParticipantEngagements } from '@/lib/hooks/use-participant-engagements';
import { cn, engagementStatusBadge, engagementStatusLabel } from '@/lib/utils';
import type { Engagement } from '@/types';

/** Window event other components can dispatch to open the palette. */
export const OPEN_COMMAND_PALETTE_EVENT = 'hiresettle:open-command-palette';

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT));
}

interface PaletteItem {
  id: string;
  group: 'Navigation' | 'Engagements';
  label: string;
  hint?: string;
  icon: React.ElementType;
  href: string;
  keywords?: string;
  engagement?: Engagement;
}

const NAV_COMMANDS: PaletteItem[] = [
  { id: 'nav-create',        group: 'Navigation', label: 'Create engagement', icon: Plus,            href: '/dashboard/engagements/create', keywords: 'new add' },
  { id: 'nav-overview',      group: 'Navigation', label: 'Overview',          icon: LayoutDashboard, href: '/dashboard',                    keywords: 'home dashboard' },
  { id: 'nav-engagements',   group: 'Navigation', label: 'Engagements',       icon: Briefcase,       href: '/dashboard/engagements',        keywords: 'list' },
  { id: 'nav-disputes',      group: 'Navigation', label: 'Disputes',          icon: Scale,           href: '/dashboard/disputes',           keywords: 'arbiter' },
  { id: 'nav-calendar',      group: 'Navigation', label: 'Unlock calendar',   icon: CalendarDays,    href: '/dashboard/calendar',           keywords: 'retention unlocks' },
  { id: 'nav-events',        group: 'Navigation', label: 'Chain events',      icon: Activity,        href: '/dashboard/events',             keywords: 'events ledger' },
  { id: 'nav-notifications', group: 'Navigation', label: 'Notifications',     icon: Bell,            href: '/dashboard/notifications',      keywords: 'alerts inbox' },
];

const MAX_ENGAGEMENT_RESULTS = 8;

function matches(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle);
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  // Only fetch once the palette has been opened; shares the overview's cache.
  const engagementsQuery = useParticipantEngagements({ enabled: open });

  const show = useCallback(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    setQuery('');
    setActiveIndex(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Return focus to wherever the user was before opening.
    const el = restoreFocusRef.current;
    if (el && typeof el.focus === 'function') {
      requestAnimationFrame(() => el.focus());
    }
  }, []);

  // ── Global shortcut: Cmd/Ctrl+K ──────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (open) close();
        else show();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, show);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, show);
    };
  }, [open, show, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // ── Results ───────────────────────────────────────────────────────────────
  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();

    const nav = q
      ? NAV_COMMANDS.filter((c) => matches(`${c.label} ${c.keywords ?? ''}`, q))
      : NAV_COMMANDS;

    const engagements = (engagementsQuery.data ?? [])
      .filter((e) => !q || matches(e.jobTitle, q) || matches(e.id, q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX_ENGAGEMENT_RESULTS)
      .map<PaletteItem>((e) => ({
        id: `eng-${e.id}`,
        group: 'Engagements',
        label: e.jobTitle,
        hint: e.id,
        icon: Briefcase,
        href: `/dashboard/engagements/${e.id}`,
        engagement: e,
      }));

    return [...nav, ...engagements];
  }, [query, engagementsQuery.data]);

  // Keep the active index in range as results change.
  useEffect(() => {
    setActiveIndex((i) => (items.length === 0 ? 0 : Math.min(i, items.length - 1)));
  }, [items.length]);

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (!open) return;
    const el = document.getElementById(`${baseId}-option-${activeIndex}`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, baseId]);

  const select = useCallback(
    (item: PaletteItem | undefined) => {
      if (!item) return;
      setOpen(false);
      router.push(item.href);
    },
    [router],
  );

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((i) => (items.length ? (i + 1) % items.length : 0));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(Math.max(0, items.length - 1));
        break;
      case 'Enter':
        event.preventDefault();
        select(items[activeIndex]);
        break;
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'Tab':
        // The input is the only focus stop — keep focus trapped in the dialog.
        event.preventDefault();
        break;
    }
  }

  if (!open) return null;

  const loadingEngagements = engagementsQuery.isLoading && engagementsQuery.fetchStatus !== 'idle';

  let lastGroup: PaletteItem['group'] | null = null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={close} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-lg card shadow-xl overflow-hidden animate-slide-up"
      >
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-4 border-b border-gray-100">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={items.length ? optionId(activeIndex) : undefined}
            aria-label="Search engagements and commands"
            placeholder="Search engagements by title or ID, or jump to…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            className="flex-1 py-3.5 text-sm bg-transparent placeholder:text-gray-400 focus:outline-none"
          />
          {loadingEngagements && (
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" aria-hidden="true" />
          )}
          <kbd className="hidden sm:inline-flex text-[10px] font-medium text-gray-400 border border-gray-200 rounded-md px-1.5 py-0.5">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Results"
          className="max-h-80 overflow-y-auto py-2"
        >
          {items.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-gray-400" role="presentation">
              {loadingEngagements ? 'Loading engagements…' : `No results for “${query}”.`}
            </li>
          )}
          {items.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const active = index === activeIndex;
            const Icon = item.icon;
            return (
              <li key={item.id} role="presentation">
                {header && (
                  <p
                    className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400"
                    role="presentation"
                  >
                    {header}
                  </p>
                )}
                <div
                  id={optionId(index)}
                  role="option"
                  aria-selected={active}
                  onMouseMove={() => setActiveIndex(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(item)}
                  className={cn(
                    'mx-2 flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-sm',
                    active ? 'bg-brand-50 text-brand-700' : 'text-gray-700',
                  )}
                >
                  <Icon
                    className={cn('w-4 h-4 flex-shrink-0', active ? 'text-brand-600' : 'text-gray-400')}
                    aria-hidden="true"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-medium">{item.label}</span>
                    {item.hint && (
                      <span className="block truncate font-mono text-[11px] text-gray-400">
                        {item.hint}
                      </span>
                    )}
                  </span>
                  {item.engagement && (
                    <span className={cn(engagementStatusBadge(item.engagement.status), 'flex-shrink-0')}>
                      {engagementStatusLabel(item.engagement.status)}
                    </span>
                  )}
                  {active && (
                    <CornerDownLeft className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" aria-hidden="true" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Footer hints */}
        <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-t border-gray-100 text-[11px] text-gray-400">
          <span><kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> to navigate</span>
          <span><kbd className="font-sans">↵</kbd> to open</span>
          <span><kbd className="font-sans">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
