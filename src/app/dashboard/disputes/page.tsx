"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Scale, Clock, Briefcase } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { engagementsApi } from "@/lib/api/services";
import { useAuthStore } from "@/lib/hooks/use-auth-store";
import { engagementKeys } from "@/lib/query-keys";
import { DisputeListSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { timeAgo, shortAddress } from "@/lib/utils";
import type { Engagement, Milestone } from "@/types";

interface DisputeRow {
  engagement: Engagement;
  milestone: Milestone;
}

export default function DisputesPage() {
  const { address, isHydrated } = useAuthStore();
  const filters = { arbiterAddress: address ?? undefined, limit: 200 };
  const disputesQuery = useQuery({
    queryKey: engagementKeys.list(filters),
    queryFn: () => engagementsApi.list(filters),
    enabled: isHydrated && !!address,
  });
  const rows = useMemo(() => {
    const disputed: DisputeRow[] = [];
    for (const engagement of disputesQuery.data?.data ?? []) {
      for (const milestone of engagement.milestones ?? []) {
        if (milestone.status === "Disputed") {
          disputed.push({ engagement, milestone });
        }
      }
    }
    return disputed.sort(
      (a, b) =>
        new Date(a.milestone.updatedAt).getTime() -
        new Date(b.milestone.updatedAt).getTime(),
    );
  }, [disputesQuery.data]);
  const loading = !isHydrated || disputesQuery.isLoading;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dispute queue</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {loading ? (
            <Skeleton className="inline-block w-48 h-3 align-middle" />
          ) : (
            `${rows.length} open dispute${rows.length !== 1 ? "s" : ""} awaiting review`
          )}
        </p>
      </div>

      {loading ? (
        <DisputeListSkeleton />
      ) : disputesQuery.isError ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-red-600">Failed to load disputes.</p>
          <button
            onClick={() => disputesQuery.refetch()}
            className="btn-secondary mt-4"
          >
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-12 text-center">
          <Scale className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">No open disputes</p>
          <p className="text-xs text-gray-400 mt-1">
            You have no disputed milestones to review right now.
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-50">
          {rows.map(({ engagement, milestone }) => (
            <Link
              key={milestone.id}
              href={`/dashboard/engagements/${engagement.id}`}
              className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
            >
              {/* Icon */}
              <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Scale className="w-4 h-4 text-red-500" />
              </div>

              {/* Details */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-brand-700 transition-colors">
                      {engagement.jobTitle}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Milestone {milestone.milestoneIndex + 1} —{" "}
                      {milestone.name}
                    </p>
                  </div>
                  <span className="badge bg-red-50 text-red-700 flex-shrink-0 text-[10px]">
                    Disputed
                  </span>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                    <Briefcase className="w-3 h-3" />
                    {engagement.id}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                    Company: {shortAddress(engagement.companyAddress)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                    Recruiter: {shortAddress(engagement.recruiterAddress)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                    <Clock className="w-3 h-3" />
                    Open {timeAgo(milestone.updatedAt)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
