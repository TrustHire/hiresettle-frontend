import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';
import type { MilestoneStatus, EngagementStatus } from '@/types';

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

/** Shorten a Stellar address: GABC...XYZ */
export function shortAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 1)}...${address.slice(-chars)}`;
}

export async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

/** Convert stroops to human-readable USDC (7 decimal places on Stellar) */
export function stroopsToUsdc(stroops: string | bigint, decimals = 2): string {
  const v = BigInt(stroops);
  const whole = v / 10_000_000n;
  const fraction = (v % 10_000_000n).toString().padStart(7, '0');
  return parseFloat(`${whole}.${fraction}`).toFixed(decimals);
}

/** Convert human-readable USDC to stroops bigint */
export function usdcToStroops(usdc: string): bigint {
  const [whole, fraction = ''] = usdc.split('.');
  const padded = fraction.padEnd(7, '0').slice(0, 7);
  return BigInt(whole) * 10_000_000n + BigInt(padded);
}

export function formatDate(date: string | null): string {
  if (!date) return '—';
  return format(new Date(date), 'MMM d, yyyy');
}

export function timeAgo(date: string | null): string {
  if (!date) return '—';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/** Generate a unique engagement ID */
export function generateEngagementId(): string {
  const date = format(new Date(), 'yyyyMMdd');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ENG-${date}-${rand}`;
}

/** Tailwind badge class for engagement status */
export function engagementStatusBadge(status: EngagementStatus): string {
  const map: Record<EngagementStatus, string> = {
    Active:               'badge-active',
    Completed:            'badge-completed',
    Cancelled:            'badge-cancelled',
    ReplacementRequested: 'badge-replacement',
  };
  return map[status] ?? 'badge';
}

export function engagementStatusLabel(status: EngagementStatus): string {
  const map: Record<EngagementStatus, string> = {
    Active:               'Active',
    Completed:            'Completed',
    Cancelled:            'Cancelled',
    ReplacementRequested: 'Replacement requested',
  };
  return map[status] ?? status;
}

/** Tailwind badge class for milestone status */
export function milestoneStatusBadge(status: MilestoneStatus): string {
  const map: Record<MilestoneStatus, string> = {
    Locked:        'badge-locked',
    Pending:       'badge-pending',
    ProofSubmitted:'badge-submitted',
    Confirmed:     'badge-confirmed',
    Disputed:      'badge-disputed',
    Resolved:      'badge-resolved',
  };
  return map[status] ?? 'badge';
}

export function milestoneStatusLabel(status: MilestoneStatus): string {
  const map: Record<MilestoneStatus, string> = {
    Locked:        'Locked',
    Pending:       'Pending',
    ProofSubmitted:'Proof submitted',
    Confirmed:     'Confirmed',
    Disputed:      'Disputed',
    Resolved:      'Resolved',
  };
  return map[status] ?? status;
}

/** Compute engagement completion progress % */
export function engagementProgress(milestones: { status: MilestoneStatus }[]): number {
  if (!milestones.length) return 0;
  const done = milestones.filter(
    (m) => m.status === 'Confirmed' || m.status === 'Resolved',
  ).length;
  return Math.round((done / milestones.length) * 100);
}

/** Format retention days remaining into a human string */
export function formatRetentionCountdown(daysRemaining: number): string {
  if (daysRemaining <= 0) return 'Ready to unlock';
  if (daysRemaining === 1) return '1 day remaining';
  if (daysRemaining < 7)  return `${daysRemaining} days remaining`;
  const weeks = Math.floor(daysRemaining / 7);
  const days  = daysRemaining % 7;
  if (days === 0) return `${weeks}w remaining`;
  return `${weeks}w ${days}d remaining`;
}

/** Return timer pill class based on days remaining */
export function timerPillClass(daysRemaining: number, unlockable: boolean): string {
  if (unlockable || daysRemaining <= 0) return 'timer-ready';
  if (daysRemaining <= 3) return 'timer-active';
  return 'timer-active';
}
