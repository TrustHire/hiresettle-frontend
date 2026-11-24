"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useAuthStore } from "@/lib/hooks/use-auth-store";
import { useParticipantEngagements } from "@/lib/hooks/use-participant-engagements";
import { CalendarMenu } from "@/components/milestones/MilestoneTimeline";
import { cn, milestoneStatusBadge, milestoneStatusLabel } from "@/lib/utils";
import type { Engagement, Milestone } from "@/types";

interface UnlockEntry {
  engagement: Engagement;
  milestone: Milestone;
  date: Date;
}

const EMPTY_ENGAGEMENTS: Engagement[] = [];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_PER_DAY = 2;

export default function UnlockCalendarPage() {
  const { address, isHydrated } = useAuthStore();
  const query = useParticipantEngagements();
  const engagements = query.data ?? EMPTY_ENGAGEMENTS;
  const loading = !isHydrated || (!!address && query.isLoading);

  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  // All retention milestones that are still waiting to unlock.
  const entries = useMemo<UnlockEntry[]>(() => {
    const result: UnlockEntry[] = [];
    for (const engagement of engagements) {
      for (const milestone of engagement.milestones ?? []) {
        if (
          milestone.kind !== "Retention" ||
          !milestone.unlockEstimatedAt ||
          (milestone.status !== "Locked" && milestone.status !== "Pending")
        ) {
          continue;
        }
        const date = new Date(milestone.unlockEstimatedAt);
        if (Number.isNaN(date.getTime())) continue;
        result.push({ engagement, milestone, date });
      }
    }
    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [engagements]);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month)),
        end: endOfWeek(endOfMonth(month)),
      }),
    [month],
  );

  const monthEntries = entries.filter((e) => isSameMonth(e.date, month));
  const nextUpcoming = entries.find((e) => e.date.getTime() >= Date.now());

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading calendar…</span>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex gap-3">
        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700">
          {query.error.message || "Failed to load engagements."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">
          Unlock calendar
        </h1>
        <p className="text-sm text-gray-500">
          Retention milestones across all your engagements, by estimated unlock
          date.
          {nextUpcoming && (
            <>
              {" "}
              Next unlock:{" "}
              <button
                type="button"
                onClick={() => setMonth(startOfMonth(nextUpcoming.date))}
                className="font-medium text-brand-700 hover:underline"
              >
                {format(nextUpcoming.date, "MMM d, yyyy")}
              </button>
              .
            </>
          )}
        </p>
      </div>

      <div className="card p-4 sm:p-5">
        {/* Month navigation */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-900" aria-live="polite">
            {format(month, "MMMM yyyy")}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, -1))}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setMonth(startOfMonth(new Date()))}
              className="btn-ghost text-xs px-3 py-1.5"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-7 text-[10px] sm:text-xs font-medium text-gray-400 mb-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-1 py-1 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
          {days.map((day) => {
            const dayEntries = monthEntries.filter((e) => isSameDay(e.date, day));
            const inMonth = isSameMonth(day, month);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[4.5rem] sm:min-h-[6rem] p-1 sm:p-1.5 flex flex-col gap-1 min-w-0",
                  inMonth ? "bg-white" : "bg-gray-50",
                )}
              >
                <span
                  className={cn(
                    "text-[10px] sm:text-xs w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center",
                    isToday(day)
                      ? "bg-brand-600 text-white font-semibold"
                      : inMonth
                        ? "text-gray-700"
                        : "text-gray-300",
                  )}
                >
                  {format(day, "d")}
                </span>
                {dayEntries.slice(0, MAX_PER_DAY).map((entry) => (
                  <Link
                    key={entry.milestone.id}
                    href={`/dashboard/engagements/${entry.engagement.id}`}
                    title={`${entry.engagement.jobTitle} — ${entry.milestone.name}`}
                    className={cn(
                      "block truncate rounded-md px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs font-medium transition-colors",
                      entry.milestone.status === "Pending"
                        ? "bg-green-50 text-green-700 hover:bg-green-100"
                        : "bg-amber-50 text-amber-700 hover:bg-amber-100",
                    )}
                  >
                    {entry.engagement.jobTitle}
                  </Link>
                ))}
                {dayEntries.length > MAX_PER_DAY && (
                  <span className="text-[10px] text-gray-400 px-1">
                    +{dayEntries.length - MAX_PER_DAY} more
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Entries for the month — with calendar export */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Unlocks in {format(month, "MMMM")}
          </h2>
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
            {monthEntries.length}
          </span>
        </div>
        {monthEntries.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CalendarDays className="w-5 h-5 text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">
              No retention milestones unlock this month.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {monthEntries.map((entry) => (
              <li
                key={entry.milestone.id}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <div className="w-10 text-center flex-shrink-0">
                  <p className="text-[10px] uppercase text-gray-400">
                    {format(entry.date, "MMM")}
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {format(entry.date, "d")}
                  </p>
                </div>
                <Link
                  href={`/dashboard/engagements/${entry.engagement.id}`}
                  className="flex-1 min-w-0 group"
                >
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-brand-700 transition-colors">
                    {entry.milestone.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {entry.engagement.jobTitle} ·{" "}
                    <span className="font-mono">{entry.engagement.id}</span>
                  </p>
                </Link>
                <span className={milestoneStatusBadge(entry.milestone.status)}>
                  {milestoneStatusLabel(entry.milestone.status)}
                </span>
                <CalendarMenu
                  unlockDate={entry.date}
                  title={`Retention unlock: ${entry.engagement.jobTitle}`}
                  description={`The "${entry.milestone.name}" retention milestone for ${entry.engagement.jobTitle} (${entry.engagement.id}) is estimated to unlock.`}
                  engagementId={entry.engagement.id}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
