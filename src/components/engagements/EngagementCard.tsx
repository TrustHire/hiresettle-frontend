// components/engagements/EngagementCard.tsx
'use client';

import Link from 'next/link';
import { ArrowRight, MapPin, DollarSign } from 'lucide-react';
import {
  engagementStatusBadge, engagementStatusLabel,
  stroopsToUsdc, timeAgo, engagementProgress,
} from '@/lib/utils';
import type { Engagement } from '@/types';

export function EngagementCard({ engagement: e }: { engagement: Engagement }) {
  const progress     = engagementProgress(e.milestones);
  const totalUsdc    = stroopsToUsdc(e.totalAmount);
  const releasedUsdc = stroopsToUsdc(e.releasedAmount);

  return (
    <Link href={`/dashboard/engagements/${e.id}`}>
      <div className="card p-4 sm:p-5 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group">
        {/* Header row — stacks on very narrow screens */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-semibold text-gray-900 break-words">{e.jobTitle}</span>
              <span className={engagementStatusBadge(e.status)}>
                {engagementStatusLabel(e.status)}
              </span>
            </div>
            {/* Meta — wrap naturally on narrow widths */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
              <span className="font-mono truncate max-w-[9rem]">{e.id}</span>
              {e.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {e.location}
                </span>
              )}
              <span>{timeAgo(e.createdAt)}</span>
            </div>
          </div>

          {/* Amount — always right-aligned, never shrinks below content */}
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-1 justify-end">
              <DollarSign className="w-3.5 h-3.5 text-brand-600" />
              {totalUsdc}
            </p>
            <p className="text-xs text-gray-400">${releasedUsdc} released</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
          <div
            className="bg-brand-600 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {e.milestones.filter((m) => m.status === 'Confirmed' || m.status === 'Resolved').length}
            /{e.milestones.length} milestones complete
          </p>
          <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-600 transition-colors" />
        </div>
      </div>
    </Link>
  );
}
