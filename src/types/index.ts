// src/types/index.ts

export type MilestoneStatus =
  | 'Locked'
  | 'Pending'
  | 'ProofSubmitted'
  | 'Confirmed'
  | 'Disputed'
  | 'Resolved';

export type MilestoneKind = 'Placement' | 'Retention';

export type EngagementStatus =
  | 'Active'
  | 'Completed'
  | 'Cancelled'
  | 'ReplacementRequested';

export type UserRole = 'COMPANY' | 'RECRUITER' | 'ARBITER' | 'ADMIN';

export interface Milestone {
  id: string;
  engagementId: string;
  milestoneIndex: number;
  name: string;
  kind: MilestoneKind;
  paymentPercent: number;
  retentionDays: number | null;
  validAfterLedger: number | null;
  unlockEstimatedAt: string | null;
  proofHash: string | null;
  status: MilestoneStatus;
  paymentReleased: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RetentionTimer {
  daysRemaining: number;
  ledgersRemaining: number;
  unlockable: boolean;
  estimatedUnlockAt: string | null;
}

export interface Engagement {
  id: string;
  companyAddress: string;
  recruiterAddress: string;
  arbiterAddress: string;
  tokenAddress: string;
  totalAmount: string;
  releasedAmount: string;
  jobTitle: string;
  jobDescription: string | null;
  salaryRange: string | null;
  location: string | null;
  status: EngagementStatus;
  txHash: string | null;
  createdLedger: number | null;
  createdAt: string;
  updatedAt: string;
  milestones: Milestone[];
  events?: ChainEvent[];
}

export interface ChainEvent {
  id: string;
  engagementId: string | null;
  eventName: string;
  ledger: number;
  txHash: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  stellarAddress: string;
  email: string | null;
  name: string | null;
  role: UserRole;
}

export interface MilestoneInput {
  name: string;
  paymentPercent: number;
  kind: 'PLACEMENT' | 'RETENTION';
  retentionDays?: number;
}

export interface CreateEngagementInput {
  engagementId: string;
  recruiterAddress: string;
  arbiterAddress: string;
  totalAmount: string;
  jobTitle: string;
  jobDescription?: string;
  salaryRange?: string;
  location?: string;
  milestones: MilestoneInput[];
  retentionDays: number[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}
