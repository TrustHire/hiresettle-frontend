'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Briefcase, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { engagementsApi } from '@/lib/api/services';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import { EngagementCard } from '@/components/engagements/EngagementCard';
import type { Engagement, EngagementStatus } from '@/types';

const DEBOUNCE_MS = 300;
const PAGE_SIZE   = 10;

type ViewAs = 'company' | 'recruiter' | 'arbiter';

export default function EngagementsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { address }  = useAuthStore();

  // Initialise all filter state from URL so views are shareable / survive refresh
  const initialSearch = searchParams.get('q')      ?? '';
  const initialStatus = (searchParams.get('status') ?? '') as EngagementStatus | '';
  const initialViewAs = (searchParams.get('viewAs') ?? 'company') as ViewAs;
  const initialPage   = Math.max(1, Number(searchParams.get('page') ?? '1'));

  const [inputValue,      setInputValue]      = useState(initialSearch);
  const [committedSearch, setCommittedSearch] = useState(initialSearch);
  const [statusFilter,    setStatusFilter]    = useState<EngagementStatus | ''>(initialStatus);
  const [viewAs,          setViewAs]          = useState<ViewAs>(initialViewAs);
  const [page,            setPage]            = useState(initialPage);

  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [total,       setTotal]       = useState(0);
  const [totalPages,  setTotalPages]  = useState(1);
  const [loading,     setLoading]     = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- URL sync helper ---
  const pushParams = useCallback(
    (q: string, status: EngagementStatus | '', role: ViewAs, p: number) => {
      const params = new URLSearchParams();
      if (q)               params.set('q',      q);
      if (status)          params.set('status', status);
      if (role !== 'company') params.set('viewAs', role);
      if (p > 1)           params.set('page',   String(p));
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    },
    [router],
  );

  // --- Search (debounced) ---
  const handleSearchChange = (value: string) => {
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCommittedSearch(value);
      setPage(1);
      pushParams(value, statusFilter, viewAs, 1);
    }, DEBOUNCE_MS);
  };

  const clearSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setInputValue('');
    setCommittedSearch('');
    setPage(1);
    pushParams('', statusFilter, viewAs, 1);
  };

  // --- Filter changes — always reset to page 1 ---
  const handleStatusChange = (value: EngagementStatus | '') => {
    setStatusFilter(value);
    setPage(1);
    pushParams(committedSearch, value, viewAs, 1);
  };

  const handleViewAsChange = (role: ViewAs) => {
    setViewAs(role);
    setPage(1);
    pushParams(committedSearch, statusFilter, role, 1);
  };

  // --- Pagination ---
  const goToPage = (p: number) => {
    setPage(p);
    pushParams(committedSearch, statusFilter, viewAs, p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // --- Data fetch ---
  useEffect(() => {
    if (!address) return;
    setLoading(true);

    const roleFilter =
      viewAs === 'company'   ? { companyAddress:  address } :
      viewAs === 'recruiter' ? { recruiterAddress: address } :
                               { arbiterAddress:   address };

    engagementsApi
      .list({
        ...roleFilter,
        status: statusFilter    || undefined,
        search: committedSearch || undefined,
        page,
        limit:  PAGE_SIZE,
      })
      .then((res) => {
        setEngagements(res.data);
        setTotal(res.meta.total);
        setTotalPages(res.meta.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [address, committedSearch, statusFilter, viewAs, page]);

  const isSearching = committedSearch.trim().length > 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Engagements</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? (
              <span className="inline-block w-24 h-3 bg-gray-100 rounded animate-pulse" />
            ) : (
              `${total} engagement${total !== 1 ? 's' : ''} found`
            )}
          </p>
        </div>
        <Link href="/dashboard/engagements/create" className="btn-primary">
          <Plus className="w-4 h-4" />
          New engagement
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {/* Role toggle */}
        <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden">
          {(['company', 'recruiter', 'arbiter'] as const).map((role) => (
            <button
              key={role}
              onClick={() => handleViewAsChange(role)}
              className={`px-3.5 py-2 text-xs font-medium transition-colors capitalize ${
                viewAs === role
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              As {role}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search ID or job title…"
            value={inputValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="input pl-9 pr-8"
          />
          {inputValue && (
            <button
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value as EngagementStatus | '')}
          className="input w-auto"
        >
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="ReplacementRequested">Replacement requested</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: PAGE_SIZE / 2 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-48 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-64 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-40" />
            </div>
          ))}
        </div>
      ) : engagements.length === 0 ? (
        <div className="card p-12 text-center">
          <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          {isSearching ? (
            <>
              <p className="text-sm font-medium text-gray-700">
                No results for &ldquo;{committedSearch}&rdquo;
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Try a different search term or clear the filter.
              </p>
              <button onClick={clearSearch} className="btn-secondary mt-4 inline-flex">
                <X className="w-4 h-4" />
                Clear search
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">No engagements found</p>
              <p className="text-xs text-gray-400 mt-1">
                {viewAs === 'arbiter'
                  ? 'You are not assigned as arbiter on any engagements.'
                  : 'Create your first engagement to get started.'}
              </p>
              {viewAs !== 'arbiter' && (
                <Link href="/dashboard/engagements/create" className="btn-primary mt-4 inline-flex">
                  <Plus className="w-4 h-4" />
                  New engagement
                </Link>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {engagements.map((e) => (
            <EngagementCard key={e.id} engagement={e} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-100">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </button>

          <span className="text-xs text-gray-500">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
