export const engagementKeys = {
  all: ["engagements"] as const,
  lists: () => [...engagementKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...engagementKeys.lists(), filters] as const,
  detail: (id: string) => [...engagementKeys.all, "detail", id] as const,
};

export const timerKeys = {
  all: ["engagement-timers"] as const,
  detail: (engagementId: string, milestoneIndex: number) =>
    [...timerKeys.all, engagementId, milestoneIndex] as const,
};

export const notificationKeys = {
  all: ["notifications"] as const,
  list: () => [...notificationKeys.all, "list"] as const,
};

export const userKeys = {
  all: ["users"] as const,
  me: (address: string | null) => [...userKeys.all, "me", address] as const,
};

export const earningsKeys = {
  all: ["earnings"] as const,
  recruiter: (address: string) => [...earningsKeys.all, "recruiter", address] as const,
  payoutEvents: (engagementId: string) =>
    [...earningsKeys.all, "payout-events", engagementId] as const,
};
