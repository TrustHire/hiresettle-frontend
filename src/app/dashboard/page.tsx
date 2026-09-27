'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  DollarSign, TrendingUp, Briefcase, Scale,
  Clock, AlertCircle, ChevronRight, Loader2,
} from 'lucide-react';
import { engagementsApi } from '@/lib/api/services';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import { stroopsToUsdc, formatDate, cn } from '@/lib/utils';
import type { Engagement, Milestone, UserRole } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────────

interface UpcomingUnlock {
  engagement: Engagement;
  milestone: Milestone;
  daysUntil: number;
  unlockDate: string;
}

interface ActionItem {
  engagement: Engagement;
  milestone: Milestone;
  label: string;
  kind: 'proof' | 'unlock' | 'dispute';
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysFromNow(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function bigintAdd(a: string, b: string): bigint {
  try { return BigInt(a) + BigInt(b); } catch { return BigInt(0); }
}

function actionKindForRole(
  milestone: Milestone,
  role: UserRole | undefined,
): { label: string; kind: ActionItem['kind'] } | null {
  const { status, kind } = milestone;

  // Unlockable retention milestone — any role can trigger
  if (kind === 'Retention' && status === 'Pending') {
    return { label: 'Ready to unlock', kind: 'unlock' };
  }

  switch (role) {
    case 'COMPANY':
      if (status === 'ProofSubmitted') return { label: 'Review proof', kind: 'proof' };
      break;
    case 'RECRUITER':
      if (status === 'Pending' && kind === 'Placement')
        return { label: 'Submit proof', kind: 'proof' };
      break;
    case 'ARBITER':
      if (status === 'Disputed') return { label: 'Resolve dispute', kind: 'dispute' };
      break;
    case 'ADMIN':
      if (status === 'Disputed') return { label: 'Resolve dispute', kind: 'dispute' };
      if (status === 'ProofSubmitted') return { label: 'Review proof', kind: 'proof' };
      break;
  }
  return null;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-xl font-semibold text-gray-900 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {count !== undefined && (
        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-gray-400 py-4 text-center">{message}</p>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardOverviewPage() {
  const { address, user } = useAuthStore();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    setError(null);

    // Fetch all engagements where the user is a participant. For roles that
    // appear as multiple parties we fire parallel requests and deduplicate.
    const queries: Promise<Engagement[]>[] = [];

    if (!user?.role || user.role === 'COMPANY') {
      queries.push(
        engagementsApi.list({ companyAddress: address, limit: 200 }).then((r) => r.data),
      );
    }
    if (!user?.role || user.role === 'RECRUITER') {
      queries.push(
        engagementsApi.list({ recruiterAddress: address, limit: 200 }).then((r) => r.data),
      );
    }
    if (user?.role === 'ARBITER' || user?.role === 'ADMIN') {
      // Arbiter address isn't a filter the API exposes, so fetch all active
      // engagements and filter client-side.
      queries.push(
        engagementsApi.list({ limit: 200 }).then((r) =>
          r.data.filter((e) => e.arbiterAddress === address),
        ),
      );
    }
    if (queries.length === 0) {
      // Fallback: fetch all
      queries.push(engagementsApi.list({ limit: 200 }).then((r) => r.data));
    }

    Promise.all(queries)
      .then((results) => {
        // Deduplicate by id
        const map = new Map<string, Engagement>();
        results.flat().forEach((e) => map.set(e.id, e));
        setEngagements([...map.values()]);
      })
      .catch((err) => setError(err?.message ?? 'Failed to load data.'))
      .finally(() => setLoading(false));
  }, [address, user?.role]);

  // ── Derived stats ────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    let totalEscrow = BigInt(0);
    let totalReleased = BigInt(0);
    let activeCount = 0;
    let disputeCount = 0;

    for (const eng of engagements) {
      // In-escrow = totalAmount − releasedAmount
      const total    = BigInt(eng.totalAmount    ?? '0');
      const released = BigInt(eng.releasedAmount ?? '0');
      totalEscrow   += total - released;
      totalReleased += released;

      if (eng.status === 'Active') activeCount++;

      const hasDispute = eng.milestones?.some((m) => m.status === 'Disputed');
      if (hasDispute) disputeCount++;
    }

    return { totalEscrow, totalReleased, activeCount, disputeCount };
  }, [engagements]);

  // ── Upcoming unlocks (next 14 days) ─────────────────────────────────────────

  const upcomingUnlocks = useMemo<UpcomingUnlock[]>(() => {
    const result: UpcomingUnlock[] = [];
    const cutoff = Date.now() + 14 * 24 * 60 * 60 * 1000;

    for (const eng of engagements) {
      for (const ms of eng.milestones ?? []) {
        if (
          ms.kind === 'Retention' &&
          ms.status === 'Locked' &&
          ms.unlockEstimatedAt
        ) {
          const unlockTs = new Date(ms.unlockEstimatedAt).getTime();
          if (unlockTs > Date.now() && unlockTs <= cutoff) {
            result.push({
              engagement: eng,
              milestone: ms,
              daysUntil: daysFromNow(ms.unlockEstimatedAt),
              unlockDate: ms.unlockEstimatedAt,
            });
          }
        }
      }
    }

    return result.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [engagements]);

  // ── Action required ──────────────────────────────────────────────────────────

  const actionItems = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];

    for (const eng of engagements) {
      if (eng.status !== 'Active') continue;
      for (const ms of eng.milestones ?? []) {
        const action = actionKindForRole(ms, user?.role);
        if (action) {
          items.push({ engagement: eng, milestone: ms, ...action });
        }
      }
    }

    // Sort: disputes first, then proofs, then unlocks
    const priority: Record<ActionItem['kind'], number> = { dispute: 0, proof: 1, unlock: 2 };
    return items.sort((a, b) => priority[a.kind] - priority[b.kind]);
  }, [engagements, user?.role]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading overview…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex gap-3">
        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Overview</h1>
        <p className="text-sm text-gray-500">
          {engagements.length === 0
            ? 'No engagements yet.'
            : `Summary across ${engagements.length} engagement${engagements.length === 1 ? '' : 's'}.`}
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="USDC in escrow"
          value={`$${stroopsToUsdc(stats.totalEscrow.toString())}`}
          icon={DollarSign}
          color="bg-brand-50 text-brand-600"
        />
        <StatCard
          label="Total released"
          value={`$${stroopsToUsdc(stats.totalReleased.toString())}`}
          icon={TrendingUp}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          label="Active engagements"
          value={String(stats.activeCount)}
          sub={engagements.length > 0 ? `${engagements.length} total` : undefined}
          icon={Briefcase}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Open disputes"
          value={String(stats.disputeCount)}
          icon={Scale}
          color={stats.disputeCount > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-400'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Action required ── */}
        <div className="card p-5">
          <SectionHeader title="Action required" count={actionItems.length} />
          {actionItems.length === 0 ? (
            <EmptyState message="Nothing needs your attention right now." />
          ) : (
            <ul className="divide-y divide-gray-50">
              {actionItems.map((item, i) => (
                <li key={i}>
                  <Link
                    href={`/dashboard/engagements/${item.engagement.id}`}
                    className="flex items-center gap-3 py-3 hover:bg-gray-50 -mx-5 px-5 rounded-xl transition-colors group"
                  >
                    {/* Kind indicator */}
                    <span className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      item.kind === 'dispute' ? 'bg-red-500' :
                      item.kind === 'proof'   ? 'bg-amber-500' :
                                                'bg-green-500',
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.milestone.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {item.engagement.jobTitle}
                      </p>
                    </div>
                    <span className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0',
                      item.kind === 'dispute' ? 'bg-red-50 text-red-700' :
                      item.kind === 'proof'   ? 'bg-amber-50 text-amber-700' :
                                                'bg-green-50 text-green-700',
                    )}>
                      {item.label}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Upcoming unlocks ── */}
        <div className="card p-5">
          <SectionHeader title="Upcoming unlocks" count={upcomingUnlocks.length} />
          {upcomingUnlocks.length === 0 ? (
            <EmptyState message="No retention milestones unlocking in the next 14 days." />
          ) : (
            <ul className="divide-y divide-gray-50">
              {upcomingUnlocks.map((item, i) => (
                <li key={i}>
                  <Link
                    href={`/dashboard/engagements/${item.engagement.id}`}
                    className="flex items-center gap-3 py-3 hover:bg-gray-50 -mx-5 px-5 rounded-xl transition-colors group"
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold',
                      item.daysUntil <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700',
                    )}>
                      {item.daysUntil}d
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.milestone.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {item.engagement.jobTitle} · unlocks {formatDate(item.unlockDate)}
                      </p>
                    </div>
                    <Clock className={cn(
                      'w-3.5 h-3.5 flex-shrink-0',
                      item.daysUntil <= 3 ? 'text-amber-400' : 'text-gray-300',
                    )} />
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
