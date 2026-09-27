'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { engagementsApi } from '@/lib/api/services';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import { MilestoneTimeline } from '@/components/milestones/MilestoneTimeline';
import { EngagementMeta } from '@/components/engagements/EngagementMeta';
import { EngagementProgress } from '@/components/engagements/EngagementProgress';
import { ReplacementBanner } from '@/components/engagements/ReplacementBanner';
import { ChainEventFeed } from '@/components/engagements/ChainEventFeed';
import {
  engagementStatusBadge, engagementStatusLabel, timeAgo,
} from '@/lib/utils';
import type { Engagement } from '@/types';

export default function EngagementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { address } = useAuthStore();
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    try {
      const data = await engagementsApi.get(id);
      setEngagement(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleSync = async () => {
    setSyncing(true);
    try { await engagementsApi.sync(id); await load(); }
    finally { setSyncing(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
    </div>
  );

  if (!engagement) return (
    <div className="text-center py-16">
      <p className="text-gray-500">Engagement not found.</p>
      <Link href="/dashboard/engagements" className="btn-secondary mt-4 inline-flex">
        Back to engagements
      </Link>
    </div>
  );

  // Detect user role
  const isCompany   = address === engagement.companyAddress;
  const isRecruiter = address === engagement.recruiterAddress;
  const isArbiter   = address === engagement.arbiterAddress;
  const userRole = isCompany ? 'company' : isRecruiter ? 'recruiter' : isArbiter ? 'arbiter' : 'observer';

  return (
    <div>
      <Link href="/dashboard/engagements"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        All engagements
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 font-mono">{engagement.id}</h1>
            <span className={engagementStatusBadge(engagement.status)}>
              {engagementStatusLabel(engagement.status)}
            </span>
            <span className={`badge ${
              userRole === 'company'   ? 'badge-company' :
              userRole === 'recruiter' ? 'badge-recruiter' :
              userRole === 'arbiter'   ? 'badge-arbiter' : 'badge-pending'
            } capitalize`}>
              {userRole}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-700">{engagement.jobTitle}</p>
          <p className="text-xs text-gray-400 mt-0.5">Created {timeAgo(engagement.createdAt)}</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="btn-secondary text-xs"
        >
          {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Sync
        </button>
      </div>

      {/* Replacement banner */}
      {engagement.status === 'ReplacementRequested' && (
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
