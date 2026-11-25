"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Wallet,
  Lock,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Info,
} from "lucide-react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { engagementsApi, eventsApi } from "@/lib/api/services";
import { useAuthStore } from "@/lib/hooks/use-auth-store";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { earningsKeys } from "@/lib/query-keys";
import {
  stroopsToUsdc,
  formatDate,
  shortAddress,
  explorerTxUrl,
} from "@/lib/utils";
import type { ChainEvent, Engagement, Milestone } from "@/types";

/** Engagement statuses that can still release escrowed funds to the recruiter. */
const OPEN_STATUSES: Engagement["status"][] = ["Active", "ReplacementRequested"];

/** On-chain events that release a milestone payment to the recruiter. */
const PAYOUT_EVENTS = new Set(["MilestoneConfirmed", "DisputeResolved", "PaymentReleased"]);

interface Payout {
  engagement: Engagement;
  milestone: Milestone;
  amount: bigint;
  releasedAt: string;
}

function safeBigInt(value: string | null | undefined): bigint {
  try {
    return value ? BigInt(value) : 0n;
  } catch {
    return 0n;
  }
}

/** Read the milestone index from an event payload, whatever casing the indexer used. */
function payloadMilestoneIndex(payload: Record<string, unknown>): number | null {
  const raw = payload?.milestoneIndex ?? payload?.milestone_index ?? payload?.index;
  const n = typeof raw === "string" ? Number(raw) : raw;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Find the transaction that released a given milestone's payment. */
function findPayoutTx(events: ChainEvent[] | undefined, milestone: Milestone): string | null {
  if (!events) return null;
  const matches = events
    .filter(
      (e) =>
        PAYOUT_EVENTS.has(e.eventName) &&
        payloadMilestoneIndex(e.payload) === milestone.milestoneIndex,
    )
    .sort((a, b) => b.ledger - a.ledger);
  return matches[0]?.txHash ?? null;
}

export default function EarningsPage() {
  const { address, isHydrated } = useAuthStore();
  const { user } = useCurrentUser();

  const engagementsQuery = useQuery({
    queryKey: earningsKeys.recruiter(address ?? ""),
    queryFn: () => engagementsApi.listAll({ recruiterAddress: address ?? undefined }),
    enabled: isHydrated && !!address,
  });
  const engagements = useMemo(() => engagementsQuery.data ?? [], [engagementsQuery.data]);

  const { totalReleased, totalPending, payouts } = useMemo(() => {
    let released = 0n;
    let pending = 0n;
    const rows: Payout[] = [];

    for (const engagement of engagements) {
      const total = safeBigInt(engagement.totalAmount);
      const releasedAmount = safeBigInt(engagement.releasedAmount);
      released += releasedAmount;
      if (OPEN_STATUSES.includes(engagement.status) && total > releasedAmount) {
        pending += total - releasedAmount;
      }

      for (const milestone of engagement.milestones ?? []) {
        const amount = safeBigInt(milestone.paymentReleased);
        if (amount > 0n) {
          rows.push({
            engagement,
            milestone,
            amount,
            releasedAt: milestone.confirmedAt ?? milestone.updatedAt,
          });
        }
      }
    }

    rows.sort((a, b) => new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime());
    return { totalReleased: released, totalPending: pending, payouts: rows };
  }, [engagements]);

  // Chain events for engagements with payouts — used to link each payout to its transaction
  const payoutEngagementIds = useMemo(
    () => Array.from(new Set(payouts.map((p) => p.engagement.id))),
    [payouts],
  );
  const eventQueries = useQueries({
    queries: payoutEngagementIds.map((engagementId) => ({
      queryKey: earningsKeys.payoutEvents(engagementId),
      queryFn: () => eventsApi.list({ engagementId, limit: 200 }).then((res) => res.data),
      staleTime: 60 * 1000,
    })),
  });
  const eventsByEngagement: Record<string, ChainEvent[] | undefined> = {};
  payoutEngagementIds.forEach((id, i) => {
    eventsByEngagement[id] = eventQueries[i]?.data;
  });
  const eventsLoading = eventQueries.some((q) => q.isLoading);

  const loading = !isHydrated || engagementsQuery.isLoading;
  const isRecruiter = !user?.role || user.role === "RECRUITER";
  const openCount = engagements.filter((e) => OPEN_STATUSES.includes(e.status)).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Earnings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Your recruiter fees across every company you work with.
        </p>
      </div>

      {!isRecruiter && (
        <div className="card p-4 mb-5 flex items-start gap-2.5 bg-sky-50 border-sky-100">
          <Info className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-sky-800">
            This page shows payouts for engagements where your address is the recruiter.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
        </div>
      ) : engagementsQuery.isError ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-red-600">Failed to load earnings.</p>
          <button onClick={() => engagementsQuery.refetch()} className="btn-secondary mt-4">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <p className="text-xs font-medium text-gray-500">Total released</p>
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                ${stroopsToUsdc(totalReleased)}
                <span className="text-sm font-normal text-gray-400 ml-1">USDC</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {payouts.length} payout{payouts.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-amber-500" />
                <p className="text-xs font-medium text-gray-500">Pending in escrow</p>
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                ${stroopsToUsdc(totalPending)}
                <span className="text-sm font-normal text-gray-400 ml-1">USDC</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Across {openCount} open engagement{openCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Payout history */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Payout history</h2>
            </div>

            {payouts.length === 0 ? (
              <div className="p-12 text-center">
                <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">No payouts yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Released milestone payments will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 bg-gray-50">
                      <th className="px-5 py-2.5 font-medium">Date</th>
                      <th className="px-5 py-2.5 font-medium">Engagement</th>
                      <th className="px-5 py-2.5 font-medium">Milestone</th>
                      <th className="px-5 py-2.5 font-medium text-right">Amount</th>
                      <th className="px-5 py-2.5 font-medium">Transaction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {payouts.map(({ engagement, milestone, amount, releasedAt }) => {
                      const txHash = findPayoutTx(eventsByEngagement[engagement.id], milestone);
                      return (
                        <tr key={milestone.id} className="hover:bg-gray-50/50">
                          <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {formatDate(releasedAt)}
                          </td>
                          <td className="px-5 py-3 min-w-0">
                            <Link
                              href={`/dashboard/engagements/${engagement.id}`}
                              className="text-xs font-medium text-gray-900 hover:text-brand-600 transition-colors"
                            >
                              {engagement.jobTitle}
                            </Link>
                            <p className="text-[10px] text-gray-400 font-mono">
                              {engagement.id} · {shortAddress(engagement.companyAddress)}
                            </p>
                          </td>
                          <td className="px-5 py-3 text-xs text-gray-600">{milestone.name}</td>
                          <td className="px-5 py-3 text-xs font-medium text-gray-900 text-right whitespace-nowrap">
                            ${stroopsToUsdc(amount)}
                          </td>
                          <td className="px-5 py-3 text-xs whitespace-nowrap">
                            {txHash ? (
                              <a
                                href={explorerTxUrl(txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-mono text-brand-600 hover:text-brand-700"
                              >
                                {shortAddress(txHash, 6)}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : eventsLoading ? (
                              <Loader2 className="w-3 h-3 text-gray-300 animate-spin" />
                            ) : (
                              <Link
                                href={`/dashboard/engagements/${engagement.id}`}
                                className="text-gray-400 hover:text-brand-600"
                              >
                                View activity
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
