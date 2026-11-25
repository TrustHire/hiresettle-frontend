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

export const accountKeys = {
  all: ["stellar-account"] as const,
  setup: (address: string) => [...accountKeys.all, "setup", address] as const,
  freighter: () => [...accountKeys.all, "freighter"] as const,
};
