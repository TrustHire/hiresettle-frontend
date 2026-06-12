'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Briefcase, Search } from 'lucide-react';
import { engagementsApi } from '@/lib/api/services';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import { EngagementCard } from '@/components/engagements/EngagementCard';
import type { Engagement, EngagementStatus } from '@/types';

export default function EngagementsPage() {
  const { address } = useAuthStore();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EngagementStatus | ''>('');
  // Show engagements where user is company OR recruiter
  const [viewAs, setViewAs] = useState<'company' | 'recruiter'>('company');

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    const filter = viewAs === 'company'
      ? { companyAddress: address }
      : { recruiterAddress: address };

    engagementsApi
      .list({ ...filter, status: statusFilter || undefined })
      .then((res) => setEngagements(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [address, statusFilter, viewAs]);

  const filtered = engagements.filter((e) =>
    e.id.toLowerCase().includes(search.toLowerCase()) ||
    e.jobTitle.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Engagements</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {engagements.length} engagement{engagements.length !== 1 ? 's' : ''} found
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
          {(['company', 'recruiter'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setViewAs(role)}
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

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search ID or job title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as EngagementStatus | '')}
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
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-48 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-64 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-40" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">No engagements found</p>
          <p className="text-xs text-gray-400 mt-1">Create your first engagement to get started.</p>
          <Link href="/dashboard/engagements/create" className="btn-primary mt-4 inline-flex">
            <Plus className="w-4 h-4" />
            New engagement
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => (
            <EngagementCard key={e.id} engagement={e} />
          ))}
        </div>
      )}
    </div>
  );
}
