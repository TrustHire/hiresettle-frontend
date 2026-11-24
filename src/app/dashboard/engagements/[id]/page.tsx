'use client';

import { useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, Loader2, AlertTriangle, Copy, Share2 } from 'lucide-react';
import Link from 'next/link';
import axios from 'axios';
import { engagementsApi } from '@/lib/api/services';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import { engagementKeys, timerKeys } from '@/lib/query-keys';
import { MilestoneTimeline } from '@/components/milestones/MilestoneTimeline';
import { EngagementMeta } from '@/components/engagements/EngagementMeta';
import { EngagementProgress } from '@/components/engagements/EngagementProgress';
import { ReplacementBanner } from '@/components/engagements/ReplacementBanner';
import { ChainEventFeed } from '@/components/engagements/ChainEventFeed';
import { ShareEngagementModal } from '@/components/engagements/ShareEngagementModal';
import {
  engagementStatusBadge,
  engagementStatusLabel,
  timeAgo,
} from "@/lib/utils";
import { toReadableError } from "@/lib/utils/toast-error";

export default function EngagementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { address } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const engagementQuery = useQuery({
    queryKey: engagementKeys.detail(id),
    queryFn: () => engagementsApi.get(id),
    enabled: !!id,
    retry: false,
  });
  const engagement = engagementQuery.data;
  const loading = engagementQuery.isLoading;
  const error = engagementQuery.isError
    ? toReadableError(engagementQuery.error)
    : null;
  const notFound =
    engagementQuery.isError &&
    ((axios.isAxiosError(engagementQuery.error) &&
      engagementQuery.error.response?.status === 404) ||
      (engagementQuery.error as { response?: { status?: number } })?.response
        ?.status === 404 ||
      (engagementQuery.error as { status?: number })?.status === 404);
  const load = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: engagementKeys.all }),
      queryClient.invalidateQueries({ queryKey: timerKeys.all }),
    ]);
  }, [queryClient]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await engagementsApi.sync(id);
      await load();
    } finally {
      setSyncing(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );

  if (notFound)
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Engagement not found.</p>
        <Link
          href="/dashboard/engagements"
          className="btn-secondary mt-4 inline-flex"
        >
          Back to engagements
        </Link>
      </div>
    );

  if (error || !engagement)
    return (
      <div>
        <Link
          href="/dashboard/engagements"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All engagements
        </Link>
        <div className="card p-12 text-center max-w-lg mx-auto">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-gray-900 mb-1">
            Failed to load engagement
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {error ||
              "An unexpected error occurred while loading this engagement."}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => engagementQuery.refetch()}
              className="btn-primary inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
            <Link
              href="/dashboard/engagements"
              className="btn-secondary inline-flex"
            >
              Back to engagements
            </Link>
          </div>
        </div>
      </div>
    );

  // Detect user role
  const isCompany = address === engagement.companyAddress;
  const isRecruiter = address === engagement.recruiterAddress;
  const isArbiter = address === engagement.arbiterAddress;
  const userRole = isCompany
    ? "company"
    : isRecruiter
      ? "recruiter"
      : isArbiter
        ? "arbiter"
        : "observer";

  return (
    <div>
      <Link
        href="/dashboard/engagements"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All engagements
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 font-mono">
              {engagement.id}
            </h1>
            <span className={engagementStatusBadge(engagement.status)}>
              {engagementStatusLabel(engagement.status)}
            </span>
            <span
              className={`badge ${
                userRole === "company"
                  ? "badge-company"
                  : userRole === "recruiter"
                    ? "badge-recruiter"
                    : userRole === "arbiter"
                      ? "badge-arbiter"
                      : "badge-pending"
              } capitalize`}
            >
              {userRole}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-700">
            {engagement.jobTitle}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Created {timeAgo(engagement.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isCompany && (
            <button
              onClick={() => router.push(`/dashboard/engagements/create?cloneFrom=${engagement.id}`)}
              className="btn-secondary text-xs"
              title="Clone this engagement"
            >
              <Copy className="w-3.5 h-3.5" />
              Clone
            </button>
          )}
          <button
            onClick={() => setShareOpen(true)}
            className="btn-secondary text-xs"
            title="Share a link or QR code for this engagement"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-secondary text-xs"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Sync
          </button>
        </div>
      </div>

      <ShareEngagementModal
        engagementId={engagement.id}
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
      />

      {/* Replacement banner */}
      {engagement.status === "ReplacementRequested" && (
        <ReplacementBanner
          engagement={engagement}
          userRole={userRole}
          onUpdate={load}
        />
      )}

      {/* Progress */}
      <EngagementProgress engagement={engagement} onSync={handleSync} />

      {/* Milestones */}
      <div className="mt-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Milestones</h2>
        <MilestoneTimeline
          engagement={engagement}
          userRole={userRole}
          onUpdate={load}
        />
      </div>

      {/* Meta */}
      <div className="mt-5">
        <EngagementMeta engagement={engagement} />
      </div>

      {/* On-chain activity feed */}
      {engagement.events && engagement.events.length > 0 && (
        <div className="mt-5">
          <ChainEventFeed events={engagement.events} />
        </div>
      )}
    </div>
  );
}
