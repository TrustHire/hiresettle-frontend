// components/ui/Skeleton.tsx
//
// Skeleton loading primitives. Each composed skeleton mirrors the layout of the
// component it stands in for, so swapping skeleton → content causes no layout
// shift.

import { cn } from '@/lib/utils';

// ── Primitives ─────────────────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
}

/** A single pulsing placeholder block. Size and shape come from `className`. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded bg-gray-100', className)}
    />
  );
}

/** A pill-shaped placeholder, e.g. for status badges. */
export function SkeletonPill({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-5 w-16 rounded-full', className)} />;
}

/** A circular placeholder, e.g. for avatars or status dots. */
export function SkeletonCircle({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-8 w-8 rounded-full', className)} />;
}

/** Wraps a group of skeletons and announces the loading state to screen readers. */
export function SkeletonGroup({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className={className}>
      {children}
      <span className="sr-only">{label}</span>
    </div>
  );
}

// ── Composed skeletons ─────────────────────────────────────────────────────────

/** Mirrors `EngagementCard`. */
export function EngagementCardSkeleton() {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Skeleton className="h-4 w-48 max-w-[60%] bg-gray-200" />
            <SkeletonPill />
          </div>
          <div className="flex items-center gap-3 mt-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end">
          <Skeleton className="h-4 w-20 bg-gray-200 mb-1.5" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="w-full h-1.5 rounded-full mb-2" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}

/** A list of `EngagementCardSkeleton`s for the engagements page. */
export function EngagementListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <SkeletonGroup label="Loading engagements" className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <EngagementCardSkeleton key={i} />
      ))}
    </SkeletonGroup>
  );
}

/** Mirrors the engagement detail page: header, progress, milestones and meta. */
export function EngagementDetailSkeleton() {
  return (
    <SkeletonGroup label="Loading engagement">
      {/* Back link */}
      <Skeleton className="h-4 w-32 mb-5" />

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <Skeleton className="h-6 w-56 max-w-[60vw] bg-gray-200" />
            <SkeletonPill />
            <SkeletonPill className="w-20" />
          </div>
          <Skeleton className="h-4 w-40 mb-1.5" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-xl" />
        </div>
      </div>

      {/* Progress card */}
      <div className="card p-5">
        <div className="grid grid-cols-3 gap-4 mb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-6 w-24 max-w-full bg-gray-200" />
            </div>
          ))}
        </div>
        <Skeleton className="h-14 w-full rounded-lg mb-4" />
        <Skeleton className="w-full h-2 rounded-full" />
      </div>

      {/* Milestones */}
      <div className="mt-5">
        <Skeleton className="h-4 w-24 mb-3" />
        <div className="card divide-y divide-gray-50">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-5 flex items-start gap-4">
              <SkeletonCircle />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-4 w-40 max-w-[50%] bg-gray-200" />
                  <SkeletonPill />
                </div>
                <Skeleton className="h-3 w-64 max-w-[80%] mb-1.5" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-16 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Meta */}
      <div className="mt-5 card p-5">
        <Skeleton className="h-4 w-28 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-20 mb-1.5" />
              <Skeleton className="h-3.5 w-40 max-w-full" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonGroup>
  );
}

/** Mirrors a row in the dispute queue. */
export function DisputeRowSkeleton() {
  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <Skeleton className="w-8 h-8 rounded-xl flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-48 max-w-[70%] bg-gray-200 mb-1.5" />
            <Skeleton className="h-3 w-40 max-w-[60%]" />
          </div>
          <SkeletonPill className="w-14 h-4" />
        </div>
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

/** A card of `DisputeRowSkeleton`s for the disputes page. */
export function DisputeListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <SkeletonGroup label="Loading disputes" className="card divide-y divide-gray-50">
      {Array.from({ length: count }).map((_, i) => (
        <DisputeRowSkeleton key={i} />
      ))}
    </SkeletonGroup>
  );
}

/** Mirrors `EventRow` on the chain events page. */
export function EventRowSkeleton() {
  return (
    <div className="p-4 flex items-center gap-4 flex-wrap">
      <SkeletonPill className="w-28" />
      <Skeleton className="h-3.5 w-36" />
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-3.5 w-28" />
      <Skeleton className="h-3.5 w-16 ml-auto" />
    </div>
  );
}

/** A card of `EventRowSkeleton`s for the chain events page. */
export function EventListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <SkeletonGroup label="Loading events" className="card divide-y divide-gray-50">
      {Array.from({ length: count }).map((_, i) => (
        <EventRowSkeleton key={i} />
      ))}
    </SkeletonGroup>
  );
}
