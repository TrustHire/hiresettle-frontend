"use client";

import { useQuery } from "@tanstack/react-query";
import { engagementsApi } from "@/lib/api/services";
import { useAuthStore } from "@/lib/hooks/use-auth-store";
import { engagementKeys } from "@/lib/query-keys";
import type { Engagement, UserRole } from "@/types";

/**
 * Fetch all engagements where the user is a participant. For roles that
 * appear as multiple parties we fire parallel requests and deduplicate.
 */
export async function fetchParticipantEngagements(
  address: string,
  role: UserRole | undefined,
): Promise<Engagement[]> {
  const queries: Promise<Engagement[]>[] = [];

  if (!role || role === "COMPANY") {
    queries.push(
      engagementsApi
        .list({ companyAddress: address, limit: 200 })
        .then((r) => r.data),
    );
  }
  if (!role || role === "RECRUITER") {
    queries.push(
      engagementsApi
        .list({ recruiterAddress: address, limit: 200 })
        .then((r) => r.data),
    );
  }
  if (role === "ARBITER" || role === "ADMIN") {
    // Arbiter address isn't a filter the API exposes, so fetch all active
    // engagements and filter client-side.
    queries.push(
      engagementsApi
        .list({ limit: 200 })
        .then((r) =>
          r.data.filter((engagement) => engagement.arbiterAddress === address),
        ),
    );
  }
  if (queries.length === 0) {
    // Fallback: fetch all
    queries.push(engagementsApi.list({ limit: 200 }).then((r) => r.data));
  }

  const results = await Promise.all(queries);
  const map = new Map<string, Engagement>();
  results.flat().forEach((engagement) => map.set(engagement.id, engagement));
  return [...map.values()];
}

/**
 * Shared, cached list of the signed-in user's engagements. Used by the
 * overview, the unlock calendar and the command palette so they all share
 * one React Query cache entry.
 */
export function useParticipantEngagements(options?: { enabled?: boolean }) {
  const { address, user, isHydrated } = useAuthStore();
  const extraEnabled = options?.enabled ?? true;

  return useQuery({
    queryKey: [...engagementKeys.all, "overview", address, user?.role],
    enabled: extraEnabled && isHydrated && !!address,
    queryFn: async () => {
      if (!address) {
        throw new Error(
          "A wallet address is required to load dashboard engagements.",
        );
      }
      return fetchParticipantEngagements(address, user?.role);
    },
  });
}
