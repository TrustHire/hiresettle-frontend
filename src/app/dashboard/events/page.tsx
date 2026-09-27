'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity, Search, ChevronLeft, ChevronRight,
  ExternalLink, AlertTriangle, Loader2,
} from 'lucide-react';
import { eventsApi } from '@/lib/api/services';
import { timeAgo, shortAddress } from '@/lib/utils';
import type { ChainEvent } from '@/types';

const PAGE_SIZE = 20;

const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';
const txUrl = (hash: string) =>
  NETWORK === 'mainnet'
    ? `https://stellar.expert/explorer/public/tx/${hash}`
    : `https://stellar.expert/explorer/testnet/tx/${hash}`;

// Colour-code event names so the table is scannable at a glance
function eventPillClass(name: string): string {
  if (/confirm|release/i.test(name)) return 'bg-green-50 text-green-700';
  if (/dispute/i.test(name))         return 'bg-red-50 text-red-700';
  if (/resolve/i.test(name))         return 'bg-purple-50 text-purple-700';
  if (/proof/i.test(name))           return 'bg-amber-50 text-amber-700';
  if (/replace/i.test(name))         return 'bg-orange-50 text-orange-700';
  if (/cancel/i.test(name))          return 'bg-gray-100 text-gray-600';
  return 'bg-sky-50 text-sky-700';
}

export default function ChainEventsPage() {
  const [events, setEvents]     = useState<ChainEvent[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

  // Debounce search input 350 ms
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await eventsApi.list({
        engagementId: debouncedSearch || undefined,
        page,
        limit: PAGE_SIZE,
      });
      // API returns newest-first if the backend sorts by ledger desc;
      // sort client-side too in case it doesn't
      const sorted = [...(res.data ?? res)].sort(
        (a: ChainEvent, b: ChainEvent) => b.ledger - a.ledger,
      );
      setEvents(sorted);
      setTotal(res.meta?.total ?? sorted.length);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Chain Events</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            On-chain activity recorded from the HireSettle contract
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by engagement ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        {!loading && !error && (
          <p className="text-xs text-gray-400 ml-auto">
            {total} event{total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* States */}
      {error ? (
        <div className="card p-12 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">Failed to load events</p>
          <p className="text-xs text-gray-400 mt-1">Check your connection and try again.</p>
          <button onClick={load} className="btn-secondary mt-4">
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="card divide-y divide-gray-50">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
              <div className="h-5 w-32 bg-gray-100 rounded-full" />
              <div className="h-4 w-28 bg-gray-100 rounded" />
              <div className="h-4 w-20 bg-gray-100 rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="card p-12 text-center">
          <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">No events found</p>
          <p className="text-xs text-gray-400 mt-1">
            {debouncedSearch
              ? `No events match engagement "${debouncedSearch}".`
              : 'Chain events will appear here once transactions are recorded.'}
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-50">
          {events.map((ev) => (
            <EventRow key={ev.id} event={ev} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary text-xs disabled:opacity-40"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </button>
          <span className="text-xs text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-secondary text-xs disabled:opacity-40"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function EventRow({ event: ev }: { event: ChainEvent }) {
  return (
    <div className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors flex-wrap">
      {/* Event name */}
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0 ${eventPillClass(ev.eventName)}`}>
        {ev.eventName}
      </span>

      {/* Engagement ID → detail page */}
      {ev.engagementId ? (
        <Link
          href={`/dashboard/engagements/${ev.engagementId}`}
          className="text-xs font-mono text-brand-600 hover:underline flex-shrink-0"
        >
          {ev.engagementId}
        </Link>
      ) : (
        <span className="text-xs font-mono text-gray-400">—</span>
      )}

      {/* Ledger */}
      <span className="text-xs text-gray-500 flex-shrink-0">
        Ledger <span className="font-mono text-gray-700">{ev.ledger.toLocaleString()}</span>
      </span>

      {/* Tx hash → explorer */}
      <a
        href={txUrl(ev.txHash)}
        target="_blank"
        rel="noreferrer"
        className="text-xs font-mono text-gray-400 hover:text-brand-600 flex items-center gap-1 flex-shrink-0 transition-colors"
      >
        {shortAddress(ev.txHash, 5)}
        <ExternalLink className="w-3 h-3" />
      </a>

      {/* Timestamp */}
      <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
        {timeAgo(ev.createdAt)}
      </span>
    </div>
  );
}
